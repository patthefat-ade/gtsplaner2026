"""Views for DailyProtocol model."""
import logging

import django_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from core.mixins_export import ExportMixin
from groups.models import Group, Student
from groups.models_protocol import DailyProtocol
from groups.models_transfer import GroupTransfer
from groups.serializers_protocol import (
    BulkDailyProtocolSerializer,
    DailyProtocolCreateSerializer,
    DailyProtocolSerializer,
)

logger = logging.getLogger(__name__)


class DailyProtocolFilter(django_filters.FilterSet):
    """Filter for DailyProtocol queryset."""

    group_id = django_filters.NumberFilter(field_name="group_id")
    student_id = django_filters.NumberFilter(field_name="student_id")
    date = django_filters.DateFilter(field_name="date")
    date_from = django_filters.DateFilter(field_name="date", lookup_expr="gte")
    date_to = django_filters.DateFilter(field_name="date", lookup_expr="lte")
    incident_severity = django_filters.CharFilter(field_name="incident_severity")
    school_year_id = django_filters.NumberFilter(field_name="school_year_id")
    has_incidents = django_filters.BooleanFilter(method="filter_has_incidents")

    class Meta:
        model = DailyProtocol
        fields = [
            "group_id",
            "student_id",
            "date",
            "date_from",
            "date_to",
            "incident_severity",
            "school_year_id",
            "has_incidents",
        ]

    def filter_has_incidents(self, queryset, name, value):
        if value:
            return queryset.exclude(incidents="")
        return queryset.filter(incidents="")


