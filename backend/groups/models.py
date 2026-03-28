"""
Groups models for the Kassenbuch App v2.

Contains SchoolYear, Semester, Group, GroupMember, Student, and Attendance
models for managing the organizational structure of groups and children.

Student personal data is encrypted at rest using Fernet encryption
to comply with GDPR/DSGVO requirements (data of minors).

All tenant-scoped models inherit from TenantModel for automatic
organization-based data isolation.
"""

from django.conf import settings
from django.db import models
from encrypted_fields.fields import (
    EncryptedCharField,
    EncryptedDateField,
    EncryptedEmailField,
)

from core.models import TenantModel


class SchoolYear(TenantModel):
    """
    Represents an academic school year (e.g., 2025/2026).

    Each location has its own school years. Only one can be active at a time.
    """

    location = models.ForeignKey(
        "core.Location",
        on_delete=models.CASCADE,
        related_name="school_years",
        verbose_name="Standort",
    )
    name = models.CharField(
        max_length=50,
        verbose_name="Name",
        help_text="z.B. 2025/2026",
    )
    start_date = models.DateField(verbose_name="Startdatum")
    end_date = models.DateField(verbose_name="Enddatum")
    is_active = models.BooleanField(
        default=False,
        verbose_name="Aktiv",
        help_text="Nur ein Schuljahr pro Standort kann aktiv sein.",
    )
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "calendar_schoolyear"
        verbose_name = "Schuljahr"
        verbose_name_plural = "Schuljahre"
        ordering = ["-start_date"]
        unique_together = [("location", "name")]
        indexes = [
            models.Index(fields=["location"]),
            models.Index(fields=["is_active"]),
        ]

    def __str__(self) -> str:
        active = " (aktiv)" if self.is_active else ""
        return f"{self.name} - {self.location.name}{active}"

    def save(self, *args, **kwargs):
        """Auto-set organization from location if not set."""
        if not self.organization_id and self.location_id:
            self.organization_id = self.location.organization_id
        super().save(*args, **kwargs)


