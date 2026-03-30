"""
Admin configuration for Core models.

Provides Django Admin interfaces for User, Organization, and Location
management with full tenant-aware filtering and hierarchical display.
"""

from django.contrib import admin, messages
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils.html import format_html
from unfold.admin import ModelAdmin, TabularInline

from .models import Location, Organization, User


# ---------------------------------------------------------------------------
# Admin Actions
# ---------------------------------------------------------------------------


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
        messages.error(
            request,
            "Bitte wählen Sie genau einen Benutzer für den Datenexport aus.",
        )
        return

    user = queryset.first()
    zip_buffer = GDPRService.export_user_data(user)

    filename = f"dsgvo_export_benutzer_{user.pk}_{user.last_name}.zip"
    response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


export_user_data.short_description = "DSGVO: Datenexport (Auskunftsanfrage)"


# ---------------------------------------------------------------------------
# Inline Models
# ---------------------------------------------------------------------------


class LocationInline(TabularInline):
    """Inline display of locations within an organization."""

    model = Location
    extra = 0
    fields = ("name", "city", "manager", "is_active")
    readonly_fields = ("name", "city", "manager", "is_active")
    show_change_link = True
    can_delete = False

    def has_add_permission(self, request, obj=None):
        return False


class SubOrganizationInline(TabularInline):
    """Inline display of sub-organizations (children)."""

    model = Organization
    fk_name = "parent"
    extra = 0
    fields = ("name", "org_type", "city", "is_active", "location_count_display")
    readonly_fields = ("name", "org_type", "city", "is_active", "location_count_display")
    show_change_link = True
    can_delete = False
    verbose_name = "Sub-Mandant"
    verbose_name_plural = "Sub-Mandanten"

    def has_add_permission(self, request, obj=None):
        return False

    @admin.display(description="Standorte")
    def location_count_display(self, obj):
        return obj.locations.filter(is_deleted=False).count()


# ---------------------------------------------------------------------------
# User Admin
# ---------------------------------------------------------------------------


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    """
    Admin configuration for the custom User model.

    Provides tenant-aware user management with DSGVO actions.
    """

    list_display = (
        "username",
        "email",
        "full_name_display",
        "role_display",
        "organization",
        "location",
        "is_active",
        "is_anonymized_display",
    )
    list_filter = ("role", "is_active", "is_deleted", "organization", "location")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("last_name", "first_name")
    actions = [anonymize_users, export_user_data]
    list_per_page = 50

    fieldsets = BaseUserAdmin.fieldsets + (
        (
            "GTS Planner",
            {
                "fields": (
                    "role",
                    "organization",
                    "location",
                    "phone",
                    "profile_picture",
                    "is_deleted",
                )
            },
        ),
        (
            "Zwei-Faktor-Authentifizierung",
            {"fields": ("is_2fa_enabled", "totp_secret")},
        ),
        (
            "DSGVO",
            {
                "fields": (
                    "anonymized_at",
                    "has_accepted_terms",
                    "terms_accepted_at",
                )
            },
        ),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        (
            "GTS Planner",
            {
                "fields": (
                    "role",
                    "organization",
                    "location",
                    "first_name",
                    "last_name",
                    "email",
                )
            },
        ),
    )
    readonly_fields = ("anonymized_at", "terms_accepted_at")

    @admin.display(description="Name")
    def full_name_display(self, obj):
        return f"{obj.last_name}, {obj.first_name}" if obj.last_name else obj.username

    @admin.display(description="Rolle")
    def role_display(self, obj):
        role_colors = {
            "super_admin": "#dc2626",
            "admin": "#ea580c",
            "sub_admin": "#d97706",
            "location_manager": "#2563eb",
            "educator": "#16a34a",
        }
        color = role_colors.get(obj.role, "#6b7280")
        label = obj.get_role_display()
        return format_html(
            '<span style="color: {}; font-weight: 600;">{}</span>',
            color,
            label,
        )

    @admin.display(boolean=True, description="Anonymisiert")
    def is_anonymized_display(self, obj):
        return obj.anonymized_at is not None


# ---------------------------------------------------------------------------
# Organization Admin
# ---------------------------------------------------------------------------


