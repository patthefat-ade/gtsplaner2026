"""
Task management views.

Provides CRUD operations for tasks, a board endpoint for Kanban view,
and a status change endpoint that triggers notifications.
"""

import logging

from django.contrib.auth import get_user_model
from django.db import models
from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.mixins_export import ExportMixin
from core.pagination import StandardPagination
from tasks.models import Task
from tasks.serializers import (
    TaskCreateSerializer,
    TaskListSerializer,
    TaskStatusSerializer,
)

User = get_user_model()
logger = logging.getLogger("kassenbuch.tasks")


class TaskViewSet(ExportMixin, viewsets.ModelViewSet):
    """
    ViewSet for task management.

    Educators see only their assigned tasks.
    LocationManagers see all tasks at their location(s).
    Admins/SuperAdmins see all tasks in their tenant.
    """

    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination
    filterset_fields = ["status", "priority", "assigned_to", "location", "group"]
    search_fields = ["title", "description"]
    ordering_fields = ["due_date", "created_at", "priority", "status"]
    ordering = ["-created_at"]

    # ExportMixin configuration
    export_filename = "aufgaben"
    export_fields = [
        ("title", "Titel"),
        ("status", "Status"),
        ("priority", "Priorität"),
        ("due_date", "Stichtag"),
        ("assigned_to_name", "Zugewiesen an"),
        ("created_by_name", "Erstellt von"),
    ]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TaskCreateSerializer
        if self.action == "change_status":
            return TaskStatusSerializer
        return TaskListSerializer

    def get_queryset(self):
        """Filter tasks based on user role and tenant."""
        user = self.request.user
        tenant_ids = getattr(self.request, "tenant_ids", [])
        is_cross_tenant = getattr(self.request, "is_cross_tenant", False)

        qs = Task.objects.select_related(
            "created_by",
            "assigned_to",
            "location",
            "group",
            "organization",
        )

        # SuperAdmin: no tenant filter (cross-tenant access)
        # Others: filter by tenant_ids
        if not is_cross_tenant and tenant_ids:
            qs = qs.filter(organization_id__in=tenant_ids)
        elif not is_cross_tenant:
            # No tenant_ids and not cross-tenant: return empty
            return qs.none()

        # Educators only see their own assigned tasks
        if hasattr(user, "role") and user.role == "educator":
            qs = qs.filter(assigned_to=user)

        # LocationManagers see tasks at their location(s)
        elif hasattr(user, "role") and user.role == "location_manager":
            if hasattr(user, "location_id") and user.location_id:
                qs = qs.filter(
                    models.Q(location_id=user.location_id)
                    | models.Q(created_by=user)
                    | models.Q(assigned_to=user)
                )

        return qs

    def perform_create(self, serializer):
        """Set created_by and organization on task creation."""
        serializer.save(
            created_by=self.request.user,
            organization_id=self.request.user.organization_id,
        )

    def create(self, request, *args, **kwargs):
        """Create task, send email notification, and return full detail serializer."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)

        task = serializer.instance

        # Send email notification to the assigned user (async via Celery)
        if task.assigned_to and task.assigned_to != request.user:
            self._send_task_assigned_email(task)

        # Create in-app notification for the assigned user
        if task.assigned_to and task.assigned_to != request.user:
            self._create_assignment_notification(task)

        # Return the full detail serializer
        detail_serializer = TaskListSerializer(task)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Update task and return full detail serializer."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        old_assigned_to = instance.assigned_to_id
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)

        # If the task was reassigned to a different user, send notification
        if (
            instance.assigned_to_id != old_assigned_to
            and instance.assigned_to
            and instance.assigned_to != request.user
        ):
            self._send_task_assigned_email(instance)
            self._create_assignment_notification(instance)

        detail_serializer = TaskListSerializer(instance)
        return Response(detail_serializer.data)

    @action(detail=True, methods=["patch"], url_path="status")
    def change_status(self, request, pk=None):
        """
        Change task status and trigger notification to creator.

        Allowed transitions:
        - open → in_progress
        - in_progress → done
        - done → open (reopen)
        - in_progress → open (reset)
        """
        task = self.get_object()
        serializer = TaskStatusSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        new_status = serializer.validated_data["status"]
        old_status = task.status

        if new_status == old_status:
            return Response(
                {"detail": "Status ist bereits gesetzt."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Apply status change
        if new_status == Task.Status.DONE:
            task.mark_done()
        elif new_status == Task.Status.IN_PROGRESS:
            task.mark_in_progress()
        elif new_status == Task.Status.OPEN:
            task.reopen()

        # Create in-app notification for the task creator
        if task.created_by != request.user:
            self._create_status_notification(task, old_status, new_status, request.user)
            # Send email notification for status change (async via Celery)
            self._send_task_status_email(task, old_status, new_status, request.user)

        detail_serializer = TaskListSerializer(task)
        return Response(detail_serializer.data)

    @action(detail=False, methods=["get"], url_path="board")
    def board(self, request):
        """
        Return tasks grouped by status for Kanban board view.
        No pagination – returns all active tasks.
        """
        qs = self.get_queryset()

        # Apply filters from query params
        assigned_to = request.query_params.get("assigned_to")
        priority = request.query_params.get("priority")
        location = request.query_params.get("location")

        if assigned_to:
            qs = qs.filter(assigned_to_id=assigned_to)
        if priority:
            qs = qs.filter(priority=priority)
        if location:
            qs = qs.filter(location_id=location)

        serializer = TaskListSerializer(qs, many=True)
        tasks = serializer.data

        board_data = {
            "open": [t for t in tasks if t["status"] == "open"],
            "in_progress": [t for t in tasks if t["status"] == "in_progress"],
            "done": [t for t in tasks if t["status"] == "done"],
        }

        return Response(board_data)

    @action(detail=False, methods=["get"], url_path="assignees")
    def assignees(self, request):
        """
        Return a list of users that the current user can assign tasks to.

        - SuperAdmin/Admin: all active users in their tenant
        - LocationManager: all active users at their location(s)
        - Educator: all active users at their location
        """
        user = request.user
        tenant_ids = getattr(request, "tenant_ids", [])
        is_cross_tenant = getattr(request, "is_cross_tenant", False)

        qs = User.objects.filter(is_active=True).order_by("last_name", "first_name")

        if is_cross_tenant:
            # SuperAdmin: all users
            pass
        elif tenant_ids:
            if hasattr(user, "role") and user.role == "educator":
                # Educator: users at the same location
                if user.location_id:
                    qs = qs.filter(location_id=user.location_id)
                else:
                    qs = qs.filter(organization_id__in=tenant_ids)
            elif hasattr(user, "role") and user.role == "location_manager":
                # LocationManager: users at their location(s)
                if user.location_id:
                    qs = qs.filter(
                        models.Q(location_id=user.location_id)
                        | models.Q(id=user.id)
                    )
                else:
                    qs = qs.filter(organization_id__in=tenant_ids)
            else:
                # Admin: all users in tenant
                qs = qs.filter(organization_id__in=tenant_ids)
        else:
            qs = qs.none()

        data = [
            {
                "id": u.id,
                "first_name": u.first_name,
                "last_name": u.last_name,
                "role": u.role,
                "location_name": getattr(u.location, "name", None) if hasattr(u, "location") else None,
            }
            for u in qs.select_related("location")[:200]
        ]

        return Response(data)

    # -----------------------------------------------------------------------
    # Private helpers
    # -----------------------------------------------------------------------

    def _send_task_assigned_email(self, task):
        """Send an async email notification for task assignment."""
        from system.tasks import send_task_assigned_email

        try:
            send_task_assigned_email.delay(task.pk)
        except Exception:
            logger.warning(
                "Celery/Redis unavailable – sending task assignment email synchronously"
            )
            send_task_assigned_email(task.pk)

    def _send_task_status_email(self, task, old_status, new_status, changed_by):
        """Send an async email notification for task status change."""
        from system.tasks import send_task_status_changed_email

        try:
            send_task_status_changed_email.delay(
                task.pk, old_status, new_status, changed_by.pk
            )
        except Exception:
            logger.warning(
                "Celery/Redis unavailable – sending task status email synchronously"
            )
            send_task_status_changed_email(
                task.pk, old_status, new_status, changed_by.pk
            )

    def _create_assignment_notification(self, task):
        """Create an in-app notification for task assignment."""
        from system.models import InAppNotification

        InAppNotification.objects.create(
            recipient=task.assigned_to,
            title=f"Neue Aufgabe: {task.title}",
            message=(
                f"{task.created_by.get_full_name()} hat Ihnen die Aufgabe "
                f'"{task.title}" zugewiesen.'
            ),
            notification_type="task_assigned",
            related_task=task,
            organization=task.organization,
        )

    def _create_status_notification(self, task, old_status, new_status, changed_by):
        """Create an in-app notification for the task creator."""
        from system.models import InAppNotification

        status_labels = dict(Task.Status.choices)
        old_label = status_labels.get(old_status, old_status)
        new_label = status_labels.get(new_status, new_status)

        InAppNotification.objects.create(
            recipient=task.created_by,
            title=f"Aufgabe aktualisiert: {task.title}",
            message=(
                f"{changed_by.get_full_name()} hat den Status der Aufgabe "
                f'"{task.title}" von "{old_label}" auf "{new_label}" geändert.'
            ),
            notification_type="task_status_changed",
            related_task=task,
            organization=task.organization,
        )
