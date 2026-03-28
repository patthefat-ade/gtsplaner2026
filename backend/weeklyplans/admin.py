"""
WeeklyPlans admin configuration with Django Unfold.
"""

from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from weeklyplans.models import DailyActivity, WeeklyPlan, WeeklyPlanEntry


class WeeklyPlanEntryInline(TabularInline):
    model = WeeklyPlanEntry
    extra = 0
    fields = ("day_of_week", "start_time", "end_time", "activity", "category", "color", "sort_order")


class DailyActivityInline(TabularInline):
    model = DailyActivity
    extra = 0
    fields = ("day_of_week", "content")


@admin.register(WeeklyPlan)
class WeeklyPlanAdmin(ModelAdmin):
    list_display = ("__str__", "group", "week_start_date", "status", "is_template", "school_year", "created_by", "created_at")
    list_filter = ("status", "is_template", "school_year", "created_at")
    search_fields = ("title", "template_name", "group__name", "weekly_theme")
    readonly_fields = ("created_at", "updated_at")
    inlines = [WeeklyPlanEntryInline, DailyActivityInline]


@admin.register(WeeklyPlanEntry)
class WeeklyPlanEntryAdmin(ModelAdmin):
    list_display = ("weekly_plan", "day_of_week", "start_time", "end_time", "activity", "category")
    list_filter = ("day_of_week", "category")
    search_fields = ("activity", "description")


@admin.register(DailyActivity)
class DailyActivityAdmin(ModelAdmin):
    list_display = ("weekly_plan", "day_of_week", "content_preview")
    list_filter = ("day_of_week",)
    search_fields = ("content",)

    def content_preview(self, obj):
        import re
        text = re.sub(r"<[^>]+>", "", obj.content or "")
        return text[:80] + ("..." if len(text) > 80 else "")
    content_preview.short_description = "Inhalt"
