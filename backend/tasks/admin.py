"""Admin configuration for the tasks app."""

from django.contrib import admin
from unfold.admin import ModelAdmin

from tasks.models import Task


@admin.register(Task)
class TaskAdmin(ModelAdmin):
    list_display = [
        "title",
        "status",
        "priority",
        "due_date",
        "assigned_to",
        "created_by",
        "organization",
    ]
    list_filter = ["status", "priority", "organization"]
    search_fields = ["title", "description"]
    raw_id_fields = ["created_by", "assigned_to", "location", "group"]
    readonly_fields = ["completed_at", "created_at", "updated_at"]
