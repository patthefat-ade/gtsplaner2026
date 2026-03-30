"""
Mixins for tenant-aware ViewSets.

Provides automatic data isolation based on the tenant context
set by TenantMiddleware. All ViewSets that handle tenant-scoped
data should inherit from TenantViewSetMixin.

Usage:
    from core.mixins import TenantViewSetMixin

    class TransactionViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
        queryset = Transaction.objects.all()
        serializer_class = TransactionSerializer
"""

from rest_framework import status
from rest_framework.response import Response

from core.middleware import apply_organization_filter, ensure_tenant_context


class TenantViewSetMixin:
    """
    Mixin that automatically filters querysets by tenant (organization).

    Calls ensure_tenant_context() to lazily resolve tenant context
    after DRF JWT authentication has run. This is necessary because
    the TenantMiddleware runs before DRF authentication.

    Behavior based on user role:
        - SuperAdmin (is_cross_tenant=True, tenant_ids=[]): No filter, sees all data
        - Admin with main tenant: Sees own org + all sub-orgs
        - SubAdmin: Sees own sub-org + all descendants (locations)
        - LocationManager/Educator: Sees only own organization's data

    SuperAdmin and Admin can use ?organization_id= to filter by sub-tenant.

    Also auto-sets organization_id on create operations.
    """

    # Set to True to skip tenant filtering (e.g., for system-wide models)
    skip_tenant_filter = False

    def get_queryset(self):
        """
        Filter queryset by tenant context from request.

        Ensures tenant context is resolved before filtering.
        """
        # Ensure tenant context is resolved (lazy resolution for JWT auth)
        ensure_tenant_context(self.request)

        # Apply optional ?organization_id= filter for SuperAdmin/Admin
        if hasattr(self.request, "query_params"):
            apply_organization_filter(self.request)

        qs = super().get_queryset()

        if self.skip_tenant_filter:
            return qs

        if not hasattr(self.request, "tenant_ids"):
            return qs

        # SuperAdmin without filter: no filter needed
        if self.request.is_cross_tenant:
            return qs

        # Filter by accessible organization IDs
        tenant_ids = self.request.tenant_ids
        if tenant_ids:
            # Check if model has organization field (TenantModel)
            if hasattr(qs.model, "organization"):
                qs = qs.filter(organization_id__in=tenant_ids)

        return qs

    def perform_create(self, serializer):
        """
        Auto-set organization_id on create if not provided.

        Uses the user's organization from the tenant context.
        """
        ensure_tenant_context(self.request)

        if self.skip_tenant_filter:
            return super().perform_create(serializer)

        # Only set organization if the model has the field and it's not already set
        model = serializer.Meta.model if hasattr(serializer, "Meta") else None
        if model and hasattr(model, "organization"):
            extra_kwargs = {}
            if "organization" not in serializer.validated_data:
                if self.request.tenant:
                    extra_kwargs["organization"] = self.request.tenant
                elif self.request.tenant_id:
                    extra_kwargs["organization_id"] = self.request.tenant_id
            serializer.save(**extra_kwargs)
        else:
            super().perform_create(serializer)

    def perform_update(self, serializer):
        """
        Validate that updates stay within tenant boundaries.

        Prevents users from moving objects to a different organization.
        """
        ensure_tenant_context(self.request)

        if self.skip_tenant_filter:
            return super().perform_update(serializer)

        instance = serializer.instance
        if (
            hasattr(instance, "organization_id")
            and not self.request.is_cross_tenant
            and self.request.tenant_ids
        ):
            # Ensure the object belongs to the user's tenant
            if instance.organization_id not in self.request.tenant_ids:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "Sie koennen keine Objekte ausserhalb Ihrer Organisation bearbeiten."
                )

        super().perform_update(serializer)

    def perform_destroy(self, instance):
        """
        Validate that deletes stay within tenant boundaries.
        """
        ensure_tenant_context(self.request)

        if self.skip_tenant_filter:
            return super().perform_destroy(instance)

        if (
            hasattr(instance, "organization_id")
            and not self.request.is_cross_tenant
            and self.request.tenant_ids
        ):
            if instance.organization_id not in self.request.tenant_ids:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "Sie koennen keine Objekte ausserhalb Ihrer Organisation loeschen."
                )

        super().perform_destroy(instance)
