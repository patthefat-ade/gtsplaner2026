"""
Serializers for the Events module.
"""

from rest_framework import serializers

from events.models import Event, EventParticipant


class EventParticipantListSerializer(serializers.ModelSerializer):
    """Compact participant representation for event lists."""

    student_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()

    class Meta:
        model = EventParticipant
        fields = [
            "id",
            "student",
            "student_name",
            "group_name",
            "consent_status",
            "consent_date",
            "consent_given_by",
            "attendance_status",
            "notes",
        ]

    def get_student_name(self, obj) -> str:
        if obj.student:
            return f"{obj.student.first_name} {obj.student.last_name}"
        return ""

    def get_group_name(self, obj) -> str:
        if obj.student and obj.student.group:
            return obj.student.group.name
        return ""


class EventParticipantCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating participants."""

    class Meta:
        model = EventParticipant
        fields = [
            "id",
            "student",
            "consent_status",
            "consent_date",
            "consent_given_by",
            "consent_notes",
            "attendance_status",
            "notes",
        ]


class EventListSerializer(serializers.ModelSerializer):
    """Compact event representation for list views."""

    event_type_display = serializers.CharField(
        source="get_event_type_display", read_only=True
    )
    status_display = serializers.CharField(
        source="get_status_display", read_only=True
    )
    location_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    participant_count = serializers.IntegerField(read_only=True)
    consent_count = serializers.IntegerField(read_only=True)
    group_names = serializers.SerializerMethodField()

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "event_type",
            "event_type_display",
            "status",
            "status_display",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "venue",
            "location_name",
            "estimated_cost",
            "cost_per_student",
            "requires_consent",
            "consent_deadline",
            "participant_count",
            "consent_count",
            "group_names",
            "created_by_name",
            "created_at",
        ]

    def get_location_name(self, obj) -> str:
        return obj.location.name if obj.location else ""

    def get_created_by_name(self, obj) -> str:
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}"
        return ""

    def get_group_names(self, obj) -> list:
        return list(obj.groups.values_list("name", flat=True))


class EventDetailSerializer(EventListSerializer):
    """Full event representation with participants and transactions."""

    participants = EventParticipantListSerializer(many=True, read_only=True)
    transaction_ids = serializers.PrimaryKeyRelatedField(
        source="transactions",
        many=True,
        read_only=True,
    )
    school_year_name = serializers.SerializerMethodField()

    class Meta(EventListSerializer.Meta):
        fields = EventListSerializer.Meta.fields + [
            "description",
            "meeting_point",
            "consent_text",
            "notes",
            "internal_notes",
            "school_year",
            "school_year_name",
            "participants",
            "transaction_ids",
            "updated_at",
        ]

    def get_school_year_name(self, obj) -> str:
        if obj.school_year:
            return obj.school_year.name
        return ""


class EventCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating events."""

    class Meta:
        model = Event
        fields = [
            "id",
            "title",
            "description",
            "event_type",
            "status",
            "start_date",
            "end_date",
            "start_time",
            "end_time",
            "venue",
            "meeting_point",
            "estimated_cost",
            "cost_per_student",
            "location",
            "school_year",
            "groups",
            "requires_consent",
            "consent_deadline",
            "consent_text",
            "notes",
            "internal_notes",
        ]
        read_only_fields = ["id"]

    def validate(self, data):
        """Validate date range."""
        start = data.get("start_date")
        end = data.get("end_date")
        if start and end and end < start:
            raise serializers.ValidationError(
                {"end_date": "Das Enddatum darf nicht vor dem Startdatum liegen."}
            )
        return data