@admin.register(Organization)
class OrganizationAdmin(ModelAdmin):
    """
    Admin configuration for Organization model.

    Shows hierarchical tenant structure with inline sub-organizations
    and locations. Provides statistics for each organization.
    """

    list_display = (
        "name",
        "org_type_display",
        "parent",
        "city",
        "email",
        "location_count_display",
        "user_count_display",
        "is_active",
    )
    list_filter = ("is_active", "is_deleted", "org_type", "parent")
    search_fields = ("name", "city", "email")
    ordering = ("parent__name", "name")
    list_per_page = 50
    inlines = [SubOrganizationInline, LocationInline]

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "name",
                    "org_type",
                    "parent",
                    "is_active",
                    "is_deleted",
                )
            },
        ),
        (
            "Kontakt",
            {
                "fields": (
                    "street",
                    "zip_code",
                    "city",
                    "phone",
                    "email",
                    "website",
                )
            },
        ),
        (
            "Statistiken",
            {
                "fields": (
                    "total_locations_display",
                    "total_users_display",
                    "total_sub_orgs_display",
                ),
            },
        ),
    )
    readonly_fields = (
        "total_locations_display",
        "total_users_display",
        "total_sub_orgs_display",
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("parent")
            .annotate(
                _location_count=Count(
                    "locations",
                    filter=Q(locations__is_deleted=False),
                ),
                _user_count=Count(
                    "users",
                    filter=Q(users__is_active=True, users__is_deleted=False),
                ),
            )
        )

    @admin.display(description="Typ")
    def org_type_display(self, obj):
        type_icons = {
            "main": "Hauptmandant",
            "sub": "Sub-Mandant",
        }
        return type_icons.get(obj.org_type, obj.org_type)

    @admin.display(description="Standorte")
    def location_count_display(self, obj):
        return getattr(obj, "_location_count", 0)

    @admin.display(description="Benutzer")
    def user_count_display(self, obj):
        return getattr(obj, "_user_count", 0)

    @admin.display(description="Standorte (gesamt)")
    def total_locations_display(self, obj):
        all_org_ids = obj.get_all_organization_ids(include_self=True)
        return Location.objects.filter(
            organization_id__in=all_org_ids, is_deleted=False
        ).count()

    @admin.display(description="Benutzer (gesamt)")
    def total_users_display(self, obj):
        all_org_ids = obj.get_all_organization_ids(include_self=True)
        return User.objects.filter(
            organization_id__in=all_org_ids, is_active=True, is_deleted=False
        ).count()

    @admin.display(description="Sub-Mandanten")
    def total_sub_orgs_display(self, obj):
        return Organization.objects.filter(
            parent=obj, is_deleted=False
        ).count()


# ---------------------------------------------------------------------------
# Location Admin
# ---------------------------------------------------------------------------


@admin.register(Location)
class LocationAdmin(ModelAdmin):
    """
    Admin configuration for Location model.

    Shows location details with organization context and statistics.
    """

    list_display = (
        "name",
        "organization",
        "city",
        "manager",
        "group_count_display",
        "educator_count_display",
        "is_active",
    )
    list_filter = ("is_active", "is_deleted", "organization")
    search_fields = ("name", "city")
    ordering = ("organization__name", "name")
    list_per_page = 50

    fieldsets = (
        (
            None,
            {
                "fields": (
                    "name",
                    "organization",
                    "manager",
                    "is_active",
                    "is_deleted",
                )
            },
        ),
        (
            "Adresse",
            {
                "fields": (
                    "street",
                    "zip_code",
                    "city",
                    "phone",
                    "email",
                )
            },
        ),
    )

    def get_queryset(self, request):
        return (
            super()
            .get_queryset(request)
            .select_related("organization", "manager")
            .annotate(
                _group_count=Count(
                    "groups",
                    filter=Q(groups__is_deleted=False),
                ),
                _educator_count=Count(
                    "users",
                    filter=Q(
                        users__is_active=True,
                        users__role="educator",
                    ),
                ),
            )
        )

    @admin.display(description="Gruppen")
    def group_count_display(self, obj):
        return getattr(obj, "_group_count", 0)

    @admin.display(description="Pädagog:innen")
    def educator_count_display(self, obj):
        return getattr(obj, "_educator_count", 0)
