"""Admin configuration for Core models."""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.http import HttpResponse
from unfold.admin import ModelAdmin

from .models import Location, Organization, User


def anonymize_users(modeladmin, request, queryset):
    """Admin action: Pseudoanonymize selected users (GDPR/DSGVO)."""
    from system.gdpr_service import GDPRService

    count = 0
    for user in queryset:
        if user == request.user:
            messages.warning(request, f"Sie können sich nicht selbst anonymisieren.")
            continue
        if user.is_anonymized:
            messages.info(request, f"Benutzer #{user.pk} ist bereits anonymisiert.")
            continue
        GDPRService.anonymize_user(user)
        count += 1
    messages.success(request, f"{count} Benutzer erfolgreich anonymisiert.")


anonymize_users.short_description = "DSGVO: Ausgewählte Benutzer anonymisieren"


def export_user_data(modeladmin, request, queryset):
    """Admin action: Export user data as ZIP (GDPR Art. 15)."""
    from system.gdpr_service import GDPRService

    if queryset.count() != 1:
        messages.error(request, "Bitte wählen Sie genau einen Benutzer für den Datenexport aus.")
        return

    user = queryset.first()
    zip_buffer = GDPRService.export_user_data(user)

    filename = f"dsgvo_export_benutzer_{user.pk}_{user.last_name}.zip"
    response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


export_user_data.short_description = "DSGVO: Datenexport (Auskunftsanfrage)"


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    """Admin configuration for the custom User model."""

    list_display = ("username", "email", "first_name", "last_name", "role", "organization", "location", "is_active", "is_anonymized_display")
    list_filter = ("role", "is_active", "is_deleted", "organization", "location")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("last_name", "first_name")
    actions = [anonymize_users, export_user_data]

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Kassenbuch", {"fields": ("role", "organization", "location", "phone", "profile_picture", "is_deleted")}),
        ("Zwei-Faktor-Authentifizierung", {"fields": ("is_2fa_enabled", "totp_secret")}),
        ("DSGVO", {"fields": ("anonymized_at", "has_accepted_terms", "terms_accepted_at")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Kassenbuch", {"fields": ("role", "organization", "location", "first_name", "last_name", "email")}),
    )
    readonly_fields = ("anonymized_at", "terms_accepted_at")

    @admin.display(boolean=True, description="Anonymisiert")
    def is_anonymized_display(self, obj):
        return obj.anonymized_at is not None


@admin.register(Organization)
class OrganizationAdmin(ModelAdmin):
    """Admin configuration for Organization model."""

    list_display = ("name", "org_type", "parent", "city", "email", "is_active")
    list_filter = ("is_active", "is_deleted", "org_type", "parent")
    search_fields = ("name", "city", "email")


@admin.register(Location)
class LocationAdmin(ModelAdmin):
    """Admin configuration for Location model."""

    list_display = ("name", "organization", "city", "manager", "is_active")
    list_filter = ("is_active", "is_deleted", "organization")
    search_fields = ("name", "city")
