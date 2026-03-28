"""
Serializers for the Attendance module.

Provides serializers for listing, creating, and bulk-updating
attendance records for students in a group.
"""

from rest_framework import serializers

from groups.models_attendance import Attendance


class AttendanceSerializer(serializers.ModelSerializer):
    """Full attendance record serializer."""

    student_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = Attendance
        fields = [
            "id",
            "student",
            "group",
            "date",
            "status",
            "status_display",
            "notes",
            "recorded_by",
            "recorded_by_name",
            "student_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "recorded_by",
            "recorded_by_name",
            "student_name",
            "status_display",
            "created_at",
            "updated_at",
        ]

    def get_student_name(self, obj) -> str:
        if obj.student:
            return f"{obj.student.first_name or ''} {obj.student.last_name or ''}".strip()
        return ""

    def get_recorded_by_name(self, obj) -> str | None:
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}".strip()
        return None


class AttendanceCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a single attendance record."""

    class Meta:
        model = Attendance
        fields = ["student", "group", "date", "status", "notes"]

    def validate(self, data):
        """Ensure student belongs to the group."""
        student = data.get("student")
        group = data.get("group")
        if student and group and student.group_id != group.id:
            raise serializers.ValidationError(
                {"student": "Schüler:in gehört nicht zu dieser Gruppe."}
            )
        return data


class BulkAttendanceItemSerializer(serializers.Serializer):
    """Single item in a bulk attendance update."""

    student_id = serializers.IntegerField()
    status = serializers.ChoiceField(choices=Attendance.Status.choices)
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BulkAttendanceSerializer(serializers.Serializer):
    """
    Serializer for bulk attendance updates.

    Accepts a date and a list of attendance records for all students
    in a group. Creates or updates records as needed.
    """

    date = serializers.DateField()
    records = BulkAttendanceItemSerializer(many=True)
