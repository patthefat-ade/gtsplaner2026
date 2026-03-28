"""Serializers for DailyProtocol model."""
from rest_framework import serializers

from groups.models_protocol import DailyProtocol


class DailyProtocolSerializer(serializers.ModelSerializer):
    """Read serializer for DailyProtocol with nested names."""

    student_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    effective_group_name = serializers.SerializerMethodField()
    picked_up_by_name = serializers.SerializerMethodField()
    recorded_by_name = serializers.SerializerMethodField()
    school_year_name = serializers.SerializerMethodField()
    has_transfer = serializers.SerializerMethodField()

    class Meta:
        model = DailyProtocol
        fields = [
            "id",
            "student",
            "student_name",
            "date",
            "group",
            "group_name",
            "effective_group",
            "effective_group_name",
            "transfer",
            "has_transfer",
            "school_year",
            "school_year_name",
            "arrival_time",
            "arrival_notes",
            "incidents",
            "incident_severity",
            "pickup_time",
            "picked_up_by",
            "picked_up_by_name",
            "pickup_notes",
            "recorded_by",
            "recorded_by_name",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_student_name(self, obj) -> str:
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return ""

    def get_group_name(self, obj) -> str:
        if obj.group:
            return obj.group.name
        return ""

    def get_effective_group_name(self, obj) -> str:
        if obj.effective_group:
            return obj.effective_group.name
        return ""

    def get_picked_up_by_name(self, obj) -> str:
        if obj.picked_up_by:
            return f"{obj.picked_up_by.first_name} {obj.picked_up_by.last_name}"
        return ""

    def get_recorded_by_name(self, obj) -> str:
        if obj.recorded_by:
            return f"{obj.recorded_by.first_name} {obj.recorded_by.last_name}"
        return ""

    def get_school_year_name(self, obj) -> str:
        if obj.school_year:
            return obj.school_year.name
        return ""

    def get_has_transfer(self, obj) -> bool:
        return obj.transfer_id is not None


class DailyProtocolCreateSerializer(serializers.ModelSerializer):
    """Write serializer for creating/updating a DailyProtocol."""

    class Meta:
        model = DailyProtocol
        fields = [
            "id",
            "student",
            "date",
            "group",
            "effective_group",
            "transfer",
            "school_year",
            "arrival_time",
            "arrival_notes",
            "incidents",
            "incident_severity",
            "pickup_time",
            "picked_up_by",
            "pickup_notes",
        ]
        read_only_fields = ["id"]


class BulkDailyProtocolSerializer(serializers.Serializer):
    """Serializer for bulk creating/updating protocols for a group on a date."""

    group_id = serializers.IntegerField()
    date = serializers.DateField()
    school_year_id = serializers.IntegerField(required=False, allow_null=True)
    records = serializers.ListField(
        child=serializers.DictField(),
        min_length=1,
    )
