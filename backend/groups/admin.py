"""
Groups admin configuration with Django Unfold.

Registers SchoolYear, Semester, Group, GroupMember, and Student models
with rich admin interfaces including filters, search, and inline editing.
"""

from django.contrib import admin, messages
from django.http import HttpResponse
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


def anonymize_students(modeladmin, request, queryset):
    """Admin action: Pseudoanonymize selected students (GDPR/DSGVO)."""
    from system.gdpr_service import GDPRService

    count = 0
    for student in queryset:
        if student.is_anonymized:
            continue
        GDPRService.anonymize_student(student)
        count += 1
    messages.success(request, f"{count} Schüler:innen erfolgreich anonymisiert.")


anonymize_students.short_description = "DSGVO: Ausgewählte Schüler:innen anonymisieren"


def export_student_data(modeladmin, request, queryset):
    """Admin action: Export student data as ZIP (GDPR Art. 15)."""
    from system.gdpr_service import GDPRService

    if queryset.count() != 1:
        messages.error(request, "Bitte wählen Sie genau eine:n Schüler:in für den Datenexport aus.")
        return

    student = queryset.first()
    zip_buffer = GDPRService.export_student_data(student)

    filename = f"dsgvo_export_schueler_{student.pk}_{student.last_name}.zip"
    response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response


export_student_data.short_description = "DSGVO: Datenexport (Auskunftsanfrage)"


@admin.register(Student)
class StudentAdmin(ModelAdmin):
    """Admin for students/children."""

    list_display = (
        "last_name",
        "first_name",
        "group",
        "date_of_birth",
        "is_active",
        "is_anonymized_display",
    )
    list_filter = ("is_active", "group__location", "group")
    search_fields = ("group__name",)  # Encrypted fields cannot be searched
    ordering = ("id",)  # Encrypted fields cannot be ordered
    actions = [anonymize_students, export_student_data]

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
                "fields": ("is_active", "is_deleted", "anonymized_at", "created_at", "updated_at"),
                "classes": ("collapse",),
            },
        ),
    )
    readonly_fields = ("created_at", "updated_at", "anonymized_at")

    @admin.display(boolean=True, description="Anonymisiert")
    def is_anonymized_display(self, obj):
        return obj.anonymized_at is not None


# Attendance Admin
from .models_attendance import Attendance


@admin.register(Attendance)
class AttendanceAdmin(ModelAdmin):
    list_display = ["student", "group", "date", "status", "recorded_by", "is_deleted"]
    list_filter = ["status", "date", "is_deleted", "group"]
    search_fields = ["student__first_name", "student__last_name", "notes"]
    date_hierarchy = "date"
    readonly_fields = ["created_at", "updated_at"]
    list_per_page = 50
