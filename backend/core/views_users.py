"""
User management API views (admin only).

Provides CRUD operations for managing users within the organization.
"""

from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, viewsets

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

    - List all users with filtering by role, location, active status
    - Create new users with password
    - Update user details
    - Soft-delete (deactivate) users
    """

    filterset_class = UserFilter
    search_fields = ["username", "email", "first_name", "last_name"]
    ordering_fields = ["username", "email", "last_name", "role", "date_joined", "last_login"]
    ordering = ["last_name", "first_name"]
    permission_classes = [permissions.IsAuthenticated, IsAdminOrAbove]

    def get_queryset(self):
        user = self.request.user
        qs = User.objects.select_related("location").filter(is_active=True)
        if user.role == "super_admin":
            return qs
        if user.role == "admin":
            # Admins can see users in their organization
            if user.location and user.location.organization:
                return qs.filter(location__organization=user.location.organization)
            return qs
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
