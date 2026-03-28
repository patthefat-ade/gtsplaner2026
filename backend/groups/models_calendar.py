"""
Calendar-related models for school years.
Provides HolidayPeriod and AutonomousDay models for managing
school holidays and autonomous school days within a school year.
"""

from django.db import models

from core.models import TenantModel


class HolidayPeriod(TenantModel):
    """
    A holiday period within a school year (e.g., Weihnachtsferien, Semesterferien).
    Represents a date range when school is closed.
    """

    school_year = models.ForeignKey(
        "groups.SchoolYear",
        on_delete=models.CASCADE,
        related_name="holidays",
        verbose_name="Schuljahr",
    )
    name = models.CharField(
        max_length=100,
        verbose_name="Bezeichnung",
        help_text="z.B. Weihnachtsferien, Semesterferien, Osterferien",
    )
    start_date = models.DateField(verbose_name="Beginn")
    end_date = models.DateField(verbose_name="Ende")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "calendar_holiday_period"
        verbose_name = "Ferienzeit"
        verbose_name_plural = "Ferienzeiten"
        ordering = ["start_date"]
        indexes = [
            models.Index(fields=["school_year"]),
            models.Index(fields=["start_date", "end_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.start_date} – {self.end_date})"

    def save(self, *args, **kwargs):
        """Auto-set organization from school_year if not set."""
        if not self.organization_id and self.school_year_id:
            self.organization_id = self.school_year.organization_id
        super().save(*args, **kwargs)


class AutonomousDay(TenantModel):
    """
    An autonomous school day (schulautonomer Tag) within a school year.
    Represents a single day when school is closed by local decision.
    """

    school_year = models.ForeignKey(
        "groups.SchoolYear",
        on_delete=models.CASCADE,
        related_name="autonomous_days",
        verbose_name="Schuljahr",
    )
    name = models.CharField(
        max_length=100,
        verbose_name="Bezeichnung",
        help_text="z.B. Schulautonomer Tag, Pädagogischer Tag",
    )
    date = models.DateField(verbose_name="Datum")
    description = models.TextField(
        blank=True,
        verbose_name="Beschreibung",
        help_text="Optionale Beschreibung oder Begründung",
    )
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "calendar_autonomous_day"
        verbose_name = "Schulautonomer Tag"
        verbose_name_plural = "Schulautonome Tage"
        ordering = ["date"]
        indexes = [
            models.Index(fields=["school_year"]),
            models.Index(fields=["date"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.date})"

    def save(self, *args, **kwargs):
        """Auto-set organization from school_year if not set."""
        if not self.organization_id and self.school_year_id:
            self.organization_id = self.school_year.organization_id
        super().save(*args, **kwargs)
