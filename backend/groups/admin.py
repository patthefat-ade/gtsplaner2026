"""
Groups admin configuration with Django Unfold.

Registers SchoolYear, Semester, Group, GroupMember, and Student models
with rich admin interfaces including filters, search, and inline editing.
"""

from django.contrib import admin
from unfold.admin import ModelAdmin, TabularInline

from .models import Group, GroupMember, SchoolYear, Semester, Student


class SemesterInline(TabularInline):
    """Inline for semesters within a school year."""

    model = Semester
    extra = 0
    fields = ("name", "start_date", "end_date", "is_active")


class GroupMemberInline(TabularInline):
    """Inline for group members within a group."""

    model = GroupMember
    extra = 0
    fields = ("user", "role", "is_active", "joined_at", "left_at")
    readonly_fields = ("joined_at",)


class StudentInline(TabularInline):
    """Inline for students within a group."""

    model = Student
    extra = 0
    fields = ("first_name", "last_name", "date_of_birth", "email", "phone", "is_active")


@admin.register(SchoolYear)
class SchoolYearAdmin(ModelAdmin):
    """Admin for school years."""

    list_display = (
        "name",
        "location",
        "start_date",
        "end_date",
        "is_active",
    )
    list_filter = ("is_active", "location")
    search_fields = ("name", "location__name")
    list_editable = ("is_active",)
    ordering = ("-start_date",)
    inlines = [SemesterInline]

    fieldsets = (
        (
            "Schuljahr",
            {
                "fields": ("location", "name", "start_date", "end_date", "is_active"),
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
    readonly_fields = ("created_at", "updated_at")


@admin.register(Semester)
class SemesterAdmin(ModelAdmin):
    """Admin for semesters."""

    list_display = (
        "name",
        "school_year",
        "start_date",
        "end_date",
        "is_active",
    )
    list_filter = ("name", "is_active", "school_year__location")
    search_fields = ("school_year__name",)
    list_editable = ("is_active",)
    ordering = ("start_date",)


@admin.register(Group)
class GroupAdmin(ModelAdmin):
    """Admin for groups with member and student inlines."""

    list_display = (
        "name",
        "location",
        "school_year",
        "leader",
        "balance",
        "is_active",
    )
    list_filter = ("is_active", "location", "school_year")
    search_fields = ("name", "description", "leader__first_name", "leader__last_name")
    ordering = ("name",)
    inlines = [GroupMemberInline, StudentInline]

    fieldsets = (
        (
            "Gruppe",
            {
                "fields": (
                    "location",
                    "school_year",
                    "name",
                    "description",
                    "leader",
                ),
            },
        ),
        (
            "Finanzen",
            {
                "fields": ("balance", "currency"),
            },
        ),
        (
            "System",
            {
                "fields": ("is_active", "is_deleted", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
    readonly_fields = ("created_at", "updated_at")


@admin.register(GroupMember)
class GroupMemberAdmin(ModelAdmin):
    """Admin for group memberships."""

    list_display = (
        "user",
        "group",
        "role",
        "is_active",
        "joined_at",
        "left_at",
    )
    list_filter = ("role", "is_active", "group__location")
    search_fields = (
        "user__first_name",
        "user__last_name",
        "group__name",
    )
    readonly_fields = ("joined_at",)
    ordering = ("group__name", "user__last_name")


@admin.register(Student)
class StudentAdmin(ModelAdmin):
    """Admin for students/children."""

    list_display = (
        "last_name",
        "first_name",
        "group",
        "date_of_birth",
        "is_active",
    )
    list_filter = ("is_active", "group__location", "group")
    search_fields = ("first_name", "last_name", "email")
    ordering = ("last_name", "first_name")

    fieldsets = (
        (
            "Persoenliche Daten",
            {
                "fields": (
                    "group",
                    "first_name",
                    "last_name",
                    "date_of_birth",
                ),
            },
        ),
        (
            "Kontakt",
            {
                "fields": ("email", "phone"),
                "classes": ("collapse",),
            },
        ),
        (
            "Adresse",
            {
                "fields": ("street", "city", "postal_code"),
                "classes": ("collapse",),
            },
        ),
        (
            "System",
            {
                "fields": ("is_active", "is_deleted", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
    readonly_fields = ("created_at", "updated_at")
