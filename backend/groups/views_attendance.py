"""
Attendance API views.

Provides CRUD operations and a bulk-update endpoint for managing
daily attendance records of students in groups.

Access control:
- Educators: Can manage attendance for groups they are members of
- LocationManager+: Can manage attendance for all groups at their location
- Admin/SuperAdmin: Full access within tenant

Tenant isolation is provided by TenantViewSetMixin.
"""

from django.utils import timezone
from django_filters import rest_framework as django_filters
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from core.permissions import IsEducator
from groups.models import Group, Student
from groups.models_attendance import Attendance
from groups.serializers_attendance import (
    AttendanceCreateSerializer,
    AttendanceSerializer,
    BulkAttendanceSerializer,
)


class AttendanceFilter(django_filters.FilterSet):
    """Filter for attendance records."""

    group_id = django_filters.NumberFilter(field_name="group_id")
    student_id = django_filters.NumberFilter(field_name="student_id")
    date = django_filters.DateFilter(field_name="date")
    start_date = django_filters.DateFilter(
        field_name="date", lookup_expr="gte"
    )
    end_date = django_filters.DateFilter(
        field_name="date", lookup_expr="lte"
    )
    status = django_filters.ChoiceFilter(choices=Attendance.Status.choices)

    class Meta:
        model = Attendance
        fields = [
            "group_id",
            "student_id",
            "date",
            "start_date",
            "end_date",
            "status",
        ]


class AttendanceViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for attendance records with bulk-update support.

    Standard CRUD endpoints plus:
    - POST /attendance/bulk/ - Bulk create/update attendance for a group+date
    - GET /attendance/summary/ - Get attendance summary for a group

    Permissions:
    - Educators: CRUD for groups they belong to
    - LocationManager+: CRUD for all groups in their location
    - Admin/SuperAdmin: Full access within tenant
    """

    queryset = Attendance.objects.all()
    filterset_class = AttendanceFilter
    search_fields = ["notes"]
    ordering_fields = ["date", "status", "created_at"]
    ordering = ["-date"]
    permission_classes = [permissions.IsAuthenticated, IsEducator]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Attendance.objects.none()
        qs = super().get_queryset()
        return qs.filter(is_deleted=False).select_related(
            "student", "group", "recorded_by"
        )

    def get_serializer_class(self):
        if self.action == "create":
            return AttendanceCreateSerializer
        if self.action == "bulk_update":
            return BulkAttendanceSerializer
        return AttendanceSerializer

    def perform_create(self, serializer):
        serializer.save(
            recorded_by=self.request.user,
            organization=self.request.tenant,
        )

    def perform_destroy(self, instance):
        """Soft-delete attendance record."""
        instance.is_deleted = True
        instance.save()

    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk_update(self, request):
        """
        Bulk create or update attendance records for a group on a specific date.

        Expects:
        {
            "group_id": 1,
            "date": "2026-03-27",
            "records": [
                {"student_id": 1, "status": "present", "notes": ""},
                {"student_id": 2, "status": "sick", "notes": "Fieber"},
                ...
            ]
        }
        """
        group_id = request.data.get("group_id")
        if not group_id:
            return Response(
                {"detail": "group_id ist erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate group exists and user has access
        try:
            group = Group.objects.get(id=group_id)
        except Group.DoesNotExist:
            return Response(
                {"detail": "Gruppe nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Tenant check
        if (
            not request.is_cross_tenant
            and request.tenant_ids
            and group.organization_id not in request.tenant_ids
        ):
            return Response(
                {"detail": "Kein Zugriff auf diese Gruppe."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = BulkAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        date = serializer.validated_data["date"]
        records = serializer.validated_data["records"]

        created = 0
        updated = 0

        for record in records:
            student_id = record["student_id"]
            # Verify student belongs to group
            if not Student.objects.filter(
                id=student_id, group_id=group_id, is_deleted=False
            ).exists():
                continue

            obj, was_created = Attendance.objects.update_or_create(
                student_id=student_id,
                date=date,
                defaults={
                    "group_id": group_id,
                    "status": record["status"],
                    "notes": record.get("notes", ""),
                    "recorded_by": request.user,
                    "organization_id": group.organization_id,
                    "is_deleted": False,
                },
            )
            if was_created:
                created += 1
            else:
                updated += 1

        return Response(
            {
                "detail": f"{created} erstellt, {updated} aktualisiert.",
                "created": created,
                "updated": updated,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        """
        Get attendance summary for a group over a date range.

        Query params:
        - group_id (required)
        - start_date (optional, defaults to 7 days ago)
        - end_date (optional, defaults to today)
        """
        group_id = request.query_params.get("group_id")
        if not group_id:
            return Response(
                {"detail": "group_id ist erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        end_date = request.query_params.get(
            "end_date", timezone.now().date().isoformat()
        )
        start_date = request.query_params.get(
            "start_date",
            (timezone.now() - timezone.timedelta(days=7)).date().isoformat(),
        )

        qs = self.get_queryset().filter(
            group_id=group_id,
            date__gte=start_date,
            date__lte=end_date,
        )

        total = qs.count()
        by_status = {}
        for choice_value, choice_label in Attendance.Status.choices:
            count = qs.filter(status=choice_value).count()
            by_status[choice_value] = {
                "count": count,
                "label": choice_label,
                "percentage": round(count / total * 100, 1) if total > 0 else 0,
            }

        return Response(
            {
                "group_id": int(group_id),
                "start_date": start_date,
                "end_date": end_date,
                "total_records": total,
                "by_status": by_status,
            }
        )
