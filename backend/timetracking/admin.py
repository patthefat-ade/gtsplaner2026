"""
Timetracking admin configuration with Django Unfold.

Registers TimeEntry, LeaveType, LeaveRequest, and WorkingHoursLimit models
with rich admin interfaces including custom approval actions for leave requests,
filters, search, and date hierarchy.
"""

from django.contrib import admin, messages
from django.utils import timezone
from unfold.admin import ModelAdmin
from unfold.decorators import action

from .models import LeaveRequest, LeaveType, TimeEntry, WorkingHoursLimit


# ---------------------------------------------------------------------------
# TimeEntry Admin
# ---------------------------------------------------------------------------


@admin.register(TimeEntry)
class TimeEntryAdmin(ModelAdmin):
    """Admin for time entries with duration display."""

    list_display = (
        "user",
        "group",
        "date",
        "start_time",
        "end_time",
        "duration_display",
    )
    list_filter = ("date", "group__location", "group")
    search_fields = (
        "user__first_name",
        "user__last_name",
        "user__email",
        "notes",
    )
    readonly_fields = ("duration_minutes", "created_at", "updated_at")
    date_hierarchy = "date"
    ordering = ("-date", "-start_time")

    fieldsets = (
        (
            "Zeiteintrag",
            {
                "fields": (
                    "user",
                    "group",
                    "date",
                    "start_time",
                    "end_time",
                    "duration_minutes",
                ),
            },
        ),
        (
            "Notizen",
            {
                "fields": ("notes",),
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

    def duration_display(self, obj):
        """Display duration in hours:minutes format."""
        if obj.duration_minutes:
            hours = obj.duration_minutes // 60
            minutes = obj.duration_minutes % 60
            return f"{hours}h {minutes:02d}m"
        return "-"

    duration_display.short_description = "Dauer"


# ---------------------------------------------------------------------------
# LeaveType Admin
# ---------------------------------------------------------------------------


@admin.register(LeaveType)
class LeaveTypeAdmin(ModelAdmin):
    """Admin for leave/absence types."""

    list_display = (
        "name",
        "location",
        "requires_approval",
        "max_days_per_year",
        "is_system_type",
        "is_active",
    )
    list_filter = ("requires_approval", "is_system_type", "is_active", "location")
    search_fields = ("name", "description")
    list_editable = ("is_active",)
    ordering = ("name",)


# ---------------------------------------------------------------------------
# LeaveRequest Admin
# ---------------------------------------------------------------------------


@admin.register(LeaveRequest)
class LeaveRequestAdmin(ModelAdmin):
    """Admin for leave/absence requests with approval workflow actions."""

    list_display = (
        "user",
        "leave_type",
        "start_date",
        "end_date",
        "total_days",
        "status",
        "approved_by",
    )
    list_filter = ("status", "leave_type", "start_date")
    search_fields = (
        "user__first_name",
        "user__last_name",
        "reason",
        "approval_notes",
    )
    list_filter_submit = True
    readonly_fields = ("total_days", "created_at", "updated_at", "approved_by", "approved_at")
    date_hierarchy = "start_date"
    ordering = ("-start_date",)

    fieldsets = (
        (
            "Antrag",
            {
                "fields": (
                    "user",
                    "leave_type",
                    "start_date",
                    "end_date",
                    "total_days",
                    "reason",
                ),
            },
        ),
        (
            "Status & Genehmigung",
            {
                "fields": (
                    "status",
                    "approved_by",
                    "approved_at",
                    "approval_notes",
                ),
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

    # Custom detail actions (single object)
    actions_detail = ["approve_leave_detail", "reject_leave_detail"]

    # Bulk actions (list view)
    actions = ["approve_leave_requests", "reject_leave_requests"]

    @action(description="Genehmigen", url_path="approve")
    def approve_leave_detail(self, request, object_id):
        """Approve a single leave request from detail view."""
        leave = LeaveRequest.objects.get(pk=object_id)
        if leave.status != "pending":
            messages.warning(request, f"Antrag #{leave.id} ist nicht im Status 'Ausstehend'.")
        else:
            leave.status = "approved"
            leave.approved_by = request.user
            leave.approved_at = timezone.now()
            leave.save()
            messages.success(request, f"Urlaubsantrag #{leave.id} wurde genehmigt.")
        return None

    @action(description="Ablehnen", url_path="reject")
    def reject_leave_detail(self, request, object_id):
        """Reject a single leave request from detail view."""
        leave = LeaveRequest.objects.get(pk=object_id)
        if leave.status != "pending":
            messages.warning(request, f"Antrag #{leave.id} ist nicht im Status 'Ausstehend'.")
        else:
            leave.status = "rejected"
            leave.approved_by = request.user
            leave.approved_at = timezone.now()
            leave.save()
            messages.success(request, f"Urlaubsantrag #{leave.id} wurde abgelehnt.")
        return None

    @admin.action(description="Ausgewählte Anträge genehmigen")
    def approve_leave_requests(self, request, queryset):
        """Bulk approve selected leave requests."""
        pending = queryset.filter(status="pending")
        count = pending.count()
        pending.update(
            status="approved",
            approved_by=request.user,
            approved_at=timezone.now(),
        )
        messages.success(request, f"{count} Urlaubsantrag/-anträge genehmigt.")

    @admin.action(description="Ausgewählte Anträge ablehnen")
    def reject_leave_requests(self, request, queryset):
        """Bulk reject selected leave requests."""
        pending = queryset.filter(status="pending")
        count = pending.count()
        pending.update(
            status="rejected",
            approved_by=request.user,
            approved_at=timezone.now(),
        )
        messages.success(request, f"{count} Urlaubsantrag/-anträge abgelehnt.")


# ---------------------------------------------------------------------------
# WorkingHoursLimit Admin
# ---------------------------------------------------------------------------


@admin.register(WorkingHoursLimit)
class WorkingHoursLimitAdmin(ModelAdmin):
    """Admin for working hours limits and break policies."""

    list_display = (
        "location",
        "max_hours_per_week",
        "max_hours_per_day",
        "min_break_duration_minutes",
        "min_break_after_hours",
        "is_active",
    )
    list_filter = ("is_active",)
    search_fields = ("location__name",)
    list_editable = ("is_active",)
    ordering = ("location__name",)
