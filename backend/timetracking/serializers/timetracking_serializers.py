"""
Serializers for Timetracking models: TimeEntry, LeaveType, LeaveRequest, WorkingHoursLimit.
"""

from rest_framework import serializers

from timetracking.models import LeaveRequest, LeaveType, TimeEntry, WorkingHoursLimit


# ---------------------------------------------------------------------------
# Nested / Compact Serializers
# ---------------------------------------------------------------------------

class TimetrackingUserCompactSerializer(serializers.Serializer):
    """Compact user representation for nested display in timetracking."""

    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


class LeaveTypeCompactSerializer(serializers.ModelSerializer):
    """Compact leave type for nested display."""

    class Meta:
        model = LeaveType
        fields = ["id", "name"]


# ---------------------------------------------------------------------------
# TimeEntry Serializers
# ---------------------------------------------------------------------------

class TimeEntryListSerializer(serializers.ModelSerializer):
    """Serializer for listing time entries."""

    user = TimetrackingUserCompactSerializer(read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True)
    duration_hours = serializers.SerializerMethodField()

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "user",
            "group",
            "group_name",
            "date",
            "start_time",
            "end_time",
            "duration_minutes",
            "duration_hours",
            "notes",
            "created_at",
        ]
        read_only_fields = ["id", "duration_minutes", "created_at"]

    def get_duration_hours(self, obj) -> str:
        if obj.duration_minutes:
            return f"{obj.duration_minutes / 60:.1f}"
        return "0.0"


class TimeEntryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating time entries."""

    class Meta:
        model = TimeEntry
        fields = [
            "id",
            "group",
            "date",
            "start_time",
            "end_time",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_time", getattr(self.instance, "start_time", None))
        end = attrs.get("end_time", getattr(self.instance, "end_time", None))
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_time": "Endzeit muss nach der Startzeit liegen."}
            )
        return attrs


# ---------------------------------------------------------------------------
# LeaveType Serializers
# ---------------------------------------------------------------------------

class LeaveTypeSerializer(serializers.ModelSerializer):
    """Serializer for leave types (full CRUD)."""

    class Meta:
        model = LeaveType
        fields = [
            "id",
            "name",
            "description",
            "requires_approval",
            "max_days_per_year",
            "is_system_type",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "is_system_type", "created_at"]


# ---------------------------------------------------------------------------
# LeaveRequest Serializers
# ---------------------------------------------------------------------------

class LeaveRequestListSerializer(serializers.ModelSerializer):
    """Serializer for listing leave requests."""

    user = TimetrackingUserCompactSerializer(read_only=True)
    leave_type = LeaveTypeCompactSerializer(read_only=True)
    approved_by = TimetrackingUserCompactSerializer(read_only=True)

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "user",
            "leave_type",
            "start_date",
            "end_date",
            "total_days",
            "reason",
            "status",
            "approved_by",
            "approved_at",
            "approval_notes",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "total_days",
            "status",
            "approved_by",
            "approved_at",
            "created_at",
        ]


class LeaveRequestCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a leave request."""

    class Meta:
        model = LeaveRequest
        fields = [
            "id",
            "leave_type",
            "start_date",
            "end_date",
            "reason",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "Enddatum muss nach dem Startdatum liegen."}
            )
        return attrs


class LeaveRequestApprovalSerializer(serializers.Serializer):
    """Serializer for approve/reject actions on leave requests."""

    approval_notes = serializers.CharField(required=False, allow_blank=True, default="")


# ---------------------------------------------------------------------------
# WorkingHoursLimit Serializers
# ---------------------------------------------------------------------------

class WorkingHoursLimitSerializer(serializers.ModelSerializer):
    """Serializer for working hours limits."""

    location_name = serializers.CharField(source="location.name", read_only=True)

    class Meta:
        model = WorkingHoursLimit
        fields = [
            "id",
            "location",
            "location_name",
            "max_hours_per_week",
            "max_hours_per_day",
            "min_break_duration_minutes",
            "min_break_after_hours",
            "require_break_confirmation",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]
