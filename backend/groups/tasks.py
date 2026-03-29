"""
Celery tasks for the groups app.

Handles asynchronous processing of:
- Attendance → DailyProtocol synchronisation (bulk)
- Dashboard cache invalidation after bulk writes
"""

import logging

from celery import shared_task

logger = logging.getLogger(__name__)


@shared_task(
    name="groups.sync_attendance_to_protocols_bulk",
    bind=True,
    max_retries=3,
    default_retry_delay=30,
    acks_late=True,
)
def sync_attendance_to_protocols_bulk(self, records, organization_id, user_id=None):
    """
    Synchronise a batch of attendance records to daily protocols.

    Called from the bulk attendance endpoint after all attendance
    records have been saved.  Runs asynchronously so the HTTP
    response is not blocked.

    Args:
        records: list of dicts with keys:
            - student_id (int)
            - date (str, ISO format)
            - group_id (int)
            - status (str)
        organization_id: int
        user_id: int or None (the user who recorded the attendance)
    """
    from groups.models_attendance import Attendance
    from groups.models_protocol import DailyProtocol

    AUTO_PREFIX = "[Automatisch via Anwesenheit]"
    SYNC_STATUSES = {
        Attendance.Status.SICK,
        Attendance.Status.ABSENT,
        Attendance.Status.EXCUSED,
    }
    STATUS_LABELS = {
        Attendance.Status.SICK: "Krank",
        Attendance.Status.ABSENT: "Abwesend",
        Attendance.Status.EXCUSED: "Beurlaubt",
    }

    synced = 0
    errors = 0

    for rec in records:
        try:
            att_status = rec["status"]
            student_id = rec["student_id"]
            date_str = rec["date"]
            group_id = rec["group_id"]

            if att_status in SYNC_STATUSES:
                label = STATUS_LABELS.get(att_status, att_status)
                auto_note = f"{AUTO_PREFIX} {label}"

                protocol, created = DailyProtocol.objects.get_or_create(
                    student_id=student_id,
                    date=date_str,
                    defaults={
                        "group_id": group_id,
                        "organization_id": organization_id,
                        "incidents": auto_note,
                        "incident_severity": (
                            DailyProtocol.IncidentSeverity.IMPORTANT
                            if att_status == Attendance.Status.SICK
                            else DailyProtocol.IncidentSeverity.NORMAL
                        ),
                        "recorded_by_id": user_id,
                    },
                )

                if not created:
                    existing = protocol.incidents or ""
                    lines = [
                        ln
                        for ln in existing.splitlines()
                        if not ln.startswith(AUTO_PREFIX)
                    ]
                    lines.insert(0, auto_note)
                    protocol.incidents = "\n".join(lines).strip()
                    protocol.incident_severity = (
                        DailyProtocol.IncidentSeverity.IMPORTANT
                        if att_status == Attendance.Status.SICK
                        else DailyProtocol.IncidentSeverity.NORMAL
                    )
                    protocol.save(
                        update_fields=[
                            "incidents",
                            "incident_severity",
                            "updated_at",
                        ]
                    )
                synced += 1

            elif att_status == Attendance.Status.PRESENT:
                try:
                    protocol = DailyProtocol.objects.get(
                        student_id=student_id,
                        date=date_str,
                    )
                    existing = protocol.incidents or ""
                    lines = [
                        ln
                        for ln in existing.splitlines()
                        if not ln.startswith(AUTO_PREFIX)
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
                    synced += 1
                except DailyProtocol.DoesNotExist:
                    pass

        except Exception as exc:
            errors += 1
            logger.exception(
                "Failed to sync attendance→protocol for student=%s date=%s: %s",
                rec.get("student_id"),
                rec.get("date"),
                exc,
            )

    logger.info(
        "Bulk attendance→protocol sync complete: synced=%d errors=%d",
        synced,
        errors,
    )

    # Invalidate dashboard cache after bulk sync
    try:
        from core.cache_utils import invalidate_dashboard_cache

        invalidate_dashboard_cache(organization_id=organization_id)
    except Exception:
        logger.warning("Failed to invalidate dashboard cache", exc_info=True)

    return {"synced": synced, "errors": errors}


@shared_task(
    name="groups.invalidate_dashboard_cache_async",
    ignore_result=True,
)
def invalidate_dashboard_cache_async(organization_id=None):
    """Invalidate dashboard cache asynchronously."""
    from core.cache_utils import invalidate_dashboard_cache

    invalidate_dashboard_cache(organization_id=organization_id)
