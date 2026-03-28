"""
Events admin configuration with Django Unfold.
"""
from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Event, EventParticipant


class EventParticipantInline(TabularInline):
    """Inline for participants within an event."""
    model = EventParticipant
    extra = 0
    fields = (
        "student",
        "consent_status",
        "consent_date",
        "consent_given_by",
        "attendance_status",
        "notes",
    )
    readonly_fields = ("consent_date",)


@admin.register(Event)
class EventAdmin(ModelAdmin):
    """Admin for events."""
    list_display = (
        "title",
        "event_type",
        "status",
        "start_date",
        "end_date",
        "venue",
        "location",
        "organization",
    )
    list_filter = ("event_type", "status", "location", "organization")
    search_fields = ("title", "description", "venue")
    date_hierarchy = "start_date"
    inlines = [EventParticipantInline]
    filter_horizontal = ("groups", "transactions")


@admin.register(EventParticipant)
class EventParticipantAdmin(ModelAdmin):
    """Admin for event participants."""
    list_display = (
        "event",
        "student",
        "consent_status",
        "attendance_status",
        "consent_date",
    )
    list_filter = ("consent_status", "attendance_status")
    search_fields = ("student__first_name", "student__last_name", "event__title")
