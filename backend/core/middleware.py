"""
Tenant middleware for multi-tenant data isolation.

Extracts the tenant context (Organization) from the authenticated user
and attaches it to the request object. All downstream views can then
use request.tenant and request.tenant_ids for data filtering.

Must be placed after AuthenticationMiddleware in MIDDLEWARE settings.

IMPORTANT: For DRF API requests using JWT authentication, the user is
NOT yet authenticated during middleware execution (JWT auth happens in
the DRF view layer). Therefore, this middleware sets defaults and the
actual tenant resolution happens via `ensure_tenant_context()` which
is called by TenantViewSetMixin and MeView.

Attributes set on request:
    request.tenant: The user's Organization instance (or None)
    request.tenant_id: The user's organization_id (or None)
    request.tenant_ids: List of organization IDs the user can access
        - Educator/LocationManager: Only their own organization
        - Admin: Own organization + all sub-organizations
        - SuperAdmin: All organizations (empty list = no filter needed)
    request.is_cross_tenant: Whether the user has cross-tenant access
"""

from core.permissions import (
    GROUP_ADMIN,
    GROUP_SUPER_ADMIN,
    get_user_group_name,
)


def ensure_tenant_context(request):
    """
    Resolve and set tenant context on the request if not already done.

    This function is safe to call multiple times – it only resolves once.
    It should be called from any view or mixin that needs tenant context,
    AFTER DRF authentication has run.

    This is the canonical way to ensure tenant context is available,
    regardless of whether the request was authenticated via Django
    session auth (middleware) or DRF JWT auth (view layer).
    """
    # Already resolved? Skip.
    if getattr(request, "_tenant_resolved", False):
        return

    # Mark as resolved to prevent re-entry
    request._tenant_resolved = True

    user = getattr(request, "user", None)
    if user is None or not getattr(user, "is_authenticated", False):
        return

    # Get user's organization:
    # 1. Primary: direct organization FK on User (for Admins)
    # 2. Fallback: via user.location.organization (for Educators/LocationManagers)
    organization = getattr(user, "organization", None)
    if organization is None:
        location = getattr(user, "location", None)
        if location and hasattr(location, "organization"):
            organization = location.organization

    request.tenant = organization
    request.tenant_id = organization.id if organization else None

    # Determine accessible organization IDs based on role
    group_name = get_user_group_name(user)

    if group_name == GROUP_SUPER_ADMIN:
        # SuperAdmin: cross-tenant access, empty list means "no filter"
        request.tenant_ids = []
        request.is_cross_tenant = True

    elif group_name == GROUP_ADMIN and organization:
        # Admin: own organization + all descendants
        request.tenant_ids = organization.get_all_organization_ids(
            include_self=True
        )
        # Admin is NEVER cross-tenant – they always filter by tenant_ids.
        # Only SuperAdmin has unrestricted cross-tenant access.
        request.is_cross_tenant = False

    elif organization:
        # Educator / LocationManager: only own organization
        request.tenant_ids = [organization.id]
        request.is_cross_tenant = False


class TenantMiddleware:
    """
    Middleware that sets default tenant context on every request.

    For session-authenticated users (Django admin), resolves immediately.
    For JWT-authenticated API requests, sets defaults only – actual
    resolution happens via ensure_tenant_context() in the view layer.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Set defaults
        request.tenant = None
        request.tenant_id = None
        request.tenant_ids = []
        request.is_cross_tenant = False
        request._tenant_resolved = False

        # Try immediate resolution for session-authenticated users
        user = getattr(request, "user", None)
        if (
            user is not None
            and hasattr(user, "is_authenticated")
            and user.is_authenticated
        ):
            ensure_tenant_context(request)

        return self.get_response(request)
