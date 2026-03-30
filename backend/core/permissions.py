"""
Custom permission classes for role-based access control (RBAC).

Implements a hybrid approach:
  - Django Permission Groups (auth.Group + auth.Permission) for fine-grained control
  - Legacy role field support during migration period
  - Tenant-aware object-level permissions

The five-role hierarchy is mapped to Django Groups:
  - Educator: Basic access to own data
  - LocationManager: Access to own location's data
  - SubAdmin: Full access to all data within the sub-tenant
  - Admin: Full access to all data within the organization (main tenant)
  - SuperAdmin: Unrestricted access to all data (cross-tenant)

Usage:
    from core.permissions import HasPermission, IsSubAdminOrAbove

    class MyView(APIView):
        permission_classes = [IsAuthenticated, HasPermission("manage_groups")]
"""

from rest_framework.permissions import BasePermission

from core.models import User

# Group name constants
GROUP_EDUCATOR = "Educator"
GROUP_LOCATION_MANAGER = "LocationManager"
GROUP_SUB_ADMIN = "SubAdmin"
GROUP_ADMIN = "Admin"
GROUP_SUPER_ADMIN = "SuperAdmin"

# Hierarchy levels for comparison (5 levels)
GROUP_HIERARCHY = {
    GROUP_EDUCATOR: 1,
    GROUP_LOCATION_MANAGER: 2,
    GROUP_SUB_ADMIN: 3,
    GROUP_ADMIN: 4,
    GROUP_SUPER_ADMIN: 5,
}

# Mapping from legacy role field to group name
ROLE_TO_GROUP = {
    User.Role.EDUCATOR: GROUP_EDUCATOR,
    User.Role.LOCATION_MANAGER: GROUP_LOCATION_MANAGER,
    User.Role.SUB_ADMIN: GROUP_SUB_ADMIN,
    User.Role.ADMIN: GROUP_ADMIN,
    User.Role.SUPER_ADMIN: GROUP_SUPER_ADMIN,
}


def get_user_group_name(user) -> str | None:
    """
    Get the highest-level group name for a user.

    Checks Django Groups first, falls back to legacy role field.
    """
    if not user or not user.is_authenticated:
        return None

    # Check Django Groups (preferred)
    user_groups = set(user.groups.values_list("name", flat=True))
    if user_groups:
        # Return the highest-level group
        best_group = None
        best_level = 0
        for group_name in user_groups:
            level = GROUP_HIERARCHY.get(group_name, 0)
            if level > best_level:
                best_level = level
                best_group = group_name
        if best_group:
            return best_group

    # Fallback to legacy role field
    return ROLE_TO_GROUP.get(user.role)


def get_user_hierarchy_level(user) -> int:
    """Get the hierarchy level of a user (1=Educator, 5=SuperAdmin)."""
    group_name = get_user_group_name(user)
    return GROUP_HIERARCHY.get(group_name, 0)


def user_has_perm(user, perm_codename: str) -> bool:
    """
    Check if a user has a specific permission.

    Checks Django permissions first, then falls back to role-based logic.
    """
    if not user or not user.is_authenticated:
        return False

    # SuperAdmin always has all permissions
    if get_user_group_name(user) == GROUP_SUPER_ADMIN:
        return True

    # Check Django permissions (includes group permissions)
    return user.has_perm(f"core.{perm_codename}")


class HasPermission(BasePermission):
    """
    Generic permission class that checks for a specific Django permission.

    Usage:
        permission_classes = [IsAuthenticated, HasPermission("manage_groups")]
    """

    def __init__(self, perm_codename: str):
        self.perm_codename = perm_codename

    def has_permission(self, request, view) -> bool:
        return user_has_perm(request.user, self.perm_codename)


def require_permission(perm_codename: str):
    """
    Factory function to create a permission class for a specific permission.

    Usage in ViewSets:
        permission_classes = [IsAuthenticated, require_permission("manage_groups")]
    """

    class _Permission(BasePermission):
        message = f"Berechtigung '{perm_codename}' erforderlich."

        def has_permission(self, request, view) -> bool:
            return user_has_perm(request.user, perm_codename)

    _Permission.__name__ = f"Require_{perm_codename}"
    _Permission.__qualname__ = f"Require_{perm_codename}"
    return _Permission


class IsEducator(BasePermission):
    """Allow access to users with Educator role or above."""

    message = "Zugriff nur fuer Paedagoginnen oder hoehere Rollen."

    def has_permission(self, request, view) -> bool:
        return get_user_hierarchy_level(request.user) >= GROUP_HIERARCHY[GROUP_EDUCATOR]


