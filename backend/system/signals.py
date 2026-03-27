"""
Audit Signals for automatic logging of model changes.

Captures create, update, and delete events for key models
and logs them to the AuditLog.

**Deduplication:** If the ``AuditLoggingMiddleware`` has already logged
the current request, the signal handler skips its own entry to avoid
duplicates.  This means API-triggered changes are logged by the
middleware (with full request context), while admin/CLI/Celery changes
are logged by the signal handler.

**User resolution:** The current user is read from thread-local storage
(set by ``CurrentUserMiddleware``).  If no user is available (e.g.
management commands), ``user=None`` is stored.

Organization is automatically resolved from the instance if available,
allowing proper tenant-scoping of audit entries.
"""

import logging

from django.db.models.signals import post_delete, post_save
from django.dispatch import receiver

logger = logging.getLogger("kassenbuch.audit")

# Models to track via signals (for admin and non-API changes)
TRACKED_MODELS = [
    "core.User",
    "core.Organization",
    "core.Location",
    "finance.Transaction",
    "finance.TransactionCategory",
    "finance.Receipt",
    "timetracking.TimeEntry",
    "timetracking.LeaveRequest",
    "timetracking.LeaveType",
    "groups.Group",
    "groups.Student",
    "groups.SchoolYear",
    "groups.GroupMember",
    "system.SystemSetting",
]


def _get_model_label(instance):
    """Get the app_label.ModelName for an instance."""
    return f"{instance._meta.app_label}.{instance.__class__.__name__}"


def _should_track(instance):
    """Check if this model instance should be tracked."""
    model_label = _get_model_label(instance)
    return model_label in TRACKED_MODELS


def _resolve_organization(instance):
    """
    Try to resolve the organization from the instance.

    Checks in order:
    1. instance.organization (TenantModel instances)
    2. instance.organization (Organization model itself -> use self)
    3. instance.location.organization (User model via location)
    4. None (system-level actions without tenant context)
    """
    # Direct organization FK (TenantModel subclasses)
    org = getattr(instance, "organization", None)
    if org is not None:
        from core.models import Organization

        if isinstance(org, Organization):
            return org
        if isinstance(org, int):
            try:
                return Organization.objects.get(pk=org)
            except Organization.DoesNotExist:
                return None

    # For Organization model itself
    from core.models import Organization

    if isinstance(instance, Organization):
        return instance

    # For User model: try location -> organization
    location = getattr(instance, "location", None)
    if location is not None:
        org = getattr(location, "organization", None)
        if org is not None:
            return org

    return None


@receiver(post_save)
def audit_post_save(sender, instance, created, **kwargs):
    """Log create and update events for tracked models."""
    if not _should_track(instance):
        return

    # Avoid recursive logging of AuditLog itself
    if sender.__name__ == "AuditLog":
        return

    # ── Deduplication: skip if middleware already logged this request ──
    from system.middleware import is_audit_logged_by_middleware

    if is_audit_logged_by_middleware():
        return

    try:
        from system.models import AuditLog
        from system.thread_local import get_current_user

        action = "create" if created else "update"
        model_name = instance.__class__.__name__
        object_id = str(instance.pk) if instance.pk else ""
        organization = _resolve_organization(instance)

        # Resolve user from thread-local (set by CurrentUserMiddleware)
        user = get_current_user()

        # Build a summary of changes
        changes = {}
        if created:
            changes["action"] = "Neuer Eintrag erstellt"
            changes["model"] = model_name
        else:
            changes["action"] = "Eintrag aktualisiert"
            changes["model"] = model_name

        # Try to add a human-readable representation
        try:
            changes["display"] = str(instance)[:200]
        except Exception:
            pass

        AuditLog.objects.create(
            user=user,
            action=action,
            model_name=model_name,
            object_id=object_id,
            changes=changes,
            organization=organization,
        )
    except Exception as e:
        logger.error(f"Failed to create audit log via signal: {e}")


@receiver(post_delete)
def audit_post_delete(sender, instance, **kwargs):
    """Log delete events for tracked models."""
    if not _should_track(instance):
        return

    if sender.__name__ == "AuditLog":
        return

    # ── Deduplication ──
    from system.middleware import is_audit_logged_by_middleware

    if is_audit_logged_by_middleware():
        return

    try:
        from system.models import AuditLog
        from system.thread_local import get_current_user

        model_name = instance.__class__.__name__
        object_id = str(instance.pk) if instance.pk else ""
        organization = _resolve_organization(instance)
        user = get_current_user()

        changes = {
            "action": "Eintrag geloescht",
            "model": model_name,
        }

        try:
            changes["display"] = str(instance)[:200]
        except Exception:
            pass

        AuditLog.objects.create(
            user=user,
            action="delete",
            model_name=model_name,
            object_id=object_id,
            changes=changes,
            organization=organization,
        )
    except Exception as e:
        logger.error(f"Failed to create audit log via signal: {e}")
