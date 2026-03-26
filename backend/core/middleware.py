"""
Tenant middleware for multi-tenant data isolation.

Extracts the tenant context (Organization) from the authenticated user
and attaches it to the request object. All downstream views can then
use request.tenant and request.tenant_ids for data filtering.

Must be placed after AuthenticationMiddleware in MIDDLEWARE settings.

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


class TenantMiddleware:
    """
    Middleware that sets tenant context on every request.

    For authenticated users, determines which organizations they can
    access based on their role and organization hierarchy.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Set defaults
        request.tenant = None
        request.tenant_id = None
        request.tenant_ids = []
        request.is_cross_tenant = False

        if hasattr(request, "user") and request.user.is_authenticated:
            user = request.user

            # Get user's organization
            organization = getattr(user, "location", None)
            if organization and hasattr(organization, "organization"):
                organization = organization.organization
            else:
                organization = None

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
                # If the organization is a main tenant, it's cross-tenant
                request.is_cross_tenant = organization.is_main_tenant

            elif organization:
                # Educator / LocationManager: only own organization
                request.tenant_ids = [organization.id]
                request.is_cross_tenant = False

        return self.get_response(request)
