"""
WeeklyPlans admin configuration with Django Unfold.
"""

from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from weeklyplans.models import WeeklyPlan, WeeklyPlanEntry


class WeeklyPlanEntryInline(TabularInline):
    model = WeeklyPlanEntry
    extra = 0
    fields = ("day_of_week", "start_time", "end_time", "activity", "category", "color", "sort_order")


@admin.register(WeeklyPlan)
class WeeklyPlanAdmin(ModelAdmin):
    list_display = ("__str__", "group", "week_start_date", "status", "is_template", "created_by", "created_at")
    list_filter = ("status", "is_template", "created_at")
    search_fields = ("title", "template_name", "group__name")
    readonly_fields = ("created_at", "updated_at")
    inlines = [WeeklyPlanEntryInline]


@admin.register(WeeklyPlanEntry)
class WeeklyPlanEntryAdmin(ModelAdmin):
    list_display = ("weekly_plan", "day_of_week", "start_time", "end_time", "activity", "category")
    list_filter = ("day_of_week", "category")
    search_fields = ("activity", "description")
