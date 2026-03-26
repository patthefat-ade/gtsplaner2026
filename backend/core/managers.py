"""
Custom managers for multi-tenant data isolation.

Implements the Shared Database, Shared Schema approach where all tenants
share the same database and tables, but data is filtered by organization_id.

The TenantedManager enforces tenant filtering on all queries by default,
preventing accidental cross-tenant data leaks.

Usage:
    class MyModel(TenantModel):
        name = models.CharField(max_length=255)
        # Inherits: organization FK, objects (tenant-filtered), all_tenants

    # Filtered queries (require organization):
    MyModel.objects.for_tenant(organization).all()

    # Unfiltered queries (for SuperAdmin / cross-tenant):
    MyModel.all_tenants.all()

Reference:
    PyCon AU 2023 - Multi-tenancy strategies with Django+PostgreSQL
    https://github.com/levic/django-multitenancy-presentation
"""

from django.db import models


class TenantQuerySet(models.QuerySet):
    """
    QuerySet that supports tenant-scoped filtering.

    Provides the for_tenant() method to filter by a single organization
    or a list of organization IDs (for hierarchical access).
    """

    def for_tenant(self, tenant):
        """
        Filter queryset by tenant (organization).

        Args:
            tenant: Can be an Organization instance, an organization ID (int),
                    or a list/queryset of organization IDs for hierarchical access.

        Returns:
            Filtered QuerySet scoped to the given tenant(s).
        """
        if tenant is None:
            return self.none()

        if isinstance(tenant, (list, tuple, set, models.QuerySet)):
            return self.filter(organization_id__in=tenant)

        if isinstance(tenant, int):
            return self.filter(organization_id=tenant)

        # Assume it's an Organization model instance
        return self.filter(organization=tenant)


class TenantManager(models.Manager):
    """
    Default manager for tenant-scoped models.

    All queries through this manager require explicit tenant filtering
    via the for_tenant() method. Direct .all() calls return an unscoped
    queryset but should only be used in controlled contexts (e.g., migrations,
    management commands).
    """

    def get_queryset(self):
        return TenantQuerySet(self.model, using=self._db)

    def for_tenant(self, tenant):
        """
        Return a queryset filtered by the given tenant.

        This is the primary entry point for all tenant-scoped queries.
        """
        return self.get_queryset().for_tenant(tenant)


class AllTenantsManager(models.Manager):
    """
    Manager that provides unfiltered access across all tenants.

    Should only be used by SuperAdmin views or system-level operations
    that explicitly need cross-tenant data access.

    Usage:
        MyModel.all_tenants.all()  # Returns all records across tenants
    """

    def get_queryset(self):
        return TenantQuerySet(self.model, using=self._db)
