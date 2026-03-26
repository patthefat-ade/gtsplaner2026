"""
Timetracking models for the Kassenbuch App v2.

Contains TimeEntry, LeaveType, LeaveRequest, and WorkingHoursLimit models
for managing time tracking, leave management, and working hour compliance.

All tenant-scoped models inherit from TenantModel for automatic
organization-based data isolation.
"""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantModel


class TimeEntry(TenantModel):
    """
    A single time entry for an educator working with a group.

    Records the start and end time, with automatic duration calculation.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="time_entries",
        verbose_name="Benutzer",
    )
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="time_entries",
        verbose_name="Gruppe",
    )
    date = models.DateField(verbose_name="Datum")
    start_time = models.TimeField(verbose_name="Startzeit")
    end_time = models.TimeField(verbose_name="Endzeit")
    duration_minutes = models.IntegerField(
        verbose_name="Dauer (Minuten)",
        help_text="Berechnet aus Endzeit - Startzeit",
        editable=False,
        default=0,
    )
    notes = models.TextField(blank=True, verbose_name="Notizen")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "timetracking_timeentry"
        verbose_name = "Zeiteintrag"
        verbose_name_plural = "Zeiteintraege"
        ordering = ["-date", "-start_time"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["group"]),
            models.Index(fields=["date"]),
            models.Index(fields=["user", "date"]),
        ]

    def save(self, *args, **kwargs):
        """Calculate duration_minutes and auto-set organization before saving."""
        from datetime import datetime

        start = datetime.combine(self.date, self.start_time)
        end = datetime.combine(self.date, self.end_time)
        delta = end - start
        self.duration_minutes = int(delta.total_seconds() / 60)

        if not self.organization_id and self.group_id:
            self.organization_id = self.group.organization_id

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (
            f"{self.user.get_full_name()} - {self.date} "
            f"({self.start_time}-{self.end_time}, {self.duration_minutes} Min.)"
        )


class LeaveType(TenantModel):
    """
    Types of leave/absence (e.g., Urlaub, Krankheit, Fortbildung).

    Each location can define its own leave types with optional approval requirements.
    """

    location = models.ForeignKey(
        "core.Location",
        on_delete=models.CASCADE,
        related_name="leave_types",
        verbose_name="Standort",
    )
    name = models.CharField(max_length=100, verbose_name="Name")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    requires_approval = models.BooleanField(
        default=True,
        verbose_name="Genehmigung erforderlich",
    )
    max_days_per_year = models.IntegerField(
        null=True,
        blank=True,
        verbose_name="Max. Tage pro Jahr",
        help_text="Maximale Anzahl an Tagen pro Jahr (leer = unbegrenzt)",
    )
    is_system_type = models.BooleanField(
        default=False,
        verbose_name="Systemtyp",
        help_text="Systemtypen koennen nicht geloescht werden.",
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "timetracking_leavetype"
        verbose_name = "Abwesenheitstyp"
        verbose_name_plural = "Abwesenheitstypen"
        ordering = ["name"]
        unique_together = [("location", "name")]

    def __str__(self) -> str:
        return f"{self.name} ({self.location.name})"

    def save(self, *args, **kwargs):
        """Auto-set organization from location if not set."""
        if not self.organization_id and self.location_id:
            self.organization_id = self.location.organization_id
        super().save(*args, **kwargs)


class LeaveRequest(TenantModel):
    """
    A leave/absence request from an educator.

    Follows an approval workflow: draft -> pending -> approved/rejected/cancelled.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Entwurf"
        PENDING = "pending", "Ausstehend"
        APPROVED = "approved", "Genehmigt"
        REJECTED = "rejected", "Abgelehnt"
        CANCELLED = "cancelled", "Storniert"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="leave_requests",
        verbose_name="Benutzer",
    )
    leave_type = models.ForeignKey(
        LeaveType,
        on_delete=models.SET_NULL,
        null=True,
        related_name="leave_requests",
        verbose_name="Abwesenheitstyp",
    )
    start_date = models.DateField(verbose_name="Startdatum")
    end_date = models.DateField(verbose_name="Enddatum")
    total_days = models.IntegerField(
        verbose_name="Gesamttage",
        help_text="Berechnet aus Enddatum - Startdatum + 1",
        editable=False,
        default=1,
    )
    reason = models.TextField(verbose_name="Begruendung")
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name="Status",
    )
    approved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_leave_requests",
        verbose_name="Genehmigt von",
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Genehmigt am",
    )
    approval_notes = models.TextField(blank=True, verbose_name="Genehmigungsnotizen")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "timetracking_leaverequest"
        verbose_name = "Abwesenheitsantrag"
        verbose_name_plural = "Abwesenheitsantraege"
        ordering = ["-start_date"]
        indexes = [
            models.Index(fields=["user"]),
            models.Index(fields=["leave_type"]),
            models.Index(fields=["status"]),
            models.Index(fields=["start_date"]),
        ]

    def save(self, *args, **kwargs):
        """Calculate total_days and auto-set organization before saving."""
        self.total_days = (self.end_date - self.start_date).days + 1

        if not self.organization_id and self.user_id:
            user = self.user
            if hasattr(user, "location") and user.location:
                self.organization_id = user.location.organization_id

        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return (
            f"{self.user.get_full_name()} - {self.leave_type} "
            f"({self.start_date} bis {self.end_date}, {self.get_status_display()})"
        )


class WorkingHoursLimit(TenantModel):
    """
    Working hours limits and break policies for a location.

    Defines maximum working hours per day/week and mandatory break rules.
    """

    location = models.OneToOneField(
        "core.Location",
        on_delete=models.CASCADE,
        related_name="working_hours_limit",
        verbose_name="Standort",
    )
    max_hours_per_week = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=40,
        verbose_name="Max. Stunden pro Woche",
    )
    max_hours_per_day = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=8,
        verbose_name="Max. Stunden pro Tag",
    )
    min_break_duration_minutes = models.IntegerField(
        default=30,
        verbose_name="Min. Pausendauer (Minuten)",
    )
    min_break_after_hours = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        default=6,
        verbose_name="Pause nach Stunden",
        help_text="Nach wie vielen Stunden eine Pause erforderlich ist",
    )
    require_break_confirmation = models.BooleanField(
        default=False,
        verbose_name="Pausenbestaetigung erforderlich",
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "timetracking_workinghourslimit"
        verbose_name = "Arbeitszeitgrenze"
        verbose_name_plural = "Arbeitszeitgrenzen"

    def __str__(self) -> str:
        return f"Arbeitszeitgrenzen - {self.location.name}"

    def save(self, *args, **kwargs):
        """Auto-set organization from location if not set."""
        if not self.organization_id and self.location_id:
            self.organization_id = self.location.organization_id
        super().save(*args, **kwargs)
