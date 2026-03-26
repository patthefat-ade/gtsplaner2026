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

from core.managers import AllTenantsManager, TenantManager


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
    Represents an organization in a hierarchical multi-tenant structure.

    Hierarchy:
        Main tenant (e.g., Hilfswerk Kaernten) -> org_type='main'
          Sub tenant (e.g., VS Klagenfurt)     -> org_type='sub', parent=main
          Sub tenant (e.g., VS Villach)         -> org_type='sub', parent=main

    A main tenant has cross-tenant visibility over all its sub tenants.
    Sub tenants are isolated from each other.

    Contact information (email, phone, address) is encrypted at rest.

    Note: All encrypted fields use null=True because django-fernet-encrypted-fields
    returns None from get_prep_value() for empty/falsy values. PostgreSQL enforces
    NOT NULL strictly, so null=True is required for compatibility.
    """

    class OrgType(models.TextChoices):
        MAIN = "main", "Hauptmandant"
        SUB = "sub", "Untermandant"

    name = models.CharField(max_length=255, verbose_name="Name")
    parent = models.ForeignKey(
        "self",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="children",
        verbose_name="Uebergeordnete Organisation",
        help_text="Leer fuer Hauptmandanten. Verweist auf den Hauptmandanten fuer Untermandanten.",
    )
    org_type = models.CharField(
        max_length=10,
        choices=OrgType.choices,
        default=OrgType.SUB,
        verbose_name="Organisationstyp",
    )
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    email = EncryptedEmailField(
        max_length=255, blank=True, null=True, default="", verbose_name="E-Mail"
    )
    phone = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Telefon"
    )
    website = models.URLField(blank=True, verbose_name="Website")
    street = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Strasse"
    )
    city = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="Stadt"
    )
    postal_code = EncryptedCharField(
        max_length=255, blank=True, null=True, default="", verbose_name="PLZ"
    )
    country = models.CharField(max_length=100, default="Oesterreich", verbose_name="Land")
    logo = models.ImageField(
        upload_to="organizations/", null=True, blank=True, verbose_name="Logo"
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "users_organization"
        verbose_name = "Organisation"
        verbose_name_plural = "Organisationen"
        ordering = ["name"]
        indexes = [
            models.Index(fields=["parent"]),
            models.Index(fields=["org_type"]),
        ]

    def __str__(self) -> str:
        if self.parent:
            return f"{self.name} ({self.parent.name})"
        return self.name

    @property
    def is_main_tenant(self) -> bool:
        """Check if this is a main (parent) tenant."""
        return self.org_type == self.OrgType.MAIN

    @property
    def is_sub_tenant(self) -> bool:
        """Check if this is a sub (child) tenant."""
        return self.org_type == self.OrgType.SUB

    def get_descendants(self, include_self: bool = True):
        """
        Return all descendant organizations (children, grandchildren, etc.).

        Uses a simple recursive approach suitable for shallow hierarchies
        (typically 2 levels: main -> sub).
        """
        result = [self] if include_self else []
        for child in self.children.filter(is_active=True, is_deleted=False):
            result.extend(child.get_descendants(include_self=True))
        return result

    def get_all_organization_ids(self, include_self: bool = True) -> list[int]:
        """
        Return a flat list of IDs for this organization and all descendants.

        Used by TenantMiddleware to determine which organizations a user
        can access based on their organization membership.
        """
        return [org.id for org in self.get_descendants(include_self=include_self)]


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


class TenantModel(models.Model):
    """
    Abstract base class for all tenant-scoped models.

    Provides automatic organization-based data isolation through
    the TenantManager. All models that contain tenant-specific data
    should inherit from this class instead of models.Model.

    Managers:
        objects: TenantManager - requires explicit tenant filtering via for_tenant()
        all_tenants: AllTenantsManager - unfiltered access for SuperAdmin/system use

    Usage:
        class MyModel(TenantModel):
            name = models.CharField(max_length=255)

        # Tenant-scoped query:
        MyModel.objects.for_tenant(request.tenant).filter(name='test')

        # Cross-tenant query (SuperAdmin only):
        MyModel.all_tenants.all()
    """

    organization = models.ForeignKey(
        Organization,
        on_delete=models.CASCADE,
        related_name="%(app_label)s_%(class)s_set",
        verbose_name="Organisation",
        db_index=True,
    )

    objects = TenantManager()
    all_tenants = AllTenantsManager()

    class Meta:
        abstract = True
        indexes = [
            models.Index(fields=["organization"]),
        ]
