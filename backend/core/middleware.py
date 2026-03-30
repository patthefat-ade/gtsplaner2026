"""
Tenant middleware for multi-tenant data isolation.

Sets default tenant attributes on every request so that downstream code
can safely access request.tenant, request.tenant_ids, etc. without
AttributeError.

Tenant resolution is now handled by CookieJWTAuthentication (for JWT)
and this middleware (for session-authenticated Django Admin users).

The actual queryset filtering is handled by TenantFilterBackend and
OrganizationFilterBackend in core.filters (DRF filter backends).

Must be placed after AuthenticationMiddleware in MIDDLEWARE settings.
"""

from core.authentication import _resolve_tenant_context


def ensure_tenant_context(request):
    """
    Compatibility wrapper for legacy code.

    Tenant context is now automatically resolved by
    CookieJWTAuthentication. This function exists only for backward
    compatibility with code that hasn't been migrated yet.

    Safe to call multiple times – only resolves once per request.
    """
    user = getattr(request, "user", None)
    if user and getattr(user, "is_authenticated", False):
        _resolve_tenant_context(request, user)


class TenantMiddleware:
    """
    Middleware that sets default tenant attributes on every request.

    For session-authenticated users (Django Admin), resolves tenant
    context immediately. For JWT-authenticated API requests, only sets
    defaults – actual resolution happens in CookieJWTAuthentication.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # Set defaults so downstream code never gets AttributeError
        request.tenant = None
        request.tenant_id = None
        request.tenant_ids = []
        request.is_cross_tenant = False
        request._tenant_resolved = False

        # Resolve immediately for session-authenticated users (Django Admin)
        user = getattr(request, "user", None)
        if (
            user is not None
            and hasattr(user, "is_authenticated")
            and user.is_authenticated
        ):
            _resolve_tenant_context(request, user)

        return self.get_response(request)
