"""
Views for HolidayPeriod and AutonomousDay management.
"""

import django_filters
from rest_framework import permissions, viewsets

from core.mixins import TenantViewSetMixin
from core.permissions import IsEducator, require_permission
from groups.models_calendar import AutonomousDay, HolidayPeriod
from groups.serializers_calendar import (
    AutonomousDayCreateSerializer,
    AutonomousDaySerializer,
    HolidayPeriodCreateSerializer,
    HolidayPeriodSerializer,
)


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


class HolidayPeriodFilter(django_filters.FilterSet):
    school_year = django_filters.NumberFilter(field_name="school_year_id")
    school_year_id = django_filters.NumberFilter(field_name="school_year_id")

    class Meta:
        model = HolidayPeriod
        fields = ["school_year", "school_year_id"]


class AutonomousDayFilter(django_filters.FilterSet):
    school_year = django_filters.NumberFilter(field_name="school_year_id")
    school_year_id = django_filters.NumberFilter(field_name="school_year_id")

    class Meta:
        model = AutonomousDay
        fields = ["school_year", "school_year_id"]


# ---------------------------------------------------------------------------
# ViewSets
# ---------------------------------------------------------------------------


class HolidayPeriodViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for holiday periods within school years.

    Endpoints:
    - GET /holidays/ - List all holiday periods (filterable by school_year)
    - POST /holidays/ - Create a new holiday period
    - GET /holidays/{id}/ - Retrieve a holiday period
    - PATCH /holidays/{id}/ - Update a holiday period
    - DELETE /holidays/{id}/ - Soft-delete a holiday period

    Permissions:
    - Educators: Read access
    - LocationManager+: Full CRUD
    """

    queryset = HolidayPeriod.objects.all()
    filterset_class = HolidayPeriodFilter
    ordering_fields = ["start_date", "created_at"]
    ordering = ["start_date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return HolidayPeriod.objects.none()
        qs = super().get_queryset()
        return qs.filter(is_deleted=False).select_related("school_year")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return HolidayPeriodCreateSerializer
        return HolidayPeriodSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [
            permissions.IsAuthenticated(),
            require_permission("manage_groups")(),
        ]

    def perform_create(self, serializer):
        school_year = serializer.validated_data.get("school_year")
        organization = self.request.tenant or (
            school_year.organization if school_year else None
        )
        serializer.save(organization=organization)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


class AutonomousDayViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for autonomous school days within school years.

    Endpoints:
    - GET /autonomous-days/ - List all autonomous days (filterable by school_year)
    - POST /autonomous-days/ - Create a new autonomous day
    - GET /autonomous-days/{id}/ - Retrieve an autonomous day
    - PATCH /autonomous-days/{id}/ - Update an autonomous day
    - DELETE /autonomous-days/{id}/ - Soft-delete an autonomous day

    Permissions:
    - Educators: Read access
    - LocationManager+: Full CRUD
    """

    queryset = AutonomousDay.objects.all()
    filterset_class = AutonomousDayFilter
    ordering_fields = ["date", "created_at"]
    ordering = ["date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return AutonomousDay.objects.none()
        qs = super().get_queryset()
        return qs.filter(is_deleted=False).select_related("school_year")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return AutonomousDayCreateSerializer
        return AutonomousDaySerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [
            permissions.IsAuthenticated(),
            require_permission("manage_groups")(),
        ]

    def perform_create(self, serializer):
        school_year = serializer.validated_data.get("school_year")
        organization = self.request.tenant or (
            school_year.organization if school_year else None
        )
        serializer.save(organization=organization)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()
