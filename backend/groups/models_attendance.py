"""
Attendance models for tracking student presence in groups.

Provides daily attendance tracking for students with status options
(present, absent, sick, excused) and optional notes.
"""

from django.conf import settings
from django.db import models

from core.models import TenantModel


class Attendance(TenantModel):
    """
    Daily attendance record for a student in a group.

    Each record tracks whether a student was present, absent, sick,
    or excused on a given date. Only one record per student per date
    is allowed (enforced via unique_together).

    Tenant isolation is provided by TenantModel (organization FK).
    """

    class Status(models.TextChoices):
        PRESENT = "present", "Anwesend"
        ABSENT = "absent", "Abwesend"
        SICK = "sick", "Krank"
        EXCUSED = "excused", "Beurlaubt"

    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.CASCADE,
        related_name="attendances",
        verbose_name="Schüler:in",
    )
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="attendances",
        verbose_name="Gruppe",
    )
    date = models.DateField(
        verbose_name="Datum",
        db_index=True,
    )
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PRESENT,
        verbose_name="Status",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notizen",
    )
    recorded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="recorded_attendances",
        verbose_name="Erfasst von",
    )
    is_deleted = models.BooleanField(
        default=False,
        verbose_name="Gelöscht",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-date", "student__first_name"]
        unique_together = [("student", "date")]
        indexes = [
            models.Index(fields=["group", "date"]),
            models.Index(fields=["student", "date"]),
            models.Index(fields=["date", "status"]),
        ]
        verbose_name = "Anwesenheit"
        verbose_name_plural = "Anwesenheiten"

    def __str__(self):
        return f"{self.student} - {self.date} - {self.get_status_display()}"

    def save(self, *args, **kwargs):
        """Auto-set organization from group if not set."""
        if not self.organization_id and self.group_id:
            self.organization_id = self.group.organization_id
        super().save(*args, **kwargs)
