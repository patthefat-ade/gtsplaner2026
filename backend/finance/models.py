"""
Finance models for the Kassenbuch App v2.

Contains TransactionCategory, Transaction, and Receipt models
for managing the cash book (Kassenbuch) functionality.

All tenant-scoped models inherit from TenantModel for automatic
organization-based data isolation.
"""

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from core.models import TenantModel


class TransactionCategory(TenantModel):
    """
    Categories for transactions (income/expense).

    System categories are pre-created and cannot be deleted by users.
    Each location can have its own custom categories.
    """

    class CategoryType(models.TextChoices):
        INCOME = "income", "Einnahme"
        EXPENSE = "expense", "Ausgabe"

    location = models.ForeignKey(
        "core.Location",
        on_delete=models.CASCADE,
        related_name="transaction_categories",
        verbose_name="Standort",
    )
    name = models.CharField(max_length=100, verbose_name="Name")
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    category_type = models.CharField(
        max_length=20,
        choices=CategoryType.choices,
        verbose_name="Kategorie-Typ",
    )
    is_system_category = models.BooleanField(
        default=False,
        verbose_name="Systemkategorie",
        help_text="Systemkategorien koennen nicht geloescht werden.",
    )
    color = models.CharField(
        max_length=7,
        default="#000000",
        verbose_name="Farbe",
        help_text="Hex-Farbcode (z.B. #FF5733)",
    )
    icon = models.CharField(
        max_length=50,
        blank=True,
        verbose_name="Icon",
        help_text="Lucide Icon-Name",
    )
    is_active = models.BooleanField(default=True, verbose_name="Aktiv")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "finance_transactioncategory"
        verbose_name = "Transaktionskategorie"
        verbose_name_plural = "Transaktionskategorien"
        ordering = ["name"]
        unique_together = [("location", "name", "category_type")]
        indexes = [
            models.Index(fields=["location"]),
            models.Index(fields=["category_type"]),
        ]

    def __str__(self) -> str:
        return f"{self.name} ({self.get_category_type_display()})"

    def save(self, *args, **kwargs):
        """Auto-set organization from location if not set."""
        if not self.organization_id and self.location_id:
            self.organization_id = self.location.organization_id
        super().save(*args, **kwargs)


class Transaction(TenantModel):
    """
    A financial transaction (income or expense) within a group's cash book.

    Transactions follow an approval workflow:
    draft -> pending -> approved/rejected.
    """

    class Status(models.TextChoices):
        DRAFT = "draft", "Entwurf"
        PENDING = "pending", "Ausstehend"
        APPROVED = "approved", "Genehmigt"
        REJECTED = "rejected", "Abgelehnt"

    class TransactionType(models.TextChoices):
        INCOME = "income", "Einnahme"
        EXPENSE = "expense", "Ausgabe"

    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.CASCADE,
        related_name="transactions",
        verbose_name="Gruppe",
    )
    school_year = models.ForeignKey(
        "groups.SchoolYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
        verbose_name="Schuljahr",
        help_text="Zugehöriges Schuljahr (wird automatisch zugeordnet)",
    )
    category = models.ForeignKey(
        TransactionCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="transactions",
        verbose_name="Kategorie",
    )
    description = models.CharField(max_length=255, verbose_name="Beschreibung")
    amount = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        validators=[MinValueValidator(0.01)],
        verbose_name="Betrag",
    )
    transaction_type = models.CharField(
        max_length=20,
        choices=TransactionType.choices,
        verbose_name="Transaktionstyp",
    )
    transaction_date = models.DateField(verbose_name="Transaktionsdatum")
    transaction_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name="Transaktionszeit",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="created_transactions",
        verbose_name="Erstellt von",
    )
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
        related_name="approved_transactions",
        verbose_name="Genehmigt von",
    )
    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Genehmigt am",
    )
    approval_notes = models.TextField(blank=True, verbose_name="Genehmigungsnotizen")
    internal_notes = models.TextField(blank=True, verbose_name="Interne Notizen")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "finance_transaction"
        verbose_name = "Transaktion"
        verbose_name_plural = "Transaktionen"
        ordering = ["-transaction_date", "-created_at"]
        indexes = [
            models.Index(fields=["group"]),
            models.Index(fields=["category"]),
            models.Index(fields=["created_by"]),
            models.Index(fields=["status"]),
            models.Index(fields=["transaction_date"]),
            models.Index(fields=["group", "status", "transaction_date"]),
        ]
        constraints = [
            models.CheckConstraint(
                check=models.Q(amount__gt=0),
                name="transaction_amount_positive",
            ),
        ]

    def __str__(self) -> str:
        sign = "+" if self.transaction_type == self.TransactionType.INCOME else "-"
        return f"{sign}{self.amount} EUR - {self.description} ({self.get_status_display()})"

    def save(self, *args, **kwargs):
        """Auto-set organization and school_year from group if not set."""
        if not self.organization_id and self.group_id:
            self.organization_id = self.group.organization_id
        # Auto-assign active school year from group if not set
        if not self.school_year_id and self.group_id:
            try:
                self.school_year = self.group.school_year
            except Exception:
                pass
        super().save(*args, **kwargs)


class Receipt(TenantModel):
    """
    A file attachment (receipt/invoice) linked to a transaction.

    Supports images and PDF files as proof of purchase.
    """

    transaction = models.ForeignKey(
        Transaction,
        on_delete=models.CASCADE,
        related_name="receipts",
        verbose_name="Transaktion",
    )
    file = models.FileField(
        upload_to="receipts/%Y/%m/",
        verbose_name="Datei",
    )
    file_name = models.CharField(max_length=255, verbose_name="Dateiname")
    file_size = models.IntegerField(
        verbose_name="Dateigroesse",
        help_text="Dateigroesse in Bytes",
    )
    file_type = models.CharField(
        max_length=50,
        verbose_name="Dateityp",
        help_text="MIME-Type (z.B. image/jpeg, application/pdf)",
    )
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        related_name="uploaded_receipts",
        verbose_name="Hochgeladen von",
    )
    description = models.TextField(blank=True, verbose_name="Beschreibung")
    is_deleted = models.BooleanField(default=False, verbose_name="Geloescht")
    created_at = models.DateTimeField(auto_now_add=True, verbose_name="Erstellt am")
    updated_at = models.DateTimeField(auto_now=True, verbose_name="Aktualisiert am")

    class Meta:
        db_table = "finance_receipt"
        verbose_name = "Beleg"
        verbose_name_plural = "Belege"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["transaction"]),
            models.Index(fields=["uploaded_by"]),
        ]

    def __str__(self) -> str:
        return f"{self.file_name} ({self.transaction})"

    def save(self, *args, **kwargs):
        """Auto-set organization from transaction if not set."""
        if not self.organization_id and self.transaction_id:
            self.organization_id = self.transaction.organization_id
        super().save(*args, **kwargs)
