"""
Events models for managing excursions and events (Ausfluege/Veranstaltungen).

Contains Event, EventParticipant, and ParentalConsent models.
Events can be linked to financial transactions for cost tracking.
All tenant-scoped models inherit from TenantModel.
"""

from django.conf import settings
from django.db import models

from core.models import TenantModel


class Event(TenantModel):
    """
    An excursion or event (Ausflug/Veranstaltung).

    Can span multiple groups, locations, and even tenants (systemuebergreifend).
    Linked to financial transactions for cost tracking.
    """

    class EventType(models.TextChoices):
        EXCURSION = "excursion", "Ausflug"
        EVENT = "event", "Veranstaltung"
        WORKSHOP = "workshop", "Workshop"
        SPORTS = "sports", "Sportveranstaltung"
        CULTURAL = "cultural", "Kulturveranstaltung"
        OTHER = "other", "Sonstiges"

    class EventStatus(models.TextChoices):
        DRAFT = "draft", "Entwurf"
        PLANNED = "planned", "Geplant"
        CONFIRMED = "confirmed", "Bestaetigt"
        IN_PROGRESS = "in_progress", "Laufend"
        COMPLETED = "completed", "Abgeschlossen"
        CANCELLED = "cancelled", "Abgesagt"

    title = models.CharField(max_length=255, verbose_name="Titel")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    event_type = models.CharField(
        max_length=20,
        choices=EventType.choices,
        default=EventType.EXCURSION,
        verbose_name="Veranstaltungstyp",
    )
    status = models.CharField(
        max_length=20,
        choices=EventStatus.choices,
        default=EventStatus.DRAFT,
        verbose_name="Status",
    )

    # Date and time
    start_date = models.DateField(verbose_name="Startdatum")
    end_date = models.DateField(
        null=True, blank=True,
        verbose_name="Enddatum",
        help_text="Leer lassen fuer eintaegige Veranstaltungen",
    )
    start_time = models.TimeField(
        null=True, blank=True,
        verbose_name="Startzeit",
    )
    end_time = models.TimeField(
        null=True, blank=True,
        verbose_name="Endzeit",
    )

    # Location info
    venue = models.CharField(
        max_length=255, blank=True,
        verbose_name="Veranstaltungsort",
    )
    meeting_point = models.CharField(
        max_length=255, blank=True,
        verbose_name="Treffpunkt",
    )

    # Cost
    estimated_cost = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="Geschaetzte Kosten",
    )
    cost_per_student = models.DecimalField(
        max_digits=10, decimal_places=2,
        null=True, blank=True,
        verbose_name="Kosten pro Schueler",
    )

    # Relations
    groups = models.ManyToManyField(
        "groups.Group",
        blank=True,
        related_name="events",
        verbose_name="Teilnehmende Gruppen",
    )
    location = models.ForeignKey(
        "core.Location",
        on_delete=models.CASCADE,
        null=True, blank=True,
        related_name="events",
        verbose_name="Standort",
    )
    school_year = models.ForeignKey(
        "groups.SchoolYear",
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name="events",
        verbose_name="Schuljahr",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_events",
        verbose_name="Erstellt von",
    )

    # Financial link
    transactions = models.ManyToManyField(
        "finance.Transaction",
        blank=True,
        related_name="events",
        verbose_name="Verknuepfte Transaktionen",
    )

    # Consent tracking
    requires_consent = models.BooleanField(
        default=True,
        verbose_name="Einverstaendnis erforderlich",
        help_text="Ob eine Einverstaendniserklaerung der Eltern erforderlich ist",
    )
    consent_deadline = models.DateField(
        null=True, blank=True,
        verbose_name="Einverstaendnis-Frist",
    )
    consent_text = models.TextField(
        blank=True,
        verbose_name="Einverstaendnistext",
        help_text="Text der Einverstaendniserklaerung fuer die Eltern",
    )

    # Notes
    notes = models.TextField(blank=True, verbose_name="Notizen")
    internal_notes = models.TextField(
        blank=True,
        verbose_name="Interne Notizen",
        help_text="Nur fuer Paedagogen sichtbar",
    )

    # Metadata
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "events_event"
        verbose_name = "Veranstaltung"
        verbose_name_plural = "Veranstaltungen"
        ordering = ["-start_date", "-created_at"]
        indexes = [
            models.Index(fields=["start_date"]),
            models.Index(fields=["status"]),
            models.Index(fields=["event_type"]),
            models.Index(fields=["location"]),
        ]

    def __str__(self) -> str:
        return f"{self.title} ({self.start_date})"

    def save(self, *args, **kwargs):
        """Auto-set organization from location or created_by."""
        if not self.organization_id:
            if self.location_id:
                self.organization_id = self.location.organization_id
            elif self.created_by_id:
                self.organization_id = getattr(
                    self.created_by, "organization_id", None
                )
        super().save(*args, **kwargs)

    @property
    def total_cost(self) -> float:
        """Sum of all linked approved transactions."""
        from django.db.models import Sum as DSum
        total = self.transactions.filter(
            status="approved",
            transaction_type="expense",
        ).aggregate(t=DSum("amount"))["t"]
        return float(total) if total else 0.0


class EventParticipant(TenantModel):
    """
    A student participating in an event.

    Tracks attendance and parental consent status.
    """

    class ConsentStatus(models.TextChoices):
        PENDING = "pending", "Ausstehend"
        GRANTED = "granted", "Erteilt"
        DENIED = "denied", "Verweigert"
        NOT_REQUIRED = "not_required", "Nicht erforderlich"

    class AttendanceStatus(models.TextChoices):
        REGISTERED = "registered", "Angemeldet"
        ATTENDED = "attended", "Teilgenommen"
        ABSENT = "absent", "Abwesend"
        CANCELLED = "cancelled", "Abgesagt"

    event = models.ForeignKey(
        Event,
        on_delete=models.CASCADE,
        related_name="participants",
        verbose_name="Veranstaltung",
    )
    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.CASCADE,
        related_name="event_participations",
        verbose_name="Schueler/in",
    )
    consent_status = models.CharField(
        max_length=20,
        choices=ConsentStatus.choices,
        default=ConsentStatus.PENDING,
        verbose_name="Einverstaendnis-Status",
    )
    consent_date = models.DateTimeField(
        null=True, blank=True,
        verbose_name="Einverstaendnis-Datum",
    )
    consent_given_by = models.CharField(
        max_length=255, blank=True,
        verbose_name="Einverstaendnis erteilt von",
        help_text="Name des Erziehungsberechtigten",
    )
    consent_notes = models.TextField(
        blank=True,
        verbose_name="Einverstaendnis-Notizen",
    )
    attendance_status = models.CharField(
        max_length=20,
        choices=AttendanceStatus.choices,
        default=AttendanceStatus.REGISTERED,
        verbose_name="Teilnahme-Status",
    )
    notes = models.TextField(blank=True, verbose_name="Notizen")

    # Metadata
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "events_eventparticipant"
        verbose_name = "Veranstaltungsteilnehmer"
        verbose_name_plural = "Veranstaltungsteilnehmer"
        ordering = ["student__last_name", "student__first_name"]
        unique_together = [("event", "student")]
        indexes = [
            models.Index(fields=["event"]),
            models.Index(fields=["student"]),
            models.Index(fields=["consent_status"]),
        ]

    def __str__(self) -> str:
        return f"{self.student} - {self.event.title}"

    def save(self, *args, **kwargs):
        """Auto-set organization from event."""
        if not self.organization_id and self.event_id:
            self.organization_id = self.event.organization_id
        super().save(*args, **kwargs)
