"""Admin configuration for System models."""

from django.contrib import admin
from unfold.admin import ModelAdmin

from .models import AuditLog, SystemSetting


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