class DailyProtocolViewSet(
    ExportMixin, TenantViewSetMixin, viewsets.ModelViewSet
):
    """
    ViewSet for DailyProtocol CRUD operations.

    Provides:
    - Standard CRUD (list, create, retrieve, update, destroy)
    - Bulk create/update for a group on a specific date
    - By-student endpoint for protocol history
    - XLSX and PDF export
    """

    queryset = DailyProtocol.objects.filter(is_deleted=False).select_related(
        "student",
        "group",
        "effective_group",
        "transfer",
        "picked_up_by",
        "recorded_by",
        "school_year",
    )
    filterset_class = DailyProtocolFilter
    search_fields = []
    ordering_fields = ["date", "arrival_time", "pickup_time", "incident_severity"]
    ordering = ["-date"]

    # Export-Konfiguration
    export_fields = [
        {"key": "date", "label": "Datum", "width": 12},
        {"key": "student.first_name", "label": "Vorname", "width": 15},
        {"key": "student.last_name", "label": "Nachname", "width": 15},
        {"key": "group.name", "label": "Gruppe", "width": 18},
        {"key": "arrival_time", "label": "Ankunft", "width": 10},
        {"key": "arrival_notes", "label": "Ankunft-Notizen", "width": 25},
        {"key": "incidents", "label": "Vorkommnisse", "width": 30},
        {"key": "incident_severity", "label": "Schweregrad", "width": 12},
        {"key": "pickup_time", "label": "Abholung", "width": 10},
        {"key": "picked_up_by.first_name", "label": "Abgeholt von", "width": 18},
        {"key": "pickup_notes", "label": "Abhol-Notizen", "width": 25},
        {"key": "recorded_by.get_full_name", "label": "Erfasst von", "width": 18},
    ]
    export_filename = "tagesprotokolle"
    export_title = "Tagesprotokolle"

    def get_export_queryset(self, request):
        """Override to use the filtered queryset with select_related."""
        qs = super().get_export_queryset(request)
        return qs.order_by("-date", "student__last_name")

    def get_row_data(self, obj, fields):
        """Override to handle severity display value."""
        row = super().get_row_data(obj, fields)
        # Replace severity code with display value
        severity_map = {
            "normal": "Normal",
            "important": "Wichtig",
            "urgent": "Dringend",
        }
        for i, field in enumerate(fields):
            if field["key"] == "incident_severity":
                row[i] = severity_map.get(row[i], row[i])
        return row

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return DailyProtocolCreateSerializer
        if self.action == "bulk_create":
            return BulkDailyProtocolSerializer
        return DailyProtocolSerializer

    def perform_create(self, serializer):
        serializer.save(
            recorded_by=self.request.user,
            organization=self.request.tenant,
        )

    def perform_update(self, serializer):
        serializer.save()

    def perform_destroy(self, instance):
        """Soft-delete protocol."""
        instance.is_deleted = True
        instance.save()

    # ------------------------------------------------------------------
    # Optimised bulk endpoint – replaces per-record update_or_create
    # with set-based validation and bulk_create / bulk_update.
    # ------------------------------------------------------------------
    @action(detail=False, methods=["post"], url_path="bulk")
    def bulk_create(self, request):
        """
        Bulk create or update daily protocols for a group on a specific date.

        Expects:
        {
            "group_id": 1,
            "date": "2026-03-28",
            "school_year_id": 1,
            "records": [
                {
                    "student_id": 1,
                    "arrival_time": "08:00",
                    "arrival_notes": "",
                    "incidents": "",
                    "incident_severity": "normal",
                    "pickup_time": "16:00",
                    "picked_up_by_id": null,
                    "pickup_notes": ""
                },
                ...
            ]
        }

        Performance: Uses at most ~8 DB queries regardless of the number
        of students (was O(n) before).
        """
        serializer = BulkDailyProtocolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        group_id = serializer.validated_data["group_id"]
        date = serializer.validated_data["date"]
        school_year_id = serializer.validated_data.get("school_year_id")
        records = serializer.validated_data["records"]

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
            not getattr(request, "is_cross_tenant", False)
            and hasattr(request, "tenant_ids")
            and request.tenant_ids
            and group.organization_id not in request.tenant_ids
        ):
            return Response(
                {"detail": "Kein Zugriff auf diese Gruppe."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # 1) Collect all requested student IDs
        requested_ids = {
            r.get("student_id") for r in records if r.get("student_id")
        }

        # 2) Validate students in ONE query
        valid_group_ids = set(
            Student.objects.filter(
                id__in=requested_ids,
                group_id=group_id,
                is_deleted=False,
            ).values_list("id", flat=True)
        )

        # 3) Check transfers for remaining students in ONE query
        remaining_ids = requested_ids - valid_group_ids
        transfer_map = {}
        if remaining_ids:
            transfers = GroupTransfer.objects.filter(
                student_id__in=remaining_ids,
                target_group_id=group_id,
                transfer_date=date,
                status__in=["confirmed", "completed"],
                is_deleted=False,
            )
            transfer_map = {t.student_id: t for t in transfers}

        valid_ids = valid_group_ids | set(transfer_map.keys())

        # 4) Load existing protocols in ONE query
        existing_map = {
            p.student_id: p
            for p in DailyProtocol.objects.filter(
                student_id__in=valid_ids,
                date=date,
            )
        }

        # Build record lookup
        record_map = {r["student_id"]: r for r in records if r.get("student_id")}

        to_create = []
        to_update = []

        for student_id in valid_ids:
            record = record_map.get(student_id)
            if record is None:
                continue

            transfer = transfer_map.get(student_id)

            defaults = {
                "group_id": group_id,
                "arrival_time": record.get("arrival_time"),
                "arrival_notes": record.get("arrival_notes", ""),
                "incidents": record.get("incidents", ""),
                "incident_severity": record.get("incident_severity", "normal"),
                "pickup_time": record.get("pickup_time"),
                "picked_up_by_id": record.get("picked_up_by_id"),
                "pickup_notes": record.get("pickup_notes", ""),
                "recorded_by": request.user,
                "organization_id": group.organization_id,
                "is_deleted": False,
            }

            if school_year_id:
                defaults["school_year_id"] = school_year_id
            if transfer:
                defaults["transfer"] = transfer
                defaults["effective_group_id"] = transfer.target_group_id

            if student_id in existing_map:
                # Update existing protocol
                protocol = existing_map[student_id]
                for key, value in defaults.items():
                    setattr(protocol, key, value)
                to_update.append(protocol)
            else:
                # Create new protocol
                to_create.append(
                    DailyProtocol(
                        student_id=student_id,
                        date=date,
                        **defaults,
                    )
                )

        # 5) Bulk create & bulk update (2 queries)
        created = 0
        updated = 0

        if to_create:
            DailyProtocol.objects.bulk_create(to_create)
            created = len(to_create)
        if to_update:
            DailyProtocol.objects.bulk_update(
                to_update,
                fields=[
                    "group_id", "arrival_time", "arrival_notes",
                    "incidents", "incident_severity", "pickup_time",
                    "picked_up_by_id", "pickup_notes", "recorded_by",
                    "organization_id", "is_deleted", "updated_at",
                ],
            )
            updated = len(to_update)

        return Response(
            {
                "detail": f"{created} erstellt, {updated} aktualisiert.",
                "created": created,
                "updated": updated,
            },
            status=status.HTTP_200_OK,
        )

    @action(
        detail=False,
        methods=["get"],
        url_path="by-student/(?P<student_id>[0-9]+)",
    )
    def by_student(self, request, student_id=None):
        """
        Get all protocols for a specific student.
        Supports date_from and date_to query params.
        """
        qs = self.get_queryset().filter(student_id=student_id)

        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")
        if date_from:
            qs = qs.filter(date__gte=date_from)
        if date_to:
            qs = qs.filter(date__lte=date_to)

        page = self.paginate_queryset(qs)
        if page is not None:
            serializer = DailyProtocolSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = DailyProtocolSerializer(qs, many=True)
        return Response(serializer.data)
