"""Admin configuration for System models."""

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import AuditLog, EmailNotificationConfig, SystemSetting


@admin.register(AuditLog)
class AuditLogAdmin(ModelAdmin):
    """Read-only admin for AuditLog."""

    list_display = ("user", "action", "model_name", "object_id", "created_at")
    list_filter = ("action", "model_name")
    search_fields = ("user__username", "model_name", "object_id")
    readonly_fields = ("user", "action", "model_name", "object_id", "changes", "ip_address", "user_agent", "created_at")

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(SystemSetting)
class SystemSettingAdmin(ModelAdmin):
    """Admin for SystemSetting."""

    list_display = ("key", "value", "is_public", "updated_at")
    list_filter = ("is_public",)
    search_fields = ("key", "description")


@admin.register(EmailNotificationConfig)
class EmailNotificationConfigAdmin(ModelAdmin):
    """Admin for configuring email notification events."""

    list_display = (
        "event_type",
        "get_event_display",
        "is_enabled",
        "notify_super_admins",
        "notify_user",
        "updated_at",
    )
    list_filter = ("is_enabled", "notify_super_admins", "notify_user")
    list_editable = ("is_enabled", "notify_super_admins", "notify_user")
    search_fields = ("event_type",)
    readonly_fields = ("created_at", "updated_at")

    fieldsets = (
        (
            "Ereignis",
            {
                "fields": ("event_type",),
            },
        ),
        (
            "Benachrichtigungseinstellungen",
            {
                "fields": (
                    "is_enabled",
                    "notify_super_admins",
                    "notify_user",
                    "custom_recipients",
                ),
            },
        ),
        (
            "Zeitstempel",
            {
                "fields": ("created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )

    def get_event_display(self, obj):
        return obj.get_event_type_display()

    get_event_display.short_description = "Beschreibung"
