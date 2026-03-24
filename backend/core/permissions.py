"""
Custom permission classes for role-based access control (RBAC).

Implements the four-role hierarchy:
  - Educator: Basic access to own data
  - LocationManager: Access to own location's data
  - Admin: Full access to all data within the organization
  - SuperAdmin: Unrestricted access to all data

Usage:
    from core.permissions import IsAdmin, IsLocationManagerOrAbove

    class MyView(APIView):
        permission_classes = [IsAuthenticated, IsAdmin]
"""

from rest_framework.permissions import BasePermission

from core.models import User


class IsEducator(BasePermission):
    """Allow access to users with Educator role or above."""

    message = "Zugriff nur für Pädagoginnen oder höhere Rollen."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [
            User.Role.EDUCATOR,
            User.Role.LOCATION_MANAGER,
            User.Role.ADMIN,
            User.Role.SUPER_ADMIN,
        ]


class IsLocationManager(BasePermission):
    """Allow access only to users with LocationManager role."""

    message = "Zugriff nur für Standortleitungen."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role == User.Role.LOCATION_MANAGER


class IsLocationManagerOrAbove(BasePermission):
    """Allow access to LocationManager, Admin, or SuperAdmin."""

    message = "Zugriff nur für Standortleitungen oder höhere Rollen."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [
            User.Role.LOCATION_MANAGER,
            User.Role.ADMIN,
            User.Role.SUPER_ADMIN,
        ]


class IsAdmin(BasePermission):
    """Allow access only to users with Admin role."""

    message = "Zugriff nur für Administratoren."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role == User.Role.ADMIN


class IsAdminOrAbove(BasePermission):
    """Allow access to Admin or SuperAdmin."""

    message = "Zugriff nur für Administratoren oder Super-Administratoren."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role in [
            User.Role.ADMIN,
            User.Role.SUPER_ADMIN,
        ]


class IsSuperAdmin(BasePermission):
    """Allow access only to SuperAdmin users."""

    message = "Zugriff nur für Super-Administratoren."

    def has_permission(self, request, view) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False
        return request.user.role == User.Role.SUPER_ADMIN


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission: allow access if the user is the owner
    of the object or has Admin/SuperAdmin role.

    Requires the object to have a `user` field or the object itself to be a User.
    """

    message = "Zugriff nur für den Eigentümer oder Administratoren."

    def has_object_permission(self, request, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # Admin and SuperAdmin always have access
        if request.user.role in [User.Role.ADMIN, User.Role.SUPER_ADMIN]:
            return True

        # Check if user is the owner
        if hasattr(obj, "user"):
            return obj.user == request.user
        if isinstance(obj, User):
            return obj == request.user

        return False


class IsLocationMember(BasePermission):
    """
    Object-level permission: allow access if the user belongs
    to the same location as the object.

    Requires the object to have a `location` field.
    """

    message = "Zugriff nur für Mitglieder desselben Standorts."

    def has_object_permission(self, request, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # Admin and SuperAdmin always have access
        if request.user.role in [User.Role.ADMIN, User.Role.SUPER_ADMIN]:
            return True

        # Check if user belongs to the same location
        if hasattr(obj, "location"):
            return request.user.location == obj.location
        if hasattr(obj, "location_id"):
            return request.user.location_id == obj.location_id

        return False


class ReadOnly(BasePermission):
    """Allow read-only access (GET, HEAD, OPTIONS)."""

    def has_permission(self, request, view) -> bool:
        return request.method in ("GET", "HEAD", "OPTIONS")
