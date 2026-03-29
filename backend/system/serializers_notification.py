"""Serializers for in-app notifications."""

from rest_framework import serializers

from system.models import InAppNotification


class InAppNotificationSerializer(serializers.ModelSerializer):
    """Serializer for in-app notifications."""

    related_task_title = serializers.SerializerMethodField()

    class Meta:
        model = InAppNotification
        fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "related_task",
            "related_task_title",
            "is_read",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "title",
            "message",
            "notification_type",
            "related_task",
            "created_at",
        ]

    def get_related_task_title(self, obj):
        return obj.related_task.title if obj.related_task else None
