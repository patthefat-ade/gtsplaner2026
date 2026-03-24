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
