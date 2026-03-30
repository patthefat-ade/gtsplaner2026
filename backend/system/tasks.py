"""
Celery tasks for email notifications and background processing.

Handles asynchronous email sending for:
- Transaction approval/rejection notifications
- Leave request approval/rejection notifications
- Password reset emails
- Task assignment and status change notifications
- System notifications
- GDPR data retention cleanup
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger("kassenbuch.tasks")


def _get_frontend_url():
    """Return the configured frontend URL."""
    return getattr(settings, "FRONTEND_URL", "https://www.gtsplaner.app")


def _render_email(template_name, context, fallback_plain):
    """
    Render an HTML email template with plain-text fallback.

    Returns a tuple (plain_message, html_message).
    If the template cannot be rendered, html_message is None.
    """
    context.setdefault("frontend_url", _get_frontend_url())
    html_message = render_to_string(template_name, context)
    plain_message = strip_tags(html_message)
    return plain_message, html_message


# ---------------------------------------------------------------------------
# Transaction Notifications
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_transaction_status_notification(self, transaction_id, new_status):
    """
    Send email notification when a transaction status changes.

    Args:
        transaction_id: ID of the transaction
        new_status: New status (approved, rejected)
    """
    from finance.models import Transaction

    transaction = Transaction.objects.select_related(
        "created_by", "approved_by", "group", "category"
    ).get(pk=transaction_id)

    user = transaction.created_by
    if not user or not user.email:
        logger.warning(f"Transaction #{transaction_id}: No email for user")
        return

    status_display = {
        "approved": "genehmigt",
        "rejected": "abgelehnt",
    }.get(new_status, new_status)

    subject = f"Transaktion #{transaction.id} wurde {status_display}"

    context = {
        "user": user,
        "transaction": transaction,
        "status_display": status_display,
        "approved_by": transaction.approved_by,
        "site_name": "GTS Planner",
    }

    plain_fallback = (
        f"Hallo {user.first_name},\n\n"
        f"Ihre Transaktion #{transaction.id} ({transaction.description}) "
        f"über € {transaction.amount} wurde {status_display}.\n\n"
        f"Mit freundlichen Grüßen,\nGTS Planner"
    )

    plain_message, html_message = _render_email(
        "emails/transaction_status.html", context, plain_fallback
    )

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )

    logger.info(
        f"Transaction status notification sent to {user.email} for #{transaction_id}"
    )


# ---------------------------------------------------------------------------
# Leave Request Notifications
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_leave_request_status_notification(self, leave_request_id, new_status):
    """
    Send email notification when a leave request status changes.

    Args:
        leave_request_id: ID of the leave request
        new_status: New status (approved, rejected)
    """
    from timetracking.models import LeaveRequest

    leave = LeaveRequest.objects.select_related(
        "user", "leave_type", "approved_by"
    ).get(pk=leave_request_id)

    user = leave.user
    if not user or not user.email:
        logger.warning(f"LeaveRequest #{leave_request_id}: No email for user")
        return

    status_display = {
        "approved": "genehmigt",
        "rejected": "abgelehnt",
    }.get(new_status, new_status)

    subject = f"Urlaubsantrag #{leave.id} wurde {status_display}"

    plain_message = (
        f"Hallo {user.first_name},\n\n"
        f"Ihr Urlaubsantrag #{leave.id} wurde {status_display}.\n\n"
        f"Typ: {leave.leave_type.name if leave.leave_type else '-'}\n"
        f"Zeitraum: {leave.start_date} bis {leave.end_date}\n"
        f"Tage: {leave.total_days}\n"
    )
    if leave.approved_by:
        plain_message += (
            f"Bearbeitet von: {leave.approved_by.get_full_name()}\n"
        )
    if leave.approval_notes:
        plain_message += f"Anmerkung: {leave.approval_notes}\n"
    plain_message += "\nMit freundlichen Grüßen,\nGTS Planner"

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        fail_silently=False,
    )

    logger.info(
        f"Leave request notification sent to {user.email} for #{leave_request_id}"
    )


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_new_leave_request_notification(self, leave_request_id):
    """
    Notify location managers when a new leave request is submitted.

    Args:
        leave_request_id: ID of the new leave request
    """
    from core.models import User
    from timetracking.models import LeaveRequest

    leave = LeaveRequest.objects.select_related("user", "leave_type").get(
        pk=leave_request_id
    )

    # Find location managers for the user's location
    managers = User.objects.filter(
        role__in=["location_manager", "admin", "super_admin"],
        location=leave.user.location,
        is_active=True,
        is_deleted=False,
    ).exclude(email="")

    if not managers.exists():
        logger.warning(
            f"No managers found for leave request #{leave_request_id}"
        )
        return

    subject = f"Neuer Urlaubsantrag von {leave.user.get_full_name()}"

    plain_message = (
        f"Ein neuer Urlaubsantrag wurde eingereicht.\n\n"
        f"Mitarbeiter:in: {leave.user.get_full_name()}\n"
        f"Typ: {leave.leave_type.name if leave.leave_type else '-'}\n"
        f"Zeitraum: {leave.start_date} bis {leave.end_date}\n"
        f"Tage: {leave.total_days}\n"
        f"Grund: {leave.reason or '-'}\n\n"
        f"Bitte genehmigen oder ablehnen Sie diesen Antrag im GTS Planner.\n\n"
        f"Mit freundlichen Grüßen,\nGTS Planner"
    )

    recipient_list = list(managers.values_list("email", flat=True))

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipient_list,
        fail_silently=False,
    )

    logger.info(
        f"New leave request notification sent to {len(recipient_list)} managers "
        f"for #{leave_request_id}"
    )


# ---------------------------------------------------------------------------
# Password Reset Notification
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, user_id, reset_link):
    """
    Send password reset email to user with a link to the frontend reset page.

    Uses an HTML template with a plain-text fallback.

    Args:
        user_id: ID of the user requesting reset
        reset_link: Full URL to the frontend password reset page with uid and token
    """
    from core.models import User

    user = User.objects.get(pk=user_id)

    if not user.email:
        logger.warning(f"User #{user_id}: No email address")
        return

    subject = "Passwort zurücksetzen – GTS Planner"

    context = {
        "first_name": user.first_name or user.username,
        "reset_link": reset_link,
    }

    plain_fallback = (
        f"Hallo {user.first_name},\n\n"
        f"Sie haben eine Passwort-Zurücksetzung angefordert.\n\n"
        f"Klicken Sie auf den folgenden Link, um Ihr Passwort zurückzusetzen:\n"
        f"{reset_link}\n\n"
        f"Dieser Link ist 24 Stunden gültig.\n\n"
        f"Falls Sie diese Anfrage nicht gestellt haben, "
        f"ignorieren Sie bitte diese E-Mail.\n\n"
        f"Mit freundlichen Grüßen,\nGTS Planner"
    )

    plain_message, html_message = _render_email(
        "emails/password_reset.html", context, plain_fallback
    )

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[user.email],
        html_message=html_message,
        fail_silently=False,
    )

    logger.info(f"Password reset email sent to {user.email}")


# ---------------------------------------------------------------------------
# Task Notifications (NEW – Sprint 57)
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_task_assigned_email(self, task_id):
    """
    Send email notification when a task is assigned to a user.

    Args:
        task_id: ID of the newly created/assigned task
    """
    from tasks.models import Task

    task = Task.objects.select_related(
        "assigned_to", "created_by", "location", "organization"
    ).get(pk=task_id)

    recipient = task.assigned_to
    if not recipient or not recipient.email:
        logger.warning(f"Task #{task_id}: No email for assigned user")
        return

    priority_labels = dict(Task.Priority.choices)
    subject = f"Neue Aufgabe: {task.title}"

    context = {
        "assigned_to_name": recipient.get_full_name() or recipient.username,
        "task_title": task.title,
        "description": task.description,
        "priority_display": priority_labels.get(task.priority, task.priority),
        "due_date": task.due_date.strftime("%d.%m.%Y") if task.due_date else "-",
        "created_by_name": (
            task.created_by.get_full_name() if task.created_by else "-"
        ),
        "location_name": task.location.name if task.location else None,
    }

    plain_fallback = (
        f"Hallo {recipient.first_name},\n\n"
        f"Ihnen wurde eine neue Aufgabe zugewiesen: {task.title}\n\n"
        f"Priorität: {context['priority_display']}\n"
        f"Stichtag: {context['due_date']}\n"
        f"Erstellt von: {context['created_by_name']}\n\n"
        f"Mit freundlichen Grüßen,\nGTS Planner"
    )

    plain_message, html_message = _render_email(
        "emails/task_assigned.html", context, plain_fallback
    )

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient.email],
        html_message=html_message,
        fail_silently=False,
    )

    logger.info(
        f"Task assignment email sent to {recipient.email} for task #{task_id}"
    )


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_task_status_changed_email(self, task_id, old_status, new_status, changed_by_id):
    """
    Send email notification when a task status changes.

    Args:
        task_id: ID of the task
        old_status: Previous status string
        new_status: New status string
        changed_by_id: ID of the user who changed the status
    """
    from core.models import User
    from tasks.models import Task

    task = Task.objects.select_related("created_by", "assigned_to").get(pk=task_id)
    changed_by = User.objects.get(pk=changed_by_id)

    # Notify the task creator (if they didn't make the change themselves)
    recipient = task.created_by
    if not recipient or not recipient.email or recipient.pk == changed_by_id:
        logger.info(
            f"Task #{task_id}: Skipping status email (creator is the changer or no email)"
        )
        return

    status_labels = dict(Task.Status.choices)
    subject = f"Aufgabe aktualisiert: {task.title}"

    context = {
        "recipient_name": recipient.get_full_name() or recipient.username,
        "task_title": task.title,
        "old_status_display": status_labels.get(old_status, old_status),
        "new_status_display": status_labels.get(new_status, new_status),
        "changed_by_name": changed_by.get_full_name() or changed_by.username,
    }

    plain_fallback = (
        f"Hallo {recipient.first_name},\n\n"
        f"Der Status der Aufgabe \"{task.title}\" wurde von "
        f"\"{context['old_status_display']}\" auf \"{context['new_status_display']}\" "
        f"geändert.\n\n"
        f"Geändert von: {context['changed_by_name']}\n\n"
        f"Mit freundlichen Grüßen,\nGTS Planner"
    )

    plain_message, html_message = _render_email(
        "emails/task_status_changed.html", context, plain_fallback
    )

    send_mail(
        subject=subject,
        message=plain_message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=[recipient.email],
        html_message=html_message,
        fail_silently=False,
    )

    logger.info(
        f"Task status change email sent to {recipient.email} for task #{task_id}"
    )


# ---------------------------------------------------------------------------
# System Notification
# ---------------------------------------------------------------------------


@shared_task
def send_system_notification(subject, message, recipient_emails):
    """
    Send a generic system notification email.

    Args:
        subject: Email subject
        message: Email body (plain text)
        recipient_emails: List of email addresses
    """
    send_mail(
        subject=subject,
        message=message,
        from_email=settings.DEFAULT_FROM_EMAIL,
        recipient_list=recipient_emails,
        fail_silently=False,
    )
    logger.info(f"System notification sent to {len(recipient_emails)} recipients")


# ---------------------------------------------------------------------------
# GDPR/DSGVO Data Retention Tasks
# ---------------------------------------------------------------------------


@shared_task
def gdpr_cleanup_expired_data():
    """
    Automatically delete anonymized records that have exceeded the
    configured data retention period.

    Runs daily via Celery Beat. The retention period is configurable
    via SystemSetting 'data_retention_years' (default: 7 years).

    This task:
    1. Finds all anonymized Users and Students older than retention period
    2. Permanently deletes their associated records (cascade)
    3. Cleans up old AuditLog entries beyond retention period
    4. Logs all deletions for compliance
    """
    from datetime import timedelta

    from django.utils import timezone

    from core.models import User
    from groups.models import Student
    from system.models import AuditLog, SystemSetting

    # Get retention period from SystemSetting (default: 7 years)
    retention_years = 7
    setting = SystemSetting.objects.filter(key="data_retention_years").first()
    if setting:
        retention_years = int(setting.value)

    cutoff_date = timezone.now() - timedelta(days=retention_years * 365)

    # Delete anonymized users past retention period
    expired_users = User.objects.filter(
        anonymized_at__isnull=False,
        anonymized_at__lt=cutoff_date,
    )
    user_count = expired_users.count()
    if user_count > 0:
        expired_users.delete()
        logger.info(
            f"GDPR cleanup: Permanently deleted {user_count} anonymized users "
            f"(retention: {retention_years} years)"
        )

    # Delete anonymized students past retention period
    expired_students = Student.objects.filter(
        anonymized_at__isnull=False,
        anonymized_at__lt=cutoff_date,
    )
    student_count = expired_students.count()
    if student_count > 0:
        expired_students.delete()
        logger.info(
            f"GDPR cleanup: Permanently deleted {student_count} anonymized students "
            f"(retention: {retention_years} years)"
        )

    # Clean up old audit logs past retention period
    expired_logs = AuditLog.objects.filter(
        created_at__lt=cutoff_date,
    )
    log_count = expired_logs.count()
    if log_count > 0:
        expired_logs.delete()
        logger.info(
            f"GDPR cleanup: Permanently deleted {log_count} audit log entries "
            f"(retention: {retention_years} years)"
        )

    total = user_count + student_count + log_count
    if total == 0:
        logger.info("GDPR cleanup: No expired data found")

    return {
        "deleted_users": user_count,
        "deleted_students": student_count,
        "deleted_audit_logs": log_count,
        "retention_years": retention_years,
    }
