"""
Cache utility functions for invalidating dashboard and other caches.

Usage:
    from core.cache_utils import invalidate_dashboard_cache

    # After a write operation that affects dashboard stats:
    invalidate_dashboard_cache(organization_id=instance.organization_id)
"""

import logging

from django.core.cache import cache

logger = logging.getLogger(__name__)


def invalidate_dashboard_cache(organization_id=None):
    """
    Invalidate dashboard cache entries.

    If Redis is not available, this is a no-op (graceful degradation).
    Uses a pattern-based approach: we store a version counter per
    organization that changes on invalidation, making old cache keys
    stale.

    For simplicity, we clear all dashboard keys. In production with
    Redis, this could be optimised with cache tags or key patterns.
    """
    try:
        # Simple approach: delete all keys matching the dashboard prefix.
        # Django's Redis backend supports delete_pattern if using
        # django-redis, but the built-in backend does not.
        # We use a version counter instead.
        if organization_id:
            version_key = f"dashboard:version:{organization_id}"
            current = cache.get(version_key, 0)
            cache.set(version_key, current + 1, timeout=None)
        else:
            # Global invalidation (SuperAdmin view)
            cache.set("dashboard:version:global", 0, timeout=0)

        logger.debug(
            "Dashboard cache invalidated for org=%s", organization_id
        )
    except Exception:
        logger.warning(
            "Failed to invalidate dashboard cache for org=%s",
            organization_id,
            exc_info=True,
        )


def get_cache_key_with_version(base_key, organization_id=None):
    """
    Build a versioned cache key that auto-invalidates when the
    version counter changes.
    """
    if organization_id:
        version = cache.get(f"dashboard:version:{organization_id}", 0)
        return f"{base_key}:v{version}"
    return base_key
