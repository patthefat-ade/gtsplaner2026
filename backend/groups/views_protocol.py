"""Views for DailyProtocol model."""
import django_filters
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from groups.models import Group, Student
from groups.models_protocol import DailyProtocol
from groups.models_transfer import GroupTransfer
from groups.serializers_protocol import (
    BulkDailyProtocolSerializer,
    DailyProtocolCreateSerializer,
    DailyProtocolSerializer,
)


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


class DailyProtocolViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    ViewSet for DailyProtocol CRUD operations.

    Provides:
    - Standard CRUD (list, create, retrieve, update, destroy)
    - Bulk create/update for a group on a specific date
    - By-student endpoint for protocol history
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

        created = 0
        updated = 0

        for record in records:
            student_id = record.get("student_id")
            if not student_id:
                continue

            # Verify student belongs to group or has a transfer
            student_exists = Student.objects.filter(
                id=student_id, group_id=group_id, is_deleted=False
            ).exists()

            # Also check if student has a transfer to this group
            if not student_exists:
                has_transfer = GroupTransfer.objects.filter(
                    student_id=student_id,
                    target_group_id=group_id,
                    transfer_date=date,
                    status__in=["confirmed", "completed"],
                    is_deleted=False,
                ).exists()
                if not has_transfer:
                    continue

            # Check for existing transfer
            transfer = GroupTransfer.objects.filter(
                student_id=student_id,
                transfer_date=date,
                status__in=["confirmed", "completed"],
                is_deleted=False,
            ).first()

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

            obj, was_created = DailyProtocol.objects.update_or_create(
                student_id=student_id,
                date=date,
                defaults=defaults,
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
