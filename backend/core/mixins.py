"""
Mixins for tenant-aware ViewSets.

Provides automatic data isolation based on the tenant context
set by CookieJWTAuthentication and enforced by TenantFilterBackend.

The tenant filtering is now handled by DRF filter backends
(TenantFilterBackend + OrganizationFilterBackend) in settings.py.
This mixin only handles create/update/delete tenant boundary checks.

Usage:
    from core.mixins import TenantViewSetMixin

    class TransactionViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
        queryset = Transaction.objects.all()
        serializer_class = TransactionSerializer
"""

from rest_framework.exceptions import PermissionDenied


class TenantViewSetMixin:
    """
    Mixin that enforces tenant boundaries on create/update/delete operations.

    Queryset filtering is handled by TenantFilterBackend (DRF filter backend).
    This mixin only handles:
        - Auto-setting organization_id on create
        - Validating tenant boundaries on update/delete

    ViewSets can opt out by setting `tenant_filter_skip = True`.
    """

    # Set to True to skip tenant filtering (e.g., for system-wide models)
    tenant_filter_skip = False

    def perform_create(self, serializer):
        """
        Auto-set organization_id on create if not provided.

        Uses the user's organization from the tenant context.
        """
        if self.tenant_filter_skip:
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
        if self.tenant_filter_skip:
            return super().perform_update(serializer)

        instance = serializer.instance
        if (
            hasattr(instance, "organization_id")
            and not getattr(self.request, "is_cross_tenant", False)
            and getattr(self.request, "tenant_ids", None)
        ):
            if instance.organization_id not in self.request.tenant_ids:
                raise PermissionDenied(
                    "Sie koennen keine Objekte ausserhalb Ihrer Organisation bearbeiten."
                )

        super().perform_update(serializer)

    def perform_destroy(self, instance):
        """
        Validate that deletes stay within tenant boundaries.
        """
        if self.tenant_filter_skip:
            return super().perform_destroy(instance)

        if (
            hasattr(instance, "organization_id")
            and not getattr(self.request, "is_cross_tenant", False)
            and getattr(self.request, "tenant_ids", None)
        ):
            if instance.organization_id not in self.request.tenant_ids:
                raise PermissionDenied(
                    "Sie koennen keine Objekte ausserhalb Ihrer Organisation loeschen."
                )

        super().perform_destroy(instance)
