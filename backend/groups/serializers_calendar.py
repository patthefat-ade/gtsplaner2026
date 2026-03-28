"""
Serializers for HolidayPeriod and AutonomousDay models.
"""

from rest_framework import serializers

from groups.models_calendar import AutonomousDay, HolidayPeriod


class HolidayPeriodSerializer(serializers.ModelSerializer):
    """Serializer for listing and retrieving holiday periods."""

    class Meta:
        model = HolidayPeriod
        fields = [
            "id",
            "school_year",
            "name",
            "start_date",
            "end_date",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class HolidayPeriodCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating holiday periods."""

    class Meta:
        model = HolidayPeriod
        fields = [
            "id",
            "school_year",
            "name",
            "start_date",
            "end_date",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "Enddatum darf nicht vor dem Startdatum liegen."}
            )
        return attrs


class AutonomousDaySerializer(serializers.ModelSerializer):
    """Serializer for listing and retrieving autonomous days."""

    class Meta:
        model = AutonomousDay
        fields = [
            "id",
            "school_year",
            "name",
            "date",
            "description",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


class AutonomousDayCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating autonomous days."""

    class Meta:
        model = AutonomousDay
        fields = [
            "id",
            "school_year",
            "name",
            "date",
            "description",
        ]
        read_only_fields = ["id"]
