"""Admin configuration for Core models."""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from unfold.admin import ModelAdmin

from .models import Location, Organization, User


@admin.register(User)
class UserAdmin(BaseUserAdmin, ModelAdmin):
    """Admin configuration for the custom User model."""

    list_display = ("username", "email", "first_name", "last_name", "role", "location", "is_active")
    list_filter = ("role", "is_active", "is_deleted", "location")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("last_name", "first_name")

    fieldsets = BaseUserAdmin.fieldsets + (
        ("Kassenbuch", {"fields": ("role", "location", "phone", "profile_picture", "is_deleted")}),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("Kassenbuch", {"fields": ("role", "location", "first_name", "last_name", "email")}),
    )


@admin.register(Organization)
class OrganizationAdmin(ModelAdmin):
    """Admin configuration for Organization model."""

    list_display = ("name", "city", "email", "is_active")
    list_filter = ("is_active", "is_deleted")
    search_fields = ("name", "city", "email")


@admin.register(Location)
class LocationAdmin(ModelAdmin):
    """Admin configuration for Location model."""

    list_display = ("name", "organization", "city", "manager", "is_active")
    list_filter = ("is_active", "is_deleted", "organization")
    search_fields = ("name", "city")
