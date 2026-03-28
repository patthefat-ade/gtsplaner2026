"""
WeeklyPlans models.

Provides weekly planning functionality for groups, allowing educators
to create structured weekly schedules with time slots and activities.
"""

from django.conf import settings
from django.db import models

from core.models import TenantModel


class WeeklyPlan(TenantModel):
    """
    A weekly plan for a group, containing scheduled activities across weekdays.
    Can also serve as a reusable template for creating new plans.
    """

    STATUS_CHOICES = [
        ("draft", "Entwurf"),
        ("published", "Veröffentlicht"),
    ]

    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="weekly_plans",
        verbose_name="Gruppe",
        null=True,
        blank=True,
        help_text="Zugehörige Gruppe (leer bei Vorlagen ohne Gruppenbindung)",
    )
    school_year = models.ForeignKey(
        "groups.SchoolYear",
        on_delete=models.SET_NULL,
        related_name="weekly_plans",
        verbose_name="Schuljahr",
        null=True,
        blank=True,
        help_text="Zugehöriges Schuljahr",
    )
    week_start_date = models.DateField(
        verbose_name="Wochenbeginn (Montag)",
        null=True,
        blank=True,
        help_text="Montag der Kalenderwoche (leer bei Vorlagen)",
    )
    title = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Titel",
        help_text="Optionaler Titel (z.B. 'Projektwoche Natur')",
    )
    weekly_theme = models.TextField(
        blank=True,
        verbose_name="Thema der Woche",
        help_text="Übergreifendes Wochenthema oder besondere Aktivitäten (Rich-Text/HTML)",
    )
    notes = models.TextField(
        blank=True,
        verbose_name="Anmerkungen",
    )
    is_template = models.BooleanField(
        default=False,
        verbose_name="Ist Vorlage",
        help_text="Markiert diesen Plan als wiederverwendbare Vorlage",
    )
    template_name = models.CharField(
        max_length=255,
        blank=True,
        verbose_name="Vorlagenname",
        help_text="Name der Vorlage (nur relevant wenn is_template=True)",
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default="draft",
        verbose_name="Status",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_weekly_plans",
        verbose_name="Erstellt von",
    )
    is_deleted = models.BooleanField(
        default=False,
        verbose_name="Gelöscht",
        help_text="Soft-Delete: Markiert den Plan als gelöscht, ohne ihn aus der DB zu entfernen.",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        verbose_name = "Wochenplan"
        verbose_name_plural = "Wochenpläne"
        ordering = ["-week_start_date", "-created_at"]
        indexes = [
            models.Index(fields=["week_start_date"]),
            models.Index(fields=["is_template"]),
            models.Index(fields=["status"]),
            models.Index(fields=["group", "week_start_date"]),
        ]

    def __str__(self):
        if self.is_template:
            return f"Vorlage: {self.template_name or 'Unbenannt'}"
        group_name = self.group.name if self.group else "Keine Gruppe"
        if self.week_start_date:
            kw = self.week_start_date.isocalendar()[1]
            return f"{group_name} – KW {kw} ({self.week_start_date})"
        return f"{group_name} – {self.title or 'Entwurf'}"

    @property
    def calendar_week(self):
        """Return the ISO calendar week number."""
        if self.week_start_date:
            import datetime as _dt
            d = self.week_start_date
            if isinstance(d, str):
                d = _dt.date.fromisoformat(d)
            return d.isocalendar()[1]
        return None

    @property
    def week_end_date(self):
        """Return the Friday of the same week."""
        if self.week_start_date:
            import datetime as _dt
            d = self.week_start_date
            if isinstance(d, str):
                d = _dt.date.fromisoformat(d)
            return d + _dt.timedelta(days=4)
        return None


class WeeklyPlanEntry(models.Model):
    """
    A single entry in a weekly plan, representing an activity
    scheduled for a specific time slot on a specific day.
    """

    DAY_CHOICES = [
        (0, "Montag"),
        (1, "Dienstag"),
        (2, "Mittwoch"),
        (3, "Donnerstag"),
        (4, "Freitag"),
    ]

    CATEGORY_CHOICES = [
        ("lernen", "Lernen"),
        ("bewegung", "Bewegung"),
        ("kreativ", "Kreativ"),
        ("essen", "Essen"),
        ("freizeit", "Freizeit"),
        ("musik", "Musik"),
        ("natur", "Natur"),
        ("sozial", "Soziales Lernen"),
        ("ruhe", "Ruhezeit"),
        ("sonstiges", "Sonstiges"),
    ]

    CATEGORY_COLORS = {
        "lernen": "#3B82F6",      # Blue
        "bewegung": "#22C55E",    # Green
        "kreativ": "#A855F7",     # Purple
        "essen": "#F97316",       # Orange
        "freizeit": "#EAB308",    # Yellow
        "musik": "#EC4899",       # Pink
        "natur": "#14B8A6",       # Teal
        "sozial": "#6366F1",      # Indigo
        "ruhe": "#94A3B8",        # Slate
        "sonstiges": "#78716C",   # Stone
    }

    weekly_plan = models.ForeignKey(
        WeeklyPlan,
        on_delete=models.CASCADE,
        related_name="entries",
        verbose_name="Wochenplan",
    )
    day_of_week = models.IntegerField(
        choices=DAY_CHOICES,
        verbose_name="Wochentag",
    )
    start_time = models.TimeField(verbose_name="Startzeit")
    end_time = models.TimeField(verbose_name="Endzeit")
    activity = models.TextField(
        verbose_name="Aktivität",
        help_text="Name/Inhalt der Aktivität (Rich-Text/HTML unterstützt)",
    )
    description = models.TextField(
        blank=True,
        verbose_name="Beschreibung",
        help_text="Optionale Details zur Aktivität",
    )
    color = models.CharField(
        max_length=7,
        blank=True,
        verbose_name="Farbe",
        help_text="Hex-Farbcode (z.B. '#3B82F6'). Wird automatisch aus Kategorie gesetzt.",
    )
    category = models.CharField(
        max_length=50,
        choices=CATEGORY_CHOICES,
        default="sonstiges",
        verbose_name="Kategorie",
    )
    sort_order = models.IntegerField(
        default=0,
        verbose_name="Reihenfolge",
    )

    class Meta:
        verbose_name = "Wochenplan-Eintrag"
        verbose_name_plural = "Wochenplan-Einträge"
        ordering = ["day_of_week", "start_time", "sort_order"]
        indexes = [
            models.Index(fields=["weekly_plan", "day_of_week"]),
        ]

    def __str__(self):
        day_name = dict(self.DAY_CHOICES).get(self.day_of_week, "?")
        return f"{day_name} {self.start_time}-{self.end_time}: {self.activity}"

    def save(self, *args, **kwargs):
        """Auto-set color from category if not explicitly provided."""
        if not self.color and self.category:
            self.color = self.CATEGORY_COLORS.get(self.category, "#78716C")
        super().save(*args, **kwargs)


class DailyActivity(models.Model):
    """
    Detailed daily activity description for a weekly plan.
    One entry per weekday, containing rich-text content that
    appears in the PDF export under the weekly grid.
    """

    DAY_CHOICES = WeeklyPlanEntry.DAY_CHOICES

    weekly_plan = models.ForeignKey(
        WeeklyPlan,
        on_delete=models.CASCADE,
        related_name="daily_activities",
        verbose_name="Wochenplan",
    )
    day_of_week = models.IntegerField(
        choices=DAY_CHOICES,
        verbose_name="Wochentag",
    )
    content = models.TextField(
        blank=True,
        verbose_name="Tagesaktivität",
        help_text="Detaillierte Aktivitätsbeschreibung für diesen Tag (Rich-Text/HTML)",
    )

    class Meta:
        verbose_name = "Tagesaktivität"
        verbose_name_plural = "Tagesaktivitäten"
        ordering = ["day_of_week"]
        unique_together = [("weekly_plan", "day_of_week")]
        indexes = [
            models.Index(fields=["weekly_plan", "day_of_week"]),
        ]

    def __str__(self):
        day_name = dict(self.DAY_CHOICES).get(self.day_of_week, "?")
        return f"{day_name}: {self.content[:50]}..."
