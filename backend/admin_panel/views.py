"""
Admin panel API views: AuditLog, SystemSettings, and Organization endpoints.

Provides read-only access to audit logs, CRUD for system settings,
and CRUD for organizations (SuperAdmin only).
"""

from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, serializers, viewsets

from core.models import Organization
from core.permissions import IsAdminOrAbove, IsSuperAdmin
from system.models import AuditLog, SystemSetting


# ---------------------------------------------------------------------------
# Serializers (inline for admin panel)
# ---------------------------------------------------------------------------

class AdminUserCompactSerializer(serializers.Serializer):
    """Compact user representation for admin panel."""

    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class AuditLogSerializer(serializers.ModelSerializer):
    """Serializer for audit log entries."""

    user = AdminUserCompactSerializer(read_only=True)

    class Meta:
        model = AuditLog
        fields = [
            "id",
            "user",
            "action",
            "model_name",
            "object_id",
            "changes",
            "ip_address",
            "created_at",
        ]
        read_only_fields = fields


class SystemSettingSerializer(serializers.ModelSerializer):
    """Serializer for system settings."""

    class Meta:
        model = SystemSetting
        fields = [
            "id",
            "key",
            "value",
            "description",
            "is_public",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class AuditLogFilter(django_filters.FilterSet):
    """Filter for audit logs."""

    user_id = django_filters.NumberFilter(field_name="user_id")
    action = django_filters.CharFilter()
    model_name = django_filters.CharFilter()
    start_date = django_filters.DateFilter(field_name="created_at", lookup_expr="date__gte")
    end_date = django_filters.DateFilter(field_name="created_at", lookup_expr="date__lte")

    class Meta:
        model = AuditLog
        fields = ["user_id", "action", "model_name", "start_date", "end_date"]


# ---------------------------------------------------------------------------
# AuditLog ViewSet
# ---------------------------------------------------------------------------

@extend_schema_view(
    list=extend_schema(tags=["Admin"], summary="Audit-Log auflisten"),
    retrieve=extend_schema(tags=["Admin"], summary="Audit-Log-Eintrag abrufen"),
)
class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    """
    Read-only access to audit log entries (Admin/SuperAdmin only).
    """

    serializer_class = AuditLogSerializer
    filterset_class = AuditLogFilter
    search_fields = ["model_name", "action", "ip_address"]
    ordering_fields = ["created_at", "action", "model_name"]
    ordering = ["-created_at"]
    permission_classes = [permissions.IsAuthenticated, IsAdminOrAbove]

    def get_queryset(self):
        return AuditLog.objects.select_related("user").all()


# ---------------------------------------------------------------------------
# SystemSetting ViewSet
# ---------------------------------------------------------------------------

@extend_schema_view(
    list=extend_schema(tags=["Admin"], summary="Systemeinstellungen auflisten"),
    retrieve=extend_schema(tags=["Admin"], summary="Systemeinstellung abrufen"),
    create=extend_schema(tags=["Admin"], summary="Systemeinstellung erstellen"),
    update=extend_schema(tags=["Admin"], summary="Systemeinstellung aktualisieren"),
    partial_update=extend_schema(tags=["Admin"], summary="Systemeinstellung teilweise aktualisieren"),
    destroy=extend_schema(tags=["Admin"], summary="Systemeinstellung loeschen"),
)
class SystemSettingViewSet(viewsets.ModelViewSet):
    """
    CRUD for system settings (SuperAdmin only for write, Admin for read).
    """

    serializer_class = SystemSettingSerializer
    search_fields = ["key", "description"]
    ordering_fields = ["key", "created_at"]
    ordering = ["key"]

    def get_queryset(self):
        user = self.request.user
        if user.role in ["admin", "super_admin"]:
            return SystemSetting.objects.all()
        return SystemSetting.objects.filter(is_public=True)

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsAdminOrAbove()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]


# ---------------------------------------------------------------------------
# Organization Serializer & ViewSet
# ---------------------------------------------------------------------------

class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for organizations."""

    location_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "description",
            "email",
            "phone",
            "website",
            "street",
            "city",
            "postal_code",
            "country",
            "is_active",
            "location_count",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "location_count"]

    def get_location_count(self, obj: Organization) -> int:
        return obj.locations.count()


@extend_schema_view(
    list=extend_schema(tags=["Admin"], summary="Organisationen auflisten"),
    retrieve=extend_schema(tags=["Admin"], summary="Organisation abrufen"),
    create=extend_schema(tags=["Admin"], summary="Organisation erstellen"),
    update=extend_schema(tags=["Admin"], summary="Organisation aktualisieren"),
    partial_update=extend_schema(tags=["Admin"], summary="Organisation teilweise aktualisieren"),
    destroy=extend_schema(tags=["Admin"], summary="Organisation loeschen"),
)
class OrganizationViewSet(viewsets.ModelViewSet):
    """
    CRUD for organizations (SuperAdmin only).
    """

    serializer_class = OrganizationSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]
    search_fields = ["name", "city", "country"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        return Organization.objects.prefetch_related("locations").filter(
            is_deleted=False
        )

    def perform_destroy(self, instance: Organization) -> None:
        """Soft-delete: mark as deleted instead of removing from DB."""
        instance.is_deleted = True
        instance.is_active = False
        instance.save(update_fields=["is_deleted", "is_active", "updated_at"])
