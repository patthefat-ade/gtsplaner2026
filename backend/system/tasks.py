"""
Celery tasks for email notifications and background processing.

Handles asynchronous email sending for:
- Transaction approval/rejection notifications
- Leave request approval/rejection notifications
- Password reset emails
- System notifications
"""

import logging

from celery import shared_task
from django.conf import settings
from django.core.mail import send_mail
from django.template.loader import render_to_string
from django.utils.html import strip_tags

logger = logging.getLogger("kassenbuch.tasks")


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
    try:
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

        # Try template, fallback to plain text
        try:
            html_message = render_to_string("emails/transaction_status.html", context)
            plain_message = strip_tags(html_message)
        except Exception:
            plain_message = (
                f"Hallo {user.first_name},\n\n"
                f"Ihre Transaktion #{transaction.id} ({transaction.description}) "
                f"über € {transaction.amount} wurde {status_display}.\n\n"
                f"Datum: {transaction.transaction_date}\n"
                f"Gruppe: {transaction.group.name if transaction.group else '-'}\n"
                f"Kategorie: {transaction.category.name if transaction.category else '-'}\n"
            )
            if transaction.approved_by:
                plain_message += f"Bearbeitet von: {transaction.approved_by.get_full_name()}\n"
            if hasattr(transaction, "approval_notes") and transaction.approval_notes:
                plain_message += f"Anmerkung: {transaction.approval_notes}\n"
            plain_message += f"\nMit freundlichen Grüßen,\nGTS Planner"
            html_message = None

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            html_message=html_message,
            fail_silently=False,
        )

        logger.info(f"Transaction status notification sent to {user.email} for #{transaction_id}")

    except Exception as exc:
        logger.error(f"Failed to send transaction notification for #{transaction_id}: {exc}")
        raise self.retry(exc=exc)


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
    try:
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
            plain_message += f"Bearbeitet von: {leave.approved_by.get_full_name()}\n"
        if leave.approval_notes:
            plain_message += f"Anmerkung: {leave.approval_notes}\n"
        plain_message += f"\nMit freundlichen Grüßen,\nGTS Planner"

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        logger.info(f"Leave request notification sent to {user.email} for #{leave_request_id}")

    except Exception as exc:
        logger.error(f"Failed to send leave request notification for #{leave_request_id}: {exc}")
        raise self.retry(exc=exc)


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_new_leave_request_notification(self, leave_request_id):
    """
    Notify location managers when a new leave request is submitted.

    Args:
        leave_request_id: ID of the new leave request
    """
    try:
        from core.models import User
        from timetracking.models import LeaveRequest

        leave = LeaveRequest.objects.select_related("user", "leave_type").get(pk=leave_request_id)

        # Find location managers for the user's location
        managers = User.objects.filter(
            role__in=["location_manager", "admin", "super_admin"],
            location=leave.user.location,
            is_active=True,
            is_deleted=False,
        ).exclude(email="")

        if not managers.exists():
            logger.warning(f"No managers found for leave request #{leave_request_id}")
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

    except Exception as exc:
        logger.error(f"Failed to send new leave request notification for #{leave_request_id}: {exc}")
        raise self.retry(exc=exc)


# ---------------------------------------------------------------------------
# Password Reset Notification
# ---------------------------------------------------------------------------


@shared_task(bind=True, max_retries=3, default_retry_delay=60)
def send_password_reset_email(self, user_id, reset_token):
    """
    Send password reset email to user.

    Args:
        user_id: ID of the user requesting reset
        reset_token: Password reset token
    """
    try:
        from core.models import User

        user = User.objects.get(pk=user_id)

        if not user.email:
            logger.warning(f"User #{user_id}: No email address")
            return

        subject = "Passwort zurücksetzen – GTS Planner"

        plain_message = (
            f"Hallo {user.first_name},\n\n"
            f"Sie haben eine Passwort-Zurücksetzung angefordert.\n\n"
            f"Ihr Reset-Code lautet: {reset_token}\n\n"
            f"Falls Sie diese Anfrage nicht gestellt haben, "
            f"ignorieren Sie bitte diese E-Mail.\n\n"
            f"Mit freundlichen Grüßen,\nGTS Planner"
        )

        send_mail(
            subject=subject,
            message=plain_message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[user.email],
            fail_silently=False,
        )

        logger.info(f"Password reset email sent to {user.email}")

    except Exception as exc:
        logger.error(f"Failed to send password reset email for user #{user_id}: {exc}")
        raise self.retry(exc=exc)


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
    try:
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=recipient_emails,
            fail_silently=False,
        )
        logger.info(f"System notification sent to {len(recipient_emails)} recipients")
    except Exception as e:
        logger.error(f"Failed to send system notification: {e}")
