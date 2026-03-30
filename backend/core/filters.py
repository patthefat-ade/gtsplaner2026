"""
Tenant-aware DRF filter backends.

Provides automatic tenant-based data isolation via DRF's filter backend
mechanism. This replaces the manual ensure_tenant_context() and
apply_organization_filter() calls that were previously scattered across
every ViewSet.

Usage:
    # Global (settings.py DEFAULT_FILTER_BACKENDS):
    "core.filters.TenantFilterBackend",
    "core.filters.OrganizationFilterBackend",

    # Per-ViewSet override to skip tenant filtering:
    class SystemSettingViewSet(viewsets.ModelViewSet):
        tenant_filter_skip = True

Architecture:
    1. CookieJWTAuthentication resolves tenant context on request
       (request.tenant_ids, request.is_cross_tenant)
    2. TenantFilterBackend applies tenant isolation on every queryset
    3. OrganizationFilterBackend applies optional ?organization_id= filter
       for SuperAdmin/Admin users

    This is a clean separation of concerns:
    - Authentication layer: WHO is the user and WHAT can they see?
    - Filter layer: APPLY the visibility rules to the queryset
    - View layer: Business logic only, no tenant boilerplate
"""

from rest_framework.filters import BaseFilterBackend

from core.permissions import (
    GROUP_ADMIN,
    GROUP_SUPER_ADMIN,
    get_user_group_name,
)


class TenantFilterBackend(BaseFilterBackend):
    """
    DRF filter backend that automatically filters querysets by tenant.

    Reads request.tenant_ids (set by CookieJWTAuthentication) and filters
    the queryset to only include objects belonging to the user's accessible
    organizations.

    Behavior:
        - SuperAdmin (is_cross_tenant=True): No filter, sees all data
        - Admin: Sees own org + all sub-orgs
        - SubAdmin: Sees own sub-org + all descendants
        - Educator/LocationManager: Sees only own organization's data

    ViewSets can opt out by setting `tenant_filter_skip = True`.
    """

    def filter_queryset(self, request, queryset, view):
        # Allow ViewSets to opt out of tenant filtering
        if getattr(view, "tenant_filter_skip", False):
            return queryset

        # If tenant context is not resolved (unauthenticated), skip
        if not getattr(request, "_tenant_resolved", False):
            return queryset

        # SuperAdmin without organization filter: no filter needed
        if getattr(request, "is_cross_tenant", False):
            return queryset

        # Filter by accessible organization IDs
        tenant_ids = getattr(request, "tenant_ids", None)
        if not tenant_ids:
            return queryset

        # Check if model has organization field (TenantModel)
        if hasattr(queryset.model, "organization"):
            queryset = queryset.filter(organization_id__in=tenant_ids)

        return queryset


class OrganizationFilterBackend(BaseFilterBackend):
    """
    DRF filter backend for optional ?organization_id= filtering.

    Allows SuperAdmin and Admin users to narrow their view to a specific
    sub-organization. This replaces the apply_organization_filter()
    middleware function.

    Query parameter:
        ?organization_id=<int>  - Filter by specific organization and its descendants

    Behavior:
        - SuperAdmin: Can filter by any organization
        - Admin: Can filter only within their own tenant hierarchy
        - SubAdmin/Educator/LocationManager: Parameter is ignored

    When the filter is applied, request.tenant_ids and request.is_cross_tenant
    are updated so that downstream code (e.g., dashboard views) can also
    use the filtered context.
    """

    def filter_queryset(self, request, queryset, view):
        # Allow ViewSets to opt out
        if getattr(view, "tenant_filter_skip", False):
            return queryset

        org_id = request.query_params.get("organization_id")
        if not org_id:
            return queryset

        try:
            org_id = int(org_id)
        except (ValueError, TypeError):
            return queryset

        group_name = get_user_group_name(request.user)

        # Only SuperAdmin and Admin can use this filter
        if group_name not in (GROUP_SUPER_ADMIN, GROUP_ADMIN):
            return queryset

        # Admin can only filter within their own tenant hierarchy
        if group_name == GROUP_ADMIN:
            if org_id not in getattr(request, "tenant_ids", []):
                return queryset

        from core.models import Organization

        org = Organization.objects.filter(
            id=org_id, is_active=True, is_deleted=False
        ).first()
        if not org:
            return queryset

        # Narrow tenant_ids to the filtered organization + descendants
        filtered_ids = org.get_all_organization_ids(include_self=True)
        request.tenant_ids = filtered_ids
        request.is_cross_tenant = False

        # Apply the filter to the queryset
        if hasattr(queryset.model, "organization"):
            queryset = queryset.filter(organization_id__in=filtered_ids)

        return queryset
