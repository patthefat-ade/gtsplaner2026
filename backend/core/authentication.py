"""Custom JWT Authentication backends with automatic tenant resolution.

Includes:
- CookieJWTAuthentication: Reads JWT from httpOnly cookies (primary)
  Falls back to the standard Authorization header (Bearer token) for API clients.
  Automatically resolves tenant context after successful authentication.

Security note (OWASP A04):
  Query parameter authentication (?token=...) has been removed because tokens
  in URLs are logged in browser history, server logs, and referrer headers.
  All downloads now use fetch() with credentials: "include" to send httpOnly
  cookies, eliminating the need for tokens in URLs.

Tenant Resolution:
  After successful JWT authentication, the tenant context is automatically
  resolved and attached to the request object. This eliminates the need for
  manual ensure_tenant_context() calls in every ViewSet.

  Attributes set on request:
    request.tenant: The user's Organization instance (or None)
    request.tenant_id: The user's organization_id (or None)
    request.tenant_ids: List of organization IDs the user can access
    request.is_cross_tenant: Whether the user has cross-tenant access
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

from core.cookie_utils import ACCESS_TOKEN_COOKIE


def _resolve_tenant_context(request, user):
    """
    Resolve and attach tenant context to the request after authentication.

    This is called automatically by CookieJWTAuthentication after successful
    JWT auth. It replaces the manual ensure_tenant_context() calls that were
    previously required in every ViewSet.

    Safe to call multiple times – only resolves once per request.
    """
    if getattr(request, "_tenant_resolved", False):
        return

    request._tenant_resolved = True

    from core.permissions import (
        GROUP_ADMIN,
        GROUP_SUB_ADMIN,
        GROUP_SUPER_ADMIN,
        get_user_group_name,
    )

    # Get user's organization:
    # 1. Primary: direct organization FK on User (for Admins/SubAdmins)
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
        request.is_cross_tenant = False

    elif group_name == GROUP_SUB_ADMIN and organization:
        # SubAdmin: own sub-organization + all descendants (locations)
        request.tenant_ids = organization.get_all_organization_ids(
            include_self=True
        )
        request.is_cross_tenant = False

    elif organization:
        # Educator / LocationManager: only own organization
        request.tenant_ids = [organization.id]
        request.is_cross_tenant = False


class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that reads the access token from an httpOnly cookie.

    Falls back to the standard Authorization header if no cookie is present,
    ensuring backward compatibility with API clients and mobile apps.

    After successful authentication, automatically resolves tenant context
    on the request object. This eliminates the need for manual
    ensure_tenant_context() calls in ViewSets.
    """

    def authenticate(self, request):
        # First try standard header-based authentication (Authorization: Bearer ...)
        header_result = super().authenticate(request)
        if header_result is not None:
            user, token = header_result
            _resolve_tenant_context(request, user)
            return header_result

        # Fall back to httpOnly cookie
        raw_token = request.COOKIES.get(ACCESS_TOKEN_COOKIE)
        if raw_token is None:
            return None

        validated_token = self.get_validated_token(raw_token)
        user = self.get_user(validated_token)
        _resolve_tenant_context(request, user)
        return user, validated_token
