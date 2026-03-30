"""
Admin panel API views: AuditLog, SystemSettings, and Organization endpoints.

Provides read-only access to audit logs, CRUD for system settings,
and CRUD for organizations (SuperAdmin only).
"""

from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, serializers, viewsets

from core.middleware import ensure_tenant_context
from core.models import Organization
from core.permissions import IsSubAdminOrAbove, IsSuperAdmin
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
    permission_classes = [permissions.IsAuthenticated, IsSubAdminOrAbove]

    def get_queryset(self):
        ensure_tenant_context(self.request)
        qs = AuditLog.objects.select_related("user").all()

        # SubAdmin/Admin: filter audit logs by tenant scope
        if not getattr(self.request, "is_cross_tenant", False):
            tenant_ids = getattr(self.request, "tenant_ids", [])
            if tenant_ids:
                qs = qs.filter(
                    user__location__organization_id__in=tenant_ids
                )
        return qs


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
        if getattr(self, "swagger_fake_view", False):
            return SystemSetting.objects.none()

        user = self.request.user
        if user.role in ["admin", "super_admin", "sub_admin"]:
            return SystemSetting.objects.all()
        return SystemSetting.objects.filter(is_public=True)

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsSubAdminOrAbove()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]


# ---------------------------------------------------------------------------
# Organization Serializer & ViewSet
# ---------------------------------------------------------------------------

class OrganizationSerializer(serializers.ModelSerializer):
    """Serializer for organizations."""

    location_count = serializers.SerializerMethodField()
    parent_name = serializers.CharField(
        source="parent.name", read_only=True, default=None
    )
    children_count = serializers.SerializerMethodField()

    class Meta:
        model = Organization
        fields = [
            "id",
            "name",
            "description",
            "org_type",
            "parent",
            "parent_name",
            "children_count",
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
        read_only_fields = ["id", "created_at", "updated_at", "location_count", "parent_name", "children_count"]

    def get_location_count(self, obj: Organization) -> int:
        return obj.locations.count()

    def get_children_count(self, obj: Organization) -> int:
        return obj.children.filter(is_deleted=False).count()

    def validate(self, attrs):
        org_type = attrs.get("org_type", getattr(self.instance, "org_type", None))
        parent = attrs.get("parent", getattr(self.instance, "parent", None))

        if org_type == "sub_tenant" and not parent:
            raise serializers.ValidationError(
                {"parent": "Untermandanten muessen einem Hauptmandanten zugeordnet werden."}
            )
        if org_type == "main_tenant" and parent:
            raise serializers.ValidationError(
                {"parent": "Hauptmandanten duerfen keinen uebergeordneten Mandanten haben."}
            )
        return attrs


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
    CRUD for organizations.

    - SubAdmin: read-only access to own sub-organization
    - Admin: read-only access (list, retrieve) filtered by tenant
    - SuperAdmin: full CRUD access across all organizations
    """

    serializer_class = OrganizationSerializer
    search_fields = ["name", "city", "country"]
    ordering_fields = ["name", "created_at"]
    ordering = ["name"]

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsSubAdminOrAbove()]
        return [permissions.IsAuthenticated(), IsSuperAdmin()]

    def get_queryset(self):
        # Ensure tenant context is resolved (lazy resolution for JWT auth)
        ensure_tenant_context(self.request)

        qs = Organization.objects.prefetch_related("locations").filter(
            is_deleted=False
        )
        # Admin: filter by tenant_ids (own org + sub-orgs)
        if not getattr(self.request, "is_cross_tenant", False):
            tenant_ids = getattr(self.request, "tenant_ids", [])
            if tenant_ids:
                qs = qs.filter(id__in=tenant_ids)
        return qs

    def perform_destroy(self, instance: Organization) -> None:
        """Soft-delete: mark as deleted instead of removing from DB."""
        instance.is_deleted = True
        instance.is_active = False
        instance.save(update_fields=["is_deleted", "is_active", "updated_at"])
