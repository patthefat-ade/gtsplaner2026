"""
Finance admin configuration with Django Unfold.

Registers TransactionCategory, Transaction, and Receipt models
with rich admin interfaces including filters, search, and inline editing.
"""

from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Receipt, Transaction, TransactionCategory


class ReceiptInline(TabularInline):
    """Inline for receipts within a transaction."""

    model = Receipt
    extra = 0
    fields = ("file", "file_name", "file_size", "file_type", "uploaded_by", "description")
    readonly_fields = ("file_size", "file_type", "uploaded_by")


@admin.register(TransactionCategory)
class TransactionCategoryAdmin(ModelAdmin):
    """Admin for transaction categories."""

    list_display = (
        "name",
        "category_type",
        "location",
        "color",
        "is_system_category",
        "is_active",
    )
    list_filter = ("category_type", "is_system_category", "is_active", "location")
    search_fields = ("name", "description")
    list_editable = ("is_active",)
    ordering = ("name",)


@admin.register(Transaction)
class TransactionAdmin(ModelAdmin):
    """Admin for financial transactions with approval workflow."""

    list_display = (
        "description",
        "amount",
        "transaction_type",
        "status",
        "group",
        "transaction_date",
        "created_by",
    )
    list_filter = (
        "status",
        "transaction_type",
        "transaction_date",
        "group__location",
    )
    search_fields = ("description", "internal_notes", "approval_notes")
    readonly_fields = ("created_at", "updated_at", "created_by")
    date_hierarchy = "transaction_date"
    inlines = [ReceiptInline]
    ordering = ("-transaction_date",)

    fieldsets = (
        (
            "Grunddaten",
            {
                "fields": (
                    "group",
                    "category",
                    "description",
                    "amount",
                    "transaction_type",
                    "transaction_date",
                    "transaction_time",
                ),
            },
        ),
        (
            "Status & Genehmigung",
            {
                "fields": (
                    "status",
                    "created_by",
                    "approved_by",
                    "approved_at",
                    "approval_notes",
                ),
            },
        ),
        (
            "Notizen",
            {
                "fields": ("internal_notes",),
                "classes": ("collapse",),
            },
        ),
        (
            "System",
            {
                "fields": ("is_deleted", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )


@admin.register(Receipt)
class ReceiptAdmin(ModelAdmin):
    """Admin for receipt/invoice attachments."""

    list_display = (
        "file_name",
        "transaction",
        "file_type",
        "file_size",
        "uploaded_by",
        "created_at",
    )
    list_filter = ("file_type", "created_at")
    search_fields = ("file_name", "description")
    readonly_fields = ("created_at", "updated_at")
    ordering = ("-created_at",)
