"""
Timetracking API views: TimeEntry, LeaveType, LeaveRequest, WorkingHoursLimit ViewSets.

Includes CRUD operations, leave approval workflow, and working hours limits.
"""

from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as django_filters
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsEducator, IsLocationManagerOrAbove
from timetracking.models import LeaveRequest, LeaveType, TimeEntry, WorkingHoursLimit
from timetracking.serializers import (
    LeaveRequestApprovalSerializer,
    LeaveRequestCreateSerializer,
    LeaveRequestListSerializer,
    LeaveTypeSerializer,
    TimeEntryCreateSerializer,
    TimeEntryListSerializer,
    WorkingHoursLimitSerializer,
)


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class TimeEntryFilter(django_filters.FilterSet):
    """Filter for time entries."""

    user_id = django_filters.NumberFilter(field_name="user_id")
    group_id = django_filters.NumberFilter(field_name="group_id")
    start_date = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    end_date = django_filters.DateFilter(field_name="date", lookup_expr="lte")

    class Meta:
        model = TimeEntry
        fields = ["user_id", "group_id", "start_date", "end_date"]


class LeaveRequestFilter(django_filters.FilterSet):
    """Filter for leave requests."""

    user_id = django_filters.NumberFilter(field_name="user_id")
    status = django_filters.ChoiceFilter(choices=LeaveRequest.Status.choices)
    leave_type_id = django_filters.NumberFilter(field_name="leave_type_id")
    start_date = django_filters.DateFilter(field_name="start_date", lookup_expr="gte")
    end_date = django_filters.DateFilter(field_name="end_date", lookup_expr="lte")

    class Meta:
        model = LeaveRequest
        fields = ["user_id", "status", "leave_type_id", "start_date", "end_date"]


# ---------------------------------------------------------------------------
# TimeEntry ViewSet
# ---------------------------------------------------------------------------

class TimeEntryViewSet(viewsets.ModelViewSet):
    """
    CRUD for time entries.

    - Educators: CRUD for own time entries
    - LocationManager+: view all entries in their location
    - Admin/SuperAdmin: full access
    """

    filterset_class = TimeEntryFilter
    search_fields = ["notes"]
    ordering_fields = ["date", "start_time", "duration_minutes", "created_at"]
    ordering = ["-date", "-start_time"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TimeEntry.objects.none()
        user = self.request.user
        qs = TimeEntry.objects.filter(is_deleted=False).select_related(
            "user", "group"
        )
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.role == "location_manager" and user.location:
            return qs.filter(group__location=user.location)
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TimeEntryCreateSerializer
        return TimeEntryListSerializer

    def get_permissions(self):
        return [permissions.IsAuthenticated(), IsEducator()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


# ---------------------------------------------------------------------------
# LeaveType ViewSet
# ---------------------------------------------------------------------------

class LeaveTypeViewSet(viewsets.ModelViewSet):
    """
    CRUD for leave types.

    - Educators: read-only
    - LocationManager+: full CRUD for their location
    """

    serializer_class = LeaveTypeSerializer
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return LeaveType.objects.none()
        user = self.request.user
        qs = LeaveType.objects.all()
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.location:
            return qs.filter(location=user.location)
        return qs.none()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]

    def perform_create(self, serializer):
        serializer.save(location=self.request.user.location)

    def perform_destroy(self, instance):
        if instance.is_system_type:
            return Response(
                {"detail": "Systemtypen koennen nicht geloescht werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.delete()


# ---------------------------------------------------------------------------
# LeaveRequest ViewSet
# ---------------------------------------------------------------------------

class LeaveRequestViewSet(viewsets.ModelViewSet):
    """
    CRUD for leave requests with approval workflow.

    - Educators: CRUD for own leave requests
    - LocationManager+: approve/reject, view all in their location
    """

    filterset_class = LeaveRequestFilter
    search_fields = ["reason", "approval_notes"]
    ordering_fields = ["start_date", "end_date", "total_days", "created_at", "status"]
    ordering = ["-start_date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return LeaveRequest.objects.none()
        user = self.request.user
        qs = LeaveRequest.objects.filter(is_deleted=False).select_related(
            "user", "leave_type", "approved_by"
        )
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.role == "location_manager" and user.location:
            return qs.filter(
                Q(user=user) | Q(user__location=user.location)
            )
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action == "create":
            return LeaveRequestCreateSerializer
        if self.action in ["update", "partial_update"]:
            return LeaveRequestCreateSerializer
        if self.action in ["approve", "reject"]:
            return LeaveRequestApprovalSerializer
        return LeaveRequestListSerializer

    def get_permissions(self):
        if self.action in ["approve", "reject"]:
            return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]
        return [permissions.IsAuthenticated(), IsEducator()]

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve a pending leave request."""
        leave_request = self.get_object()
        if leave_request.status != LeaveRequest.Status.PENDING:
            return Response(
                {"detail": "Nur ausstehende Antraege koennen genehmigt werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        leave_request.status = LeaveRequest.Status.APPROVED
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.approval_notes = serializer.validated_data.get(
            "approval_notes", ""
        )
        leave_request.save()

        return Response(
            LeaveRequestListSerializer(
                leave_request, context={"request": request}
            ).data
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject a pending leave request."""
        leave_request = self.get_object()
        if leave_request.status != LeaveRequest.Status.PENDING:
            return Response(
                {"detail": "Nur ausstehende Antraege koennen abgelehnt werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        leave_request.status = LeaveRequest.Status.REJECTED
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.approval_notes = serializer.validated_data.get(
            "approval_notes", ""
        )
        leave_request.save()

        return Response(
            LeaveRequestListSerializer(
                leave_request, context={"request": request}
            ).data
        )

    @action(detail=True, methods=["post"], url_path="cancel")
    def cancel(self, request, pk=None):
        """Cancel a leave request (only by the owner)."""
        leave_request = self.get_object()
        if leave_request.user != request.user:
            return Response(
                {"detail": "Nur der Antragsteller kann den Antrag stornieren."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if leave_request.status not in [
            LeaveRequest.Status.DRAFT,
            LeaveRequest.Status.PENDING,
        ]:
            return Response(
                {"detail": "Nur Entwuerfe und ausstehende Antraege koennen storniert werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        leave_request.status = LeaveRequest.Status.CANCELLED
        leave_request.save()

        return Response(
            LeaveRequestListSerializer(
                leave_request, context={"request": request}
            ).data
        )


# ---------------------------------------------------------------------------
# WorkingHoursLimit ViewSet
# ---------------------------------------------------------------------------

class WorkingHoursLimitViewSet(viewsets.ModelViewSet):
    """
    CRUD for working hours limits.

    - Educators: read-only access to their location's limits
    - LocationManager+: full CRUD
    """

    serializer_class = WorkingHoursLimitSerializer
    ordering = ["location__name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WorkingHoursLimit.objects.none()
        user = self.request.user
        qs = WorkingHoursLimit.objects.select_related("location")
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.location:
            return qs.filter(location=user.location)
        return qs.none()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]
