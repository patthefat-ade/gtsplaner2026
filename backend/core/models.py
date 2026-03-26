"""
Core models for the Kassenbuch App v2.

Contains the custom User model, Organization, and Location models
that form the foundation of the multi-tenant architecture.

Personal data fields are encrypted at rest using Fernet encryption
to comply with GDPR/DSGVO requirements.
"""

from django.contrib.auth.models import AbstractUser
from django.db import models
from encrypted_fields.fields import (
    EncryptedCharField,
    EncryptedEmailField,
)


class User(AbstractUser):
    """
    Custom User model with role-based access control.

    Extends Django's AbstractUser with additional fields for the
    four-role hierarchy: Educator, LocationManager, Admin, SuperAdmin.

    Sensitive fields (phone) are encrypted at rest.
    Note: first_name, last_name, email are inherited from AbstractUser
    and cannot be easily replaced with encrypted variants without
    breaking Django's auth system. These are protected by database-level
    encryption (DigitalOcean Managed Database encryption at rest).
    """

    class Role(models.TextChoices):
        EDUCATOR = "educator", "Pädagogin"
        LOCATION_MANAGER = "location_manager", "Standortleitung"
        ADMIN = "admin", "Admin"
        SUPER_ADMIN = "super_admin", "Super Admin"

    role = models.CharField(
        max_length=20,
        choices=Role.choices,
        default=Role.EDUCATOR,
        verbose_name="Rolle",
    )
    location = models.ForeignKey(
        "Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="users",
        verbose_name="Standort",
    )
    phone = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Telefon"
    )
    profile_picture = models.ImageField(
        upload_to="profiles/", null=True, blank=True, verbose_name="Profilbild"
    )
    is_deleted = models.BooleanField(default=False, verbose_name="Gelöscht")
    last_password_change = models.DateTimeField(
        null=True, blank=True, verbose_name="Letzte Passwortänderung"
    )
    # Two-Factor Authentication (TOTP)
    totp_secret = models.CharField(
        max_length=32, blank=True, default="", verbose_name="TOTP Secret"
    )
    is_2fa_enabled = models.BooleanField(
        default=False, verbose_name="2FA aktiviert"
    )
    # Terms & Conditions acceptance
    has_accepted_terms = models.BooleanField(
        default=False, verbose_name="Nutzungsbedingungen akzeptiert"
    )
    terms_accepted_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Nutzungsbedingungen akzeptiert am"
    )
    # GDPR/DSGVO anonymization tracking
    anonymized_at = models.DateTimeField(
        null=True, blank=True, verbose_name="Anonymisiert am"
    )

    class Meta:
        db_table = "users_user"
        verbose_name = "Benutzer"
        verbose_name_plural = "Benutzer"
        ordering = ["last_name", "first_name"]
        indexes = [
            models.Index(fields=["role"]),
            models.Index(fields=["location"]),
        ]

    def __str__(self) -> str:
        return f"{self.get_full_name()} ({self.get_role_display()})"

    @property
    def is_educator(self) -> bool:
        """Check if user has Educator role."""
        return self.role == self.Role.EDUCATOR

    @property
    def is_location_manager(self) -> bool:
        """Check if user has Location Manager role."""
        return self.role == self.Role.LOCATION_MANAGER

    @property
    def is_admin_role(self) -> bool:
        """Check if user has Admin role."""
        return self.role == self.Role.ADMIN

    @property
    def is_super_admin(self) -> bool:
        """Check if user has Super Admin role."""
        return self.role == self.Role.SUPER_ADMIN

    @property
    def is_anonymized(self) -> bool:
        """Check if user data has been anonymized."""
        return self.anonymized_at is not None

    def anonymize(self) -> None:
        """
        Pseudoanonymize all personal data for GDPR/DSGVO compliance.

        Replaces all PII with placeholder values while preserving
        the record for referential integrity.
        """
        from django.utils import timezone

        self.first_name = "Gelöschter"
        self.last_name = "Benutzer"
        self.email = f"deleted_{self.pk}@anonymized.local"
        self.username = f"deleted_{self.pk}"
        self.phone = ""
        self.profile_picture = None
        self.totp_secret = ""
        self.is_2fa_enabled = False
        self.is_active = False
        self.is_deleted = True
        self.anonymized_at = timezone.now()
        self.set_unusable_password()
        self.save()


class Organization(models.Model):
    """
    Represents a parent organization (e.g., Hilfswerk Kärnten).

    Contact information (email, phone, address) is encrypted at rest.

    Note: All encrypted fields use null=True because django-fernet-encrypted-fields
    returns None from get_prep_value() for empty/falsy values. PostgreSQL enforces
    NOT NULL strictly, so null=True is required for compatibility.
    """

    name = models.CharField(max_length=255, verbose_name="Name")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    email = EncryptedEmailField(
        max_length=255, blank=True, null=True, default="", verbose_name="E-Mail"
    )
    phone = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Telefon"
    )
    website = models.URLField(blank=True, verbose_name="Website")
    street = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Straße"
    )
    city = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Stadt"
    )
    postal_code = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="PLZ"
    )
    country = models.CharField(max_length=100, default="Österreich", verbose_name="Land")
    logo = models.ImageField(
        upload_to="organizations/", null=True, blank=True, verbose_name="Logo"
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Gelöscht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "users_organization"
        verbose_name = "Organisation"
        verbose_name_plural = "Organisationen"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class Location(models.Model):
    """
    Represents a physical location/site within an organization.

    Contact information (email, phone, address) is encrypted at rest.

    Note: All encrypted fields use null=True because django-fernet-encrypted-fields
    returns None from get_prep_value() for empty/falsy values. PostgreSQL enforces
    NOT NULL strictly, so null=True is required for compatibility.
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="locations",
        verbose_name="Organisation",
    )
    name = models.CharField(max_length=255, verbose_name="Name")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    email = EncryptedEmailField(
        max_length=255, blank=True, null=True, default="", verbose_name="E-Mail"
    )
    phone = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Telefon"
    )
    street = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Straße"
    )
    city = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Stadt"
    )
    postal_code = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="PLZ"
    )
    manager = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="managed_locations",
        verbose_name="Standortleitung",
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Gelöscht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "users_location"
        verbose_name = "Standort"
        verbose_name_plural = "Standorte"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["organization"]),
            models.Index(fields=["manager"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.organization.name})"
