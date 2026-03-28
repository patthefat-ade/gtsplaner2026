"""
Serializers for the GroupTransfer (temporary student group change) feature.
"""

from django.utils import timezone
from rest_framework import serializers

from groups.models import Group, Student
from groups.models_transfer import GroupTransfer


class GroupTransferListSerializer(serializers.ModelSerializer):
    """Serializer for listing group transfers."""

    student_name: str = serializers.SerializerMethodField()
    source_group_name: str = serializers.CharField(
        source="source_group.name", read_only=True
    )
    target_group_name: str = serializers.CharField(
        source="target_group.name", read_only=True
    )
    location_name: str = serializers.CharField(
        source="source_group.location.name", read_only=True
    )
    requested_by_name: str = serializers.SerializerMethodField()
    confirmed_by_name: str = serializers.SerializerMethodField()
    status_display: str = serializers.CharField(
        source="get_status_display", read_only=True
    )

    class Meta:
        model = GroupTransfer
        fields = [
            "id",
            "student",
            "student_name",
            "source_group",
            "source_group_name",
            "target_group",
            "target_group_name",
            "location_name",
            "transfer_date",
            "start_time",
            "end_time",
            "reason",
            "status",
            "status_display",
            "requested_by",
            "requested_by_name",
            "confirmed_by",
            "confirmed_by_name",
            "confirmed_at",
            "completed_at",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "confirmed_by",
            "confirmed_at",
            "completed_at",
            "created_at",
            "updated_at",
        ]

    def get_student_name(self, obj: GroupTransfer) -> str:
        return f"{obj.student.first_name} {obj.student.last_name}"

    def get_requested_by_name(self, obj: GroupTransfer) -> str:
        if obj.requested_by:
            return obj.requested_by.get_full_name()
        return ""

    def get_confirmed_by_name(self, obj: GroupTransfer) -> str:
        if obj.confirmed_by:
            return obj.confirmed_by.get_full_name()
        return ""


class GroupTransferCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new group transfer request."""

    class Meta:
        model = GroupTransfer
        fields = [
            "id",
            "student",
            "source_group",
            "target_group",
            "transfer_date",
            "start_time",
            "end_time",
            "reason",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs: dict) -> dict:
        source = attrs.get("source_group")
        target = attrs.get("target_group")
        student = attrs.get("student")

        if source and target:
            if source.location_id != target.location_id:
                raise serializers.ValidationError(
                    "Gruppenwechsel sind nur innerhalb desselben Standorts moeglich."
                )
            if source.id == target.id:
                raise serializers.ValidationError(
                    "Herkunfts- und Zielgruppe duerfen nicht identisch sein."
                )

        if student and source:
            if student.group_id != source.id:
                raise serializers.ValidationError(
                    "Der/die Schueler/in gehoert nicht zur angegebenen Herkunftsgruppe."
                )

        end_time = attrs.get("end_time")
        start_time = attrs.get("start_time")
        if end_time and start_time and end_time <= start_time:
            raise serializers.ValidationError(
                "Die Endzeit muss nach der Startzeit liegen."
            )

        return attrs

    def create(self, validated_data: dict) -> GroupTransfer:
        validated_data["requested_by"] = self.context["request"].user
        validated_data["status"] = GroupTransfer.Status.PENDING
        return super().create(validated_data)


class GroupTransferConfirmSerializer(serializers.Serializer):
    """Serializer for confirming or rejecting a transfer."""

    notes = serializers.CharField(required=False, default="", allow_blank=True)


class GroupTransferCompleteSerializer(serializers.Serializer):
    """Serializer for completing a transfer."""

    notes = serializers.CharField(required=False, default="", allow_blank=True)
