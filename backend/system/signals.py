"""
Audit Signals for automatic logging of model changes.

Captures create, update, and delete events for key models
and logs them to the AuditLog.
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


@receiver(post_save)
def audit_post_save(sender, instance, created, **kwargs):
    """Log create and update events for tracked models."""
    if not _should_track(instance):
        return

    # Avoid recursive logging of AuditLog itself
    if sender.__name__ == "AuditLog":
        return

    try:
        from system.models import AuditLog

        action = "create" if created else "update"
        model_name = instance.__class__.__name__
        object_id = str(instance.pk) if instance.pk else ""

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
            user=None,  # Signal-based changes may not have a user context
            action=action,
            model_name=model_name,
            object_id=object_id,
            changes=changes,
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

    try:
        from system.models import AuditLog

        model_name = instance.__class__.__name__
        object_id = str(instance.pk) if instance.pk else ""

        changes = {
            "action": "Eintrag gelöscht",
            "model": model_name,
        }

        try:
            changes["display"] = str(instance)[:200]
        except Exception:
            pass

        AuditLog.objects.create(
            user=None,
            action="delete",
            model_name=model_name,
            object_id=object_id,
            changes=changes,
        )
    except Exception as e:
        logger.error(f"Failed to create audit log via signal: {e}")