class IsLocationManager(BasePermission):
    """Allow access only to users with LocationManager role."""

    message = "Zugriff nur fuer Standortleitungen."

    def has_permission(self, request, view) -> bool:
        return get_user_group_name(request.user) == GROUP_LOCATION_MANAGER


class IsLocationManagerOrAbove(BasePermission):
    """Allow access to LocationManager, SubAdmin, Admin, or SuperAdmin."""

    message = "Zugriff nur fuer Standortleitungen oder hoehere Rollen."

    def has_permission(self, request, view) -> bool:
        return get_user_hierarchy_level(request.user) >= GROUP_HIERARCHY[GROUP_LOCATION_MANAGER]


class IsSubAdmin(BasePermission):
    """Allow access only to users with SubAdmin role."""

    message = "Zugriff nur fuer Sub-Mandanten-Administratoren."

    def has_permission(self, request, view) -> bool:
        return get_user_group_name(request.user) == GROUP_SUB_ADMIN


class IsSubAdminOrAbove(BasePermission):
    """Allow access to SubAdmin, Admin, or SuperAdmin."""

    message = "Zugriff nur fuer Sub-Mandanten-Administratoren oder hoehere Rollen."

    def has_permission(self, request, view) -> bool:
        return get_user_hierarchy_level(request.user) >= GROUP_HIERARCHY[GROUP_SUB_ADMIN]


class IsAdmin(BasePermission):
    """Allow access only to users with Admin role."""

    message = "Zugriff nur fuer Administratoren."

    def has_permission(self, request, view) -> bool:
        return get_user_group_name(request.user) == GROUP_ADMIN


class IsAdminOrAbove(BasePermission):
    """Allow access to Admin or SuperAdmin."""

    message = "Zugriff nur fuer Administratoren oder Super-Administratoren."

    def has_permission(self, request, view) -> bool:
        return get_user_hierarchy_level(request.user) >= GROUP_HIERARCHY[GROUP_ADMIN]


class IsSuperAdmin(BasePermission):
    """Allow access only to SuperAdmin users."""

    message = "Zugriff nur fuer Super-Administratoren."

    def has_permission(self, request, view) -> bool:
        return get_user_group_name(request.user) == GROUP_SUPER_ADMIN


class IsOwnerOrAdmin(BasePermission):
    """
    Object-level permission: allow access if the user is the owner
    of the object or has SubAdmin/Admin/SuperAdmin role.
    """

    message = "Zugriff nur fuer den Eigentuemer oder Administratoren."

    def has_object_permission(self, request, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # SubAdmin, Admin and SuperAdmin always have access
        if get_user_hierarchy_level(request.user) >= GROUP_HIERARCHY[GROUP_SUB_ADMIN]:
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
    """

    message = "Zugriff nur fuer Mitglieder desselben Standorts."

    def has_object_permission(self, request, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # SubAdmin, Admin and SuperAdmin always have access
        if get_user_hierarchy_level(request.user) >= GROUP_HIERARCHY[GROUP_SUB_ADMIN]:
            return True

        # Check if user belongs to the same location
        if hasattr(obj, "location"):
            return request.user.location == obj.location
        if hasattr(obj, "location_id"):
            return request.user.location_id == obj.location_id

        return False


class IsTenantMember(BasePermission):
    """
    Object-level permission: allow access if the user belongs
    to the same organization as the object.

    Works with any model that has an 'organization' or 'organization_id' field.
    """

    message = "Zugriff nur fuer Mitglieder derselben Organisation."

    def has_object_permission(self, request, view, obj) -> bool:
        if not request.user or not request.user.is_authenticated:
            return False

        # SuperAdmin has cross-tenant access
        if get_user_group_name(request.user) == GROUP_SUPER_ADMIN:
            return True

        # Check tenant membership via request.tenant_ids
        if hasattr(request, "tenant_ids") and request.tenant_ids:
            if hasattr(obj, "organization_id"):
                return obj.organization_id in request.tenant_ids

        # Fallback: check via user's organization
        if hasattr(request.user, "organization_id") and request.user.organization_id:
            if hasattr(obj, "organization_id"):
                return request.user.organization_id == obj.organization_id

        return False


class ReadOnly(BasePermission):
    """Allow read-only access (GET, HEAD, OPTIONS)."""

    def has_permission(self, request, view) -> bool:
        return request.method in ("GET", "HEAD", "OPTIONS")