class Semester(TenantModel):
    """
    A semester within a school year (e.g., Herbst, Fruehling).

    Each school year typically has two semesters.
    """

    class SemesterType(models.TextChoices):
        AUTUMN = "autumn", "Herbst"
        WINTER = "winter", "Winter"
        SPRING = "spring", "Fruehling"
        SUMMER = "summer", "Sommer"

    school_year = models.ForeignKey(
        SchoolYear,
        on_delete=models.CASCADE,
        related_name="semesters",
        verbose_name="Schuljahr",
    )
    name = models.CharField(
        max_length=50,
        choices=SemesterType.choices,
        verbose_name="Semester",
    )
    start_date = models.DateField(verbose_name="Startdatum")
    end_date = models.DateField(verbose_name="Enddatum")
    is_active = models.BooleanField(default=False, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "calendar_semester"
        verbose_name = "Semester"
        verbose_name_plural = "Semester"
        ordering = ["start_date"]
        indexes = [
            models.Index(fields=["school_year"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_name_display()} - {self.school_year.name}"

    def save(self, *args, **kwargs):
        """Auto-set organization from school_year if not set."""
        if not self.organization_id and self.school_year_id:
            self.organization_id = self.school_year.organization_id
        super().save(*args, **kwargs)


class Group(TenantModel):
    """
    A group of children/students managed by educators at a location.

    Groups are tied to a school year and location. Each group has a leader
    and can have multiple members (educators) and students.
    """

    location = models.ForeignKey(
        "core.Location",
        on_delete=models.CASCADE,
        related_name="groups",
        verbose_name="Standort",
    )
    school_year = models.ForeignKey(
        SchoolYear,
        on_delete=models.CASCADE,
        related_name="groups",
        verbose_name="Schuljahr",
    )
    name = models.CharField(max_length=255, verbose_name="Name")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    leader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="led_groups",
        verbose_name="Gruppenleitung",
    )
    balance = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        default=0,
        verbose_name="Kontostand",
        help_text="Aktueller Kontostand der Gruppenkasse in EUR",
    )
    currency = models.CharField(
        max_length=3,
        default="EUR",
        verbose_name="Waehrung",
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "groups_group"
        verbose_name = "Gruppe"
        verbose_name_plural = "Gruppen"
        ordering = ["name"]
        unique_together = [("location", "school_year", "name")]
        indexes = [
            models.Index(fields=["location"]),
            models.Index(fields=["school_year"]),
            models.Index(fields=["leader"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.location.name}, {self.school_year.name})"

    def save(self, *args, **kwargs):
        """Auto-set organization from location if not set."""
        if not self.organization_id and self.location_id:
            self.organization_id = self.location.organization_id
        super().save(*args, **kwargs)


class GroupMember(TenantModel):
    """
    Through-model for the many-to-many relationship between Group and User.

    Tracks which educators are assigned to which groups and their role within.
    """

    class MemberRole(models.TextChoices):
        EDUCATOR = "educator", "Paedagogin"
        ASSISTANT = "assistant", "Assistenz"
        SUBSTITUTE = "substitute", "Vertretung"

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="members",
        verbose_name="Gruppe",
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="group_memberships",
        verbose_name="Benutzer",
    )
    role = models.CharField(
        max_length=20,
        choices=MemberRole.choices,
        default=MemberRole.EDUCATOR,
        verbose_name="Rolle in Gruppe",
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    joined_at = models.DateTimeField(auto_now_add=True, verbose_name="Beigetreten am")
    left_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Ausgetreten am",
    )

    class Meta:
        db_table = "groups_groupmember"
        verbose_name = "Gruppenmitglied"
        verbose_name_plural = "Gruppenmitglieder"
        unique_together = [("group", "user")]
        indexes = [
            models.Index(fields=["group"]),
            models.Index(fields=["user"]),
        ]

    def __str__(self) -> str:
        return (
            f"{self.user.get_full_name()} - {self.group.name} "
            f"({self.get_role_display()})"
        )

    def save(self, *args, **kwargs):
        """Auto-set organization from group if not set."""
        if not self.organization_id and self.group_id:
            self.organization_id = self.group.organization_id
        super().save(*args, **kwargs)


class Student(TenantModel):
    """
    A child/student enrolled in a group.

    Contains personal and contact information for each student.
    ALL personal data fields are encrypted at rest using Fernet encryption
    to comply with GDPR/DSGVO requirements for data of minors.
    """

    group = models.ForeignKey(
        Group,
        on_delete=models.CASCADE,
        related_name="students",
        verbose_name="Gruppe",
    )
    first_name = EncryptedCharField(max_length=255, null=True, verbose_name="Vorname")
    last_name = EncryptedCharField(max_length=255, null=True, verbose_name="Nachname")
    date_of_birth = EncryptedDateField(
        null=True,
        blank=True,
        verbose_name="Geburtsdatum",
    )
    email = EncryptedEmailField(max_length=255, blank=True, null=True, default="", verbose_name="E-Mail")
    phone = EncryptedCharField(max_length=255, blank=True, null=True, default="", verbose_name="Telefon")
    street = EncryptedCharField(max_length=255, blank=True, null=True, default="", verbose_name="Strasse")
    city = EncryptedCharField(max_length=255, blank=True, null=True, default="", verbose_name="Stadt")
    postal_code = EncryptedCharField(max_length=255, blank=True, null=True, default="", verbose_name="PLZ")
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    # GDPR/DSGVO anonymization tracking
    anonymized_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Anonymisiert am"
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "groups_student"
        verbose_name = "Schueler"
        verbose_name_plural = "Schueler"
        ordering = ["id"]  # Cannot order by encrypted fields
        indexes = [
            models.Index(fields=["group"]),
        ]

    def __str__(self) -> str:
        return f"{self.last_name}, {self.first_name}"

    @property
    def full_name(self) -> str:
        """Return the student's full name."""
        return f"{self.first_name} {self.last_name}"

    @property
    def is_anonymized(self) -> bool:
        """Check if student data has been anonymized."""
        return self.anonymized_at is not None

    def anonymize(self) -> None:
        """
        Pseudoanonymize all personal data for GDPR/DSGVO compliance.

        Replaces all PII with placeholder values while preserving
        the record for referential integrity (e.g., group membership).
        """
        from django.utils import timezone

        self.first_name = "Anonymisiert"
        self.last_name = "Kind"
        self.date_of_birth = None
        self.email = ""
        self.phone = ""
        self.street = ""
        self.city = ""
        self.postal_code = ""
        self.is_active = False
        self.is_deleted = True
        self.anonymized_at = timezone.now()
        self.save()

    def save(self, *args, **kwargs):
        """Auto-set organization from group if not set."""
        if not self.organization_id and self.group_id:
            self.organization_id = self.group.organization_id
        super().save(*args, **kwargs)


# Import related models so they're discoverable by Django
from groups.models_attendance import Attendance  # noqa: E402, F401
from groups.models_transfer import GroupTransfer  # noqa: E402, F401
from groups.models_contacts import StudentContact  # noqa: E402, F401
