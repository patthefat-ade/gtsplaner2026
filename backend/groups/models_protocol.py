"""
Daily Protocol model for tracking daily student activities.
Each student has one protocol per day recording arrival, incidents,
and pickup information. When a student changes groups during the day
(GroupTransfer), the effective_group field tracks which group the
student was actually in.
"""
from django.core.exceptions import ValidationError
from django.db import models

from core.models import TenantModel


class DailyProtocol(TenantModel):
    """
    A daily protocol entry for a student, recording arrival time,
    incidents, and pickup details. Linked to the student's main group
    and optionally to an effective group if a transfer occurred.
    """

    class IncidentSeverity(models.TextChoices):
        NORMAL = "normal", "Normal"
        IMPORTANT = "important", "Wichtig"
        URGENT = "urgent", "Dringend"

    # Core references
    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.CASCADE,
        related_name="daily_protocols",
        verbose_name="Schueler/in",
    )
    date = models.DateField(
        verbose_name="Datum",
    )
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="daily_protocols",
        verbose_name="Hauptgruppe",
        help_text="Die Stammgruppe des Schuelers.",
    )
    effective_group = models.ForeignKey(
        "groups.Group",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="effective_daily_protocols",
        verbose_name="Tatsaechliche Gruppe",
        help_text="Falls der Schueler an diesem Tag die Gruppe gewechselt hat.",
    )
    transfer = models.ForeignKey(
        "groups.GroupTransfer",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="daily_protocols",
        verbose_name="Gruppenwechsel",
        help_text="Verknuepfung zum Gruppenwechsel, falls vorhanden.",
    )
    school_year = models.ForeignKey(
        "groups.SchoolYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="daily_protocols",
        verbose_name="Schuljahr",
    )

    # Arrival
    arrival_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Ankunftszeit",
    )
    arrival_notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Ankunft-Notizen",
        help_text="z.B. von wem gebracht, Besonderheiten bei Ankunft.",
    )

    # Incidents
    incidents = models.TextField(
        blank=True,
        default="",
        verbose_name="Besondere Vorkommnisse",
    )
    incident_severity = models.CharField(
        max_length=20,
        choices=IncidentSeverity.choices,
        default=IncidentSeverity.NORMAL,
        verbose_name="Schweregrad",
    )

    # Pickup
    pickup_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Abholzeit",
    )
    picked_up_by = models.ForeignKey(
        "groups.StudentContact",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="pickups",
        verbose_name="Abgeholt von",
        help_text="Kontaktperson die das Kind abgeholt hat.",
    )
    pickup_notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Abhol-Notizen",
    )

    # Meta
    recorded_by = models.ForeignKey(
        "core.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_protocols",
        verbose_name="Erfasst von",
    )
    is_deleted = models.BooleanField(
        default=False,
        verbose_name="Geloescht",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "groups_dailyprotocol"
        verbose_name = "Tagesprotokoll"
        verbose_name_plural = "Tagesprotokolle"
        ordering = ["-date", "student__last_name"]
        unique_together = ["student", "date"]
        indexes = [
            models.Index(fields=["student", "date"]),
            models.Index(fields=["group", "date"]),
            models.Index(fields=["date"]),
            models.Index(fields=["incident_severity"]),
        ]

    def __str__(self) -> str:
        return f"Protokoll {self.student} – {self.date}"

    def clean(self) -> None:
        """Validate protocol data."""
        super().clean()
        if self.pickup_time and self.arrival_time:
            if self.pickup_time <= self.arrival_time:
                raise ValidationError(
                    "Die Abholzeit muss nach der Ankunftszeit liegen."
                )
        # Validate picked_up_by belongs to the student
        if self.picked_up_by_id and self.student_id:
            if self.picked_up_by.student_id != self.student_id:
                raise ValidationError(
                    "Die Abholperson muss eine Kontaktperson des Schuelers sein."
                )

    def save(self, *args, **kwargs):
        """Auto-set organization and check for group transfer."""
        if not self.organization_id and self.student_id:
            self.organization_id = self.student.group.organization_id
        # Auto-set group from student's main group
        if not self.group_id and self.student_id:
            self.group_id = self.student.group_id
        # Auto-detect group transfer for this date
        if not self.transfer_id and self.student_id and self.date:
            from groups.models_transfer import GroupTransfer

            transfer = GroupTransfer.objects.filter(
                student_id=self.student_id,
                transfer_date=self.date,
                status__in=["confirmed", "completed"],
                is_deleted=False,
            ).first()
            if transfer:
                self.transfer = transfer
                self.effective_group_id = transfer.target_group_id
        self.full_clean()
        super().save(*args, **kwargs)
