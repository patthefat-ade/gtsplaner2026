"""
User management API views (admin only).

Provides CRUD operations for managing users within the organization.
Uses request.tenant_ids from TenantMiddleware for proper multi-tenant
data isolation.
"""

from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, viewsets

from core.middleware import ensure_tenant_context
from core.models import User
from core.permissions import IsAdminOrAbove
from core.serializers import (
    UserCreateSerializer,
    UserDetailSerializer,
    UserListSerializer,
    UserUpdateSerializer,
)


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class UserFilter(django_filters.FilterSet):
    """Filter for users."""

    role = django_filters.ChoiceFilter(choices=User.Role.choices)
    location_id = django_filters.NumberFilter(field_name="location_id")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = User
        fields = ["role", "location_id", "is_active"]


# ---------------------------------------------------------------------------
# User Management ViewSet
# ---------------------------------------------------------------------------

@extend_schema_view(
    list=extend_schema(tags=["Users"], summary="Benutzer auflisten"),
    retrieve=extend_schema(tags=["Users"], summary="Benutzer-Details abrufen"),
    create=extend_schema(tags=["Users"], summary="Neuen Benutzer erstellen"),
    update=extend_schema(tags=["Users"], summary="Benutzer aktualisieren"),
    partial_update=extend_schema(tags=["Users"], summary="Benutzer teilweise aktualisieren"),
    destroy=extend_schema(tags=["Users"], summary="Benutzer deaktivieren"),
)
class UserViewSet(viewsets.ModelViewSet):
    """
    CRUD for user management (Admin/SuperAdmin only).

    Uses request.tenant_ids from ensure_tenant_context() for proper
    multi-tenant data isolation:
    - SuperAdmin: sees all users (is_cross_tenant=True)
    - Admin: sees users in own organization + all sub-organizations
    - Other roles: no access (empty queryset)
    """

    filterset_class = UserFilter
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["username", "email", "last_name", "role", "date_joined", "last_login"]
    ordering = ["last_name", "first_name"]
    permission_classes = [permissions.IsAuthenticated, IsAdminOrAbove]

    def get_queryset(self):
        # Ensure tenant context is resolved (lazy resolution for JWT auth)
        ensure_tenant_context(self.request)

        user = self.request.user
        qs = User.objects.select_related("location").filter(is_active=True)

        # SuperAdmin: cross-tenant access, sees all users
        if getattr(self.request, "is_cross_tenant", False):
            return qs

        # Admin: use tenant_ids from TenantMiddleware
        # This includes the admin's own organization + all sub-organizations
        tenant_ids = getattr(self.request, "tenant_ids", [])
        if user.role == "admin" and tenant_ids:
            return qs.filter(location__organization_id__in=tenant_ids)

        # Fallback: no access
        return qs.none()

    def get_serializer_class(self):
        if self.action == "create":
            return UserCreateSerializer
        if self.action in ["update", "partial_update"]:
            return UserUpdateSerializer
        if self.action == "retrieve":
            return UserDetailSerializer
        return UserListSerializer

    def perform_destroy(self, instance):
        """Soft-delete: deactivate user instead of deleting."""
        instance.is_active = False
        instance.save()
