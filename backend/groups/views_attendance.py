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

import logging

from django.db.models import Count, Q
from django.utils import timezone
from django_filters import rest_framework as django_filters
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from core.permissions import IsEducator
from groups.models import Group, Student
from groups.models_attendance import Attendance
from groups.models_protocol import DailyProtocol
from groups.serializers_attendance import (
    AttendanceCreateSerializer,
    AttendanceSerializer,
    BulkAttendanceSerializer,
)

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Status values and labels for Attendance → DailyProtocol sync
# ---------------------------------------------------------------------------
_SYNC_STATUSES = {
    Attendance.Status.SICK,
    Attendance.Status.ABSENT,
    Attendance.Status.EXCUSED,
}
_STATUS_LABELS = {
    Attendance.Status.SICK: "Krank",
    Attendance.Status.ABSENT: "Abwesend",
    Attendance.Status.EXCUSED: "Beurlaubt",
}
_AUTO_PREFIX = "[Automatisch via Anwesenheit]"


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

    # ------------------------------------------------------------------
    # Optimised bulk endpoint – replaces per-record update_or_create
    # with set-based validation and bulk_create / bulk_update.
    # ------------------------------------------------------------------
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

        Performance: Uses at most ~6 DB queries regardless of the number
        of students (was O(n) before).
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

        # 1) Collect all requested student IDs
        requested_ids = {r["student_id"] for r in records}

        # 2) Validate students in ONE query
        valid_ids = set(
            Student.objects.filter(
                id__in=requested_ids,
                group_id=group_id,
                is_deleted=False,
            ).values_list("id", flat=True)
        )

        # 3) Load existing attendance records in ONE query
        existing_map = {
            att.student_id: att
            for att in Attendance.objects.filter(
                student_id__in=valid_ids,
                date=date,
            )
        }

        # Build record lookup
        record_map = {r["student_id"]: r for r in records}

        to_create = []
        to_update = []

        for student_id in valid_ids:
            record = record_map.get(student_id)
            if record is None:
                continue

            if student_id in existing_map:
                # Update existing
                att = existing_map[student_id]
                att.group_id = group_id
                att.status = record["status"]
                att.notes = record.get("notes", "")
                att.recorded_by = request.user
                att.organization_id = group.organization_id
                att.is_deleted = False
                to_update.append(att)
            else:
                # Create new
                to_create.append(
                    Attendance(
                        student_id=student_id,
                        date=date,
                        group_id=group_id,
                        status=record["status"],
                        notes=record.get("notes", ""),
                        recorded_by=request.user,
                        organization_id=group.organization_id,
                        is_deleted=False,
                    )
                )

        # 4) Bulk create & bulk update (2 queries)
        if to_create:
            Attendance.objects.bulk_create(to_create)
        if to_update:
            Attendance.objects.bulk_update(
                to_update,
                fields=[
                    "group_id", "status", "notes",
                    "recorded_by", "organization_id", "is_deleted",
                    "updated_at",
                ],
            )

        # 5) Sync to DailyProtocol in bulk (replaces per-record signal)
        self._bulk_sync_protocols(
            group=group,
            date=date,
            records=records,
            valid_ids=valid_ids,
            user=request.user,
        )

        created = len(to_create)
        updated = len(to_update)

        return Response(
            {
                "detail": f"{created} erstellt, {updated} aktualisiert.",
                "created": created,
                "updated": updated,
            },
            status=status.HTTP_200_OK,
        )

    def _bulk_sync_protocols(self, *, group, date, records, valid_ids, user):
        """
        Bulk-synchronise Attendance → DailyProtocol.

        Instead of relying on the post_save signal (which fires once per
        record), this method handles the sync for the entire batch in a
        handful of queries.
        """
        record_map = {r["student_id"]: r for r in records if r["student_id"] in valid_ids}

        # Load existing protocols in ONE query
        existing_protocols = {
            p.student_id: p
            for p in DailyProtocol.objects.filter(
                student_id__in=valid_ids,
                date=date,
            )
        }

        protocols_to_create = []
        protocols_to_update = []

        for student_id, record in record_map.items():
            att_status = record["status"]

            if att_status in _SYNC_STATUSES:
                label = _STATUS_LABELS.get(att_status, att_status)
                auto_note = f"{_AUTO_PREFIX} {label}"
                severity = (
                    DailyProtocol.IncidentSeverity.IMPORTANT
                    if att_status == Attendance.Status.SICK
                    else DailyProtocol.IncidentSeverity.NORMAL
                )

                if student_id in existing_protocols:
                    protocol = existing_protocols[student_id]
                    existing = protocol.incidents or ""
                    lines = [
                        ln for ln in existing.splitlines()
                        if not ln.startswith(_AUTO_PREFIX)
                    ]
                    lines.insert(0, auto_note)
                    protocol.incidents = "\n".join(lines).strip()
                    protocol.incident_severity = severity
                    protocols_to_update.append(protocol)
                else:
                    protocols_to_create.append(
                        DailyProtocol(
                            student_id=student_id,
                            date=date,
                            group_id=group.id,
                            organization_id=group.organization_id,
                            incidents=auto_note,
                            incident_severity=severity,
                            recorded_by=user,
                        )
                    )

            elif att_status == Attendance.Status.PRESENT:
                if student_id in existing_protocols:
                    protocol = existing_protocols[student_id]
                    existing = protocol.incidents or ""
                    lines = [
                        ln for ln in existing.splitlines()
                        if not ln.startswith(_AUTO_PREFIX)
                    ]
                    cleaned = "\n".join(lines).strip()
                    if cleaned != existing.strip():
                        protocol.incidents = cleaned
                        protocol.incident_severity = DailyProtocol.IncidentSeverity.NORMAL
                        protocols_to_update.append(protocol)

        if protocols_to_create:
            DailyProtocol.objects.bulk_create(
                protocols_to_create, ignore_conflicts=True
            )
        if protocols_to_update:
            DailyProtocol.objects.bulk_update(
                protocols_to_update,
                fields=["incidents", "incident_severity", "updated_at"],
            )

    # ------------------------------------------------------------------
    # Optimised summary – single aggregated query instead of N queries
    # ------------------------------------------------------------------
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

        # Single aggregated query instead of N separate count() calls
        aggregation = {"total": Count("id")}
        for choice_value, _choice_label in Attendance.Status.choices:
            aggregation[f"count_{choice_value}"] = Count(
                "id", filter=Q(status=choice_value)
            )
        result = qs.aggregate(**aggregation)

        total = result["total"]
        by_status = {}
        for choice_value, choice_label in Attendance.Status.choices:
            count = result[f"count_{choice_value}"]
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
