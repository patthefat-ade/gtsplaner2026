"""
Student Contact model for managing contact persons and authorized pickups.

Each student can have one primary contact (Hauptansprechperson) and up to
three additional authorized persons for pickup. Contact information is
encrypted at rest to comply with GDPR/DSGVO requirements.
"""

from django.core.exceptions import ValidationError
from django.db import models

from core.models import TenantModel
from encrypted_fields.fields import EncryptedCharField, EncryptedEmailField


class StudentContact(TenantModel):
    """
    A contact person for a student (parent, guardian, authorized pickup person).
    Personal data is encrypted at rest for GDPR compliance.
    """

    class Relationship(models.TextChoices):
        PARENT = "parent", "Elternteil"
        UNCLE = "uncle", "Onkel"
        AUNT = "aunt", "Tante"
        GRANDPARENT = "grandparent", "Grosselternteil"
        RELATIVE = "relative", "Verwandte/r"
        AUTHORIZED = "authorized", "Abholberechtigte Person"

    student = models.ForeignKey(
        "groups.Student",
        on_delete=models.CASCADE,
        related_name="contacts",
        verbose_name="Schueler/in",
    )
    is_primary = models.BooleanField(
        default=False,
        verbose_name="Hauptansprechperson",
        help_text="Genau eine Kontaktperson pro Schueler muss als Hauptansprechperson markiert sein.",
    )
    relationship = models.CharField(
        max_length=20,
        choices=Relationship.choices,
        verbose_name="Beziehung",
    )
    first_name = EncryptedCharField(
        max_length=255,
        verbose_name="Vorname",
    )
    last_name = EncryptedCharField(
        max_length=255,
        verbose_name="Nachname",
    )
    phone = EncryptedCharField(
        max_length=255,
        blank=True,
        null=True,
        default="",
        verbose_name="Telefon",
    )
    email = EncryptedEmailField(
        max_length=255,
        blank=True,
        null=True,
        default="",
        verbose_name="E-Mail",
    )
    whatsapp_available = models.BooleanField(
        default=False,
        verbose_name="WhatsApp verfuegbar",
    )
    notes = models.TextField(
        blank=True,
        default="",
        verbose_name="Notizen",
    )
    is_deleted = models.BooleanField(
        default=False,
        verbose_name="Geloescht",
    )
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "groups_studentcontact"
        verbose_name = "Kontaktperson"
        verbose_name_plural = "Kontaktpersonen"
        ordering = ["-is_primary", "last_name", "first_name"]
        indexes = [
            models.Index(fields=["student"]),
            models.Index(fields=["is_primary"]),
        ]

    def __str__(self) -> str:
        role = " (Hauptansprechperson)" if self.is_primary else ""
        return f"{self.first_name} {self.last_name}{role} – {self.get_relationship_display()}"

    def clean(self) -> None:
        """Validate max 4 contacts per student and exactly 1 primary."""
        super().clean()
        if not self.student_id:
            return

        qs = StudentContact.objects.filter(
            student_id=self.student_id,
            is_deleted=False,
        )
        if self.pk:
            qs = qs.exclude(pk=self.pk)

        existing_count = qs.count()
        if existing_count >= 4:
            raise ValidationError(
                "Ein Schueler kann maximal 4 Kontaktpersonen haben."
            )

        if self.is_primary:
            existing_primary = qs.filter(is_primary=True).exists()
            if existing_primary:
                raise ValidationError(
                    "Es gibt bereits eine Hauptansprechperson fuer diesen Schueler. "
                    "Bitte aendern Sie zuerst die bestehende Hauptansprechperson."
                )

    def save(self, *args, **kwargs):
        """Auto-set organization from student's group if not set."""
        if not self.organization_id and self.student_id:
            self.organization_id = self.student.group.organization_id
        self.full_clean()
        super().save(*args, **kwargs)
