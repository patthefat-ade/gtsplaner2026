"""
Signals for the groups app.

Synchronises Attendance records with DailyProtocol entries so that
marking a student as sick / absent / excused automatically creates
or updates the corresponding daily protocol.
"""

import logging

from django.db.models.signals import post_save
from django.dispatch import receiver

from groups.models_attendance import Attendance
from groups.models_protocol import DailyProtocol

logger = logging.getLogger(__name__)

# Status values that should trigger a DailyProtocol sync
_SYNC_STATUSES = {
    Attendance.Status.SICK,
    Attendance.Status.ABSENT,
    Attendance.Status.EXCUSED,
}

# Human-readable labels used in the auto-generated incident note
_STATUS_LABELS = {
    Attendance.Status.SICK: "Krank",
    Attendance.Status.ABSENT: "Abwesend",
    Attendance.Status.EXCUSED: "Beurlaubt",
}

_AUTO_PREFIX = "[Automatisch via Anwesenheit]"


@receiver(post_save, sender=Attendance)
def sync_attendance_to_protocol(sender, instance, **kwargs):
    """
    After saving an Attendance record, create or update the
    corresponding DailyProtocol entry when the status indicates
    the student is not present.

    If the student is marked as *present*, any auto-generated
    incident note is cleared (but manually written notes are kept).
    """
    if instance.is_deleted:
        return

    try:
        if instance.status in _SYNC_STATUSES:
            label = _STATUS_LABELS.get(instance.status, instance.status)
            auto_note = f"{_AUTO_PREFIX} {label}"

            protocol, created = DailyProtocol.objects.get_or_create(
                student_id=instance.student_id,
                date=instance.date,
                defaults={
                    "group_id": instance.group_id,
                    "organization_id": instance.organization_id,
                    "incidents": auto_note,
                    "incident_severity": (
                        DailyProtocol.IncidentSeverity.IMPORTANT
                        if instance.status == Attendance.Status.SICK
                        else DailyProtocol.IncidentSeverity.NORMAL
                    ),
                    "recorded_by": instance.recorded_by,
                },
            )

            if not created:
                # Update the existing protocol's incident note
                # Preserve any manually written text that doesn't
                # start with the auto-prefix.
                existing = protocol.incidents or ""
                # Remove old auto-note if present
                lines = [
                    ln
                    for ln in existing.splitlines()
                    if not ln.startswith(_AUTO_PREFIX)
                ]
                lines.insert(0, auto_note)
                protocol.incidents = "\n".join(lines).strip()
                protocol.incident_severity = (
                    DailyProtocol.IncidentSeverity.IMPORTANT
                    if instance.status == Attendance.Status.SICK
                    else DailyProtocol.IncidentSeverity.NORMAL
                )
                protocol.save(
                    update_fields=["incidents", "incident_severity", "updated_at"]
                )

            logger.info(
                "Synced attendance → protocol for student=%s date=%s status=%s created=%s",
                instance.student_id,
                instance.date,
                instance.status,
                created,
            )

        elif instance.status == Attendance.Status.PRESENT:
            # If student is now present, remove auto-generated note
            try:
                protocol = DailyProtocol.objects.get(
                    student_id=instance.student_id,
                    date=instance.date,
                )
                existing = protocol.incidents or ""
                lines = [
                    ln
                    for ln in existing.splitlines()
                    if not ln.startswith(_AUTO_PREFIX)
                ]
                cleaned = "\n".join(lines).strip()
                if cleaned != existing.strip():
                    protocol.incidents = cleaned
                    protocol.incident_severity = (
                        DailyProtocol.IncidentSeverity.NORMAL
                    )
                    protocol.save(
                        update_fields=[
                            "incidents",
                            "incident_severity",
                            "updated_at",
                        ]
                    )
            except DailyProtocol.DoesNotExist:
                pass

    except Exception:
        logger.exception(
            "Failed to sync attendance → protocol for student=%s date=%s",
            instance.student_id,
            instance.date,
        )
