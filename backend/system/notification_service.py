"""
Centralized notification service for configurable email events.

Checks EmailNotificationConfig before sending emails and routes
to the appropriate recipients (user, super_admins, custom).
"""

import logging

from django.conf import settings
from django.core.mail import send_mail

logger = logging.getLogger("kassenbuch.notifications")


def get_notification_config(event_type: str):
    """Get the notification configuration for an event type.

    Returns the config object if the event is enabled, None otherwise.
    Creates a default config if none exists.
    """
    from system.models import EmailNotificationConfig

    config, created = EmailNotificationConfig.objects.get_or_create(
        event_type=event_type,
        defaults={
            "is_enabled": True,
            "notify_super_admins": True,
            "notify_user": True,
        },
    )
    if created:
        logger.info(f"Created default notification config for event: {event_type}")

    if not config.is_enabled:
        logger.debug(f"Notification disabled for event: {event_type}")
        return None

    return config


def get_super_admin_emails() -> list[str]:
    """Get email addresses of all active super admins."""
    from core.models import User

    return list(
        User.objects.filter(
            role="super_admin",
            is_active=True,
            is_deleted=False,
        )
        .exclude(email="")
        .values_list("email", flat=True)
    )


def send_notification_email(
    event_type: str,
    subject: str,
    message: str,
    user_email: str | None = None,
    html_message: str | None = None,
):
    """Send a notification email based on the event configuration.

    Args:
        event_type: The event type from EmailNotificationConfig.EventType
        subject: Email subject line
        message: Plain text email body
        user_email: Email of the affected user (optional)
        html_message: HTML version of the email body (optional)
    """
    config = get_notification_config(event_type)
    if config is None:
        return

    recipients = set()

    # Add user email if configured
    if config.notify_user and user_email:
        recipients.add(user_email)

    # Add super admin emails if configured
    if config.notify_super_admins:
        recipients.update(get_super_admin_emails())

    # Add custom recipients
    recipients.update(config.get_recipients())

    if not recipients:
        logger.warning(f"No recipients for event: {event_type}")
        return

    try:
        send_mail(
            subject=f"[GTS Planner] {subject}",
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=list(recipients),
            html_message=html_message,
            fail_silently=False,
        )
        logger.info(
            f"Notification sent for event '{event_type}' to {len(recipients)} recipients"
        )
    except Exception as exc:
        logger.error(f"Failed to send notification for event '{event_type}': {exc}")
        raise


def notify_new_user_created(user):
    """Notify when a new user account is created."""
    send_notification_email(
        event_type="new_user_created",
        subject=f"Neuer Benutzer: {user.get_full_name()}",
        message=(
            f"Ein neuer Benutzer wurde im GTS Planner erstellt.\n\n"
            f"Name: {user.get_full_name()}\n"
            f"Benutzername: {user.username}\n"
            f"E-Mail: {user.email}\n"
            f"Rolle: {user.get_role_display()}\n\n"
            f"Mit freundlichen Grüßen,\nGTS Planner"
        ),
        user_email=user.email,
    )


def notify_password_changed(user):
    """Notify when a user changes their password."""
    send_notification_email(
        event_type="password_changed",
        subject="Passwort geändert",
        message=(
            f"Hallo {user.first_name},\n\n"
            f"Ihr Passwort im GTS Planner wurde erfolgreich geändert.\n\n"
            f"Falls Sie diese Änderung nicht vorgenommen haben, "
            f"kontaktieren Sie bitte umgehend Ihren Administrator.\n\n"
            f"Mit freundlichen Grüßen,\nGTS Planner"
        ),
        user_email=user.email,
    )


def notify_2fa_status_changed(user, enabled: bool):
    """Notify when 2FA is enabled or disabled."""
    action = "aktiviert" if enabled else "deaktiviert"
    event_type = "2fa_enabled" if enabled else "2fa_disabled"

    send_notification_email(
        event_type=event_type,
        subject=f"Zwei-Faktor-Authentifizierung {action}",
        message=(
            f"Hallo {user.first_name},\n\n"
            f"Die Zwei-Faktor-Authentifizierung für Ihr Konto im GTS Planner "
            f"wurde {action}.\n\n"
            f"Falls Sie diese Änderung nicht vorgenommen haben, "
            f"kontaktieren Sie bitte umgehend Ihren Administrator.\n\n"
            f"Mit freundlichen Grüßen,\nGTS Planner"
        ),
        user_email=user.email,
    )


def notify_terms_accepted(user):
    """Notify super admins when a user accepts terms."""
    send_notification_email(
        event_type="terms_accepted",
        subject=f"Nutzungsbedingungen akzeptiert: {user.get_full_name()}",
        message=(
            f"Der Benutzer {user.get_full_name()} ({user.email}) hat die "
            f"Datenschutzerklärung und Nutzungsbedingungen akzeptiert.\n\n"
            f"Zeitpunkt: {user.terms_accepted_at}\n\n"
            f"Mit freundlichen Grüßen,\nGTS Planner"
        ),
    )


def notify_login_new_device(user, ip_address: str, user_agent: str):
    """Notify when a user logs in from a new device/IP."""
    send_notification_email(
        event_type="login_new_device",
        subject="Anmeldung von neuem Gerät",
        message=(
            f"Hallo {user.first_name},\n\n"
            f"Es wurde eine Anmeldung in Ihrem GTS Planner Konto festgestellt.\n\n"
            f"IP-Adresse: {ip_address}\n"
            f"Gerät: {user_agent[:100]}\n\n"
            f"Falls Sie sich nicht angemeldet haben, ändern Sie bitte "
            f"umgehend Ihr Passwort.\n\n"
            f"Mit freundlichen Grüßen,\nGTS Planner"
        ),
        user_email=user.email,
    )
