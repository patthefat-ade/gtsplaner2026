"""
Group Transfer model for tracking temporary student group changes.

Enables educators to request temporary transfers of students from their
primary group to another group within the same location. Transfers follow
a confirmation workflow: pending → confirmed/rejected → completed.

All transfers are audit-logged for full traceability.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models

from core.models import TenantModel


class GroupTransfer(TenantModel):
    """
    Tracks a temporary transfer of a student from one group to another
    within the same location. Requires confirmation by the receiving
    group's educator or a location manager.
    """

    class Status(models.TextChoices):
        PENDING = "pending", "Ausstehend"
        CONFIRMED = "confirmed", "Bestaetigt"
        REJECTED = "rejected", "Abgelehnt"
        COMPLETED = "completed", "Abgeschlossen"

    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.CASCADE,
        related_name="transfers",
        verbose_name="Schueler/in",
    )
    source_group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="transfers_out",
        verbose_name="Herkunftsgruppe",
    )
    target_group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="transfers_in",
        verbose_name="Zielgruppe",
    )
    transfer_date = models.DateField(
        verbose_name="Datum des Wechsels",
    )
    start_time = models.TimeField(
        verbose_name="Beginn",
        help_text="Uhrzeit ab der das Kind in der Zielgruppe ist",
    )
    end_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Ende",
        help_text="Uhrzeit bis der das Kind in der Zielgruppe ist (leer = ganzer Tag)",
    )
    reason = models.TextField(
        blank=True,
        default="",
        verbose_name="Grund",
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Status",
    )
    requested_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="transfer_requests",
        verbose_name="Angefragt von",
    )
    confirmed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transfer_confirmations",
        verbose_name="Bestaetigt/Abgelehnt von",
    )
    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Bestaetigt/Abgelehnt am",
    )
    completed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Abgeschlossen am",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notizen",
        help_text="Zusaetzliche Notizen zum Gruppenwechsel",
    )
    is_deleted = models.BooleanField(
        default=False,
        verbose_name="Geloescht",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "groups_grouptransfer"
        verbose_name = "Gruppenwechsel"
        verbose_name_plural = "Gruppenwechsel"
        ordering = ["-transfer_date", "-created_at"]
        indexes = [
            models.Index(fields=["student", "transfer_date"]),
            models.Index(fields=["source_group", "transfer_date"]),
            models.Index(fields=["target_group", "transfer_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["-transfer_date", "-created_at"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.student} → {self.target_group.name} "
            f"({self.transfer_date}, {self.get_status_display()})"
        )

    def clean(self) -> None:
        """Validate that transfer is within the same location."""
        super().clean()
        if self.source_group_id and self.target_group_id:
            if self.source_group.location_id != self.target_group.location_id:
                raise ValidationError(
                    "Gruppenwechsel sind nur innerhalb desselben Standorts moeglich."
                )
            if self.source_group_id == self.target_group_id:
                raise ValidationError(
                    "Herkunfts- und Zielgruppe duerfen nicht identisch sein."
                )
        if self.end_time and self.start_time and self.end_time <= self.start_time:
            raise ValidationError(
                "Die Endzeit muss nach der Startzeit liegen."
            )

    def save(self, *args, **kwargs):
        """Auto-set organization from source_group if not set."""
        if not self.organization_id and self.source_group_id:
            self.organization_id = self.source_group.organization_id
        self.full_clean()
        super().save(*args, **kwargs)
