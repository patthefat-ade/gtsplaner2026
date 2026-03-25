"""
System models for Kassenbuch App v2.

Contains AuditLog and SystemSetting models for system-wide
configuration and audit trail functionality.
"""

from django.conf import settings
from django.db import models


class AuditLog(models.Model):
    """Immutable audit log for tracking all critical system actions."""

    class Action(models.TextChoices):
        CREATE = "create", "Erstellt"
        UPDATE = "update", "Aktualisiert"
        DELETE = "delete", "Gelöscht"
        LOGIN = "login", "Anmeldung"
        LOGOUT = "logout", "Abmeldung"
        APPROVE = "approve", "Genehmigt"
        REJECT = "reject", "Abgelehnt"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="audit_logs",
        verbose_name="Benutzer",
    )
    action = models.CharField(max_length=20, choices=Action.choices, verbose_name="Aktion")
    model_name = models.CharField(max_length=100, verbose_name="Modell")
    object_id = models.CharField(max_length=100, blank=True, verbose_name="Objekt-ID")
    changes = models.JSONField(default=dict, blank=True, verbose_name="Änderungen")
    ip_address = models.GenericIPAddressField(null=True, blank=True, verbose_name="IP-Adresse")
    user_agent = models.TextField(blank=True, verbose_name="User-Agent")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")

    class Meta:
        db_table = "system_auditlog"
        verbose_name = "Audit-Log"
        verbose_name_plural = "Audit-Logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["action"]),
            models.Index(fields=["model_name"]),
            models.Index(fields=["-created_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} – {self.get_action_display()} – {self.model_name} ({self.created_at})"


class SystemSetting(models.Model):
    """Key-value store for system-wide configuration settings."""

    key = models.CharField(max_length=255, unique=True, verbose_name="Schlüssel")
    value = models.TextField(verbose_name="Wert")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    is_public = models.BooleanField(default=False, verbose_name="Öffentlich")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "system_setting"
        verbose_name = "Systemeinstellung"
        verbose_name_plural = "Systemeinstellungen"
        ordering = ["key"]

    def __str__(self) -> str:
        return f"{self.key} = {self.value[:50]}"


class EmailNotificationConfig(models.Model):
    """Configuration for email notification events.

    SuperAdmins can enable/disable specific notification events.
    Each event type maps to a Celery task that sends the email.
    """

    class EventType(models.TextChoices):
        NEW_USER_CREATED = "new_user_created", "Neuer Benutzer erstellt"
        PASSWORD_CHANGED = "password_changed", "Passwort geändert"
        PASSWORD_RESET = "password_reset", "Passwort zurückgesetzt"
        LOGIN_NEW_DEVICE = "login_new_device", "Login von neuem Gerät"
        TWO_FA_ENABLED = "2fa_enabled", "2FA aktiviert"
        TWO_FA_DISABLED = "2fa_disabled", "2FA deaktiviert"
        TRANSACTION_CREATED = "transaction_created", "Transaktion erstellt"
        TRANSACTION_APPROVED = "transaction_approved", "Transaktion genehmigt"
        TRANSACTION_REJECTED = "transaction_rejected", "Transaktion abgelehnt"
        LEAVE_REQUEST_CREATED = "leave_request_created", "Urlaubsantrag erstellt"
        LEAVE_REQUEST_APPROVED = "leave_request_approved", "Urlaubsantrag genehmigt"
        LEAVE_REQUEST_REJECTED = "leave_request_rejected", "Urlaubsantrag abgelehnt"
        TERMS_ACCEPTED = "terms_accepted", "Nutzungsbedingungen akzeptiert"
        SYSTEM_ALERT = "system_alert", "System-Warnung"

    event_type = models.CharField(
        max_length=50,
        choices=EventType.choices,
        unique=True,
        verbose_name="Ereignistyp",
    )
    is_enabled = models.BooleanField(
        default=True,
        verbose_name="Aktiviert",
        help_text="Ob E-Mail-Benachrichtigungen für dieses Ereignis gesendet werden.",
    )
    notify_super_admins = models.BooleanField(
        default=True,
        verbose_name="Super-Admins benachrichtigen",
        help_text="Ob Super-Admins bei diesem Ereignis per E-Mail benachrichtigt werden.",
    )
    notify_user = models.BooleanField(
        default=True,
        verbose_name="Betroffenen Benutzer benachrichtigen",
        help_text="Ob der betroffene Benutzer per E-Mail benachrichtigt wird.",
    )
    custom_recipients = models.TextField(
        blank=True,
        verbose_name="Zusätzliche Empfänger",
        help_text="Kommagetrennte E-Mail-Adressen für zusätzliche Benachrichtigungen.",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "system_email_notification_config"
        verbose_name = "E-Mail-Benachrichtigung"
        verbose_name_plural = "E-Mail-Benachrichtigungen"
        ordering = ["event_type"]

    def __str__(self) -> str:
        status = "aktiv" if self.is_enabled else "deaktiviert"
        return f"{self.get_event_type_display()} ({status})"

    def get_recipients(self) -> list[str]:
        """Return list of custom recipient email addresses."""
        if not self.custom_recipients:
            return []
        return [e.strip() for e in self.custom_recipients.split(",") if e.strip()]
