"""
Task serializers for the task management API.
"""

from rest_framework import serializers

from core.models import User
from tasks.models import Task


class TaskListSerializer(serializers.ModelSerializer):
    """Serializer for task list views – includes computed fields."""

    created_by_name = serializers.SerializerMethodField()
    assigned_to_name = serializers.SerializerMethodField()
    location_name = serializers.SerializerMethodField()
    group_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "created_by",
            "created_by_name",
            "assigned_to",
            "assigned_to_name",
            "location",
            "location_name",
            "group",
            "group_name",
            "is_overdue",
            "completed_at",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "completed_at", "created_at", "updated_at"]

    def get_created_by_name(self, obj):
        return obj.created_by.get_full_name() if obj.created_by else ""

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.get_full_name() if obj.assigned_to else ""

    def get_location_name(self, obj):
        return obj.location.name if obj.location else None

    def get_group_name(self, obj):
        return obj.group.name if obj.group else None


class TaskCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating and updating tasks."""

    class Meta:
        model = Task
        fields = [
            "id",
            "title",
            "description",
            "status",
            "priority",
            "due_date",
            "assigned_to",
            "location",
            "group",
        ]

    def validate_assigned_to(self, value):
        """Ensure the assigned user belongs to the same organization."""
        from core.middleware import ensure_tenant_context

        request = self.context.get("request")
        if request:
            ensure_tenant_context(request)
            tenant_ids = getattr(request, "tenant_ids", [])
            if tenant_ids and value.organization_id not in tenant_ids:
                raise serializers.ValidationError(
                    "Der zugewiesene Benutzer gehört nicht zu Ihrer Organisation."
                )
        return value


class TaskStatusSerializer(serializers.Serializer):
    """Serializer for changing task status."""

    status = serializers.ChoiceField(choices=Task.Status.choices)
