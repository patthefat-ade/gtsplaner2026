"""
WeeklyPlans serializers.
"""

from rest_framework import serializers

from weeklyplans.models import WeeklyPlan, WeeklyPlanEntry


class WeeklyPlanEntrySerializer(serializers.ModelSerializer):
    """Serializer for individual weekly plan entries."""
    day_name = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyPlanEntry
        fields = [
            "id", "day_of_week", "day_name", "start_time", "end_time",
            "activity", "description", "color", "category", "sort_order",
        ]

    def get_day_name(self, obj):
        return dict(WeeklyPlanEntry.DAY_CHOICES).get(obj.day_of_week, "")


class WeeklyPlanEntryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating entries (no id required)."""

    class Meta:
        model = WeeklyPlanEntry
        fields = [
            "id", "day_of_week", "start_time", "end_time",
            "activity", "description", "color", "category", "sort_order",
        ]
        extra_kwargs = {"id": {"required": False, "read_only": False}}


class WeeklyPlanListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views."""
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    location_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    calendar_week = serializers.IntegerField(read_only=True)
    entry_count = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyPlan
        fields = [
            "id", "group", "group_name", "location_name",
            "week_start_date", "calendar_week", "title", "status",
            "is_template", "template_name",
            "created_by", "created_by_name", "entry_count",
            "created_at", "updated_at",
        ]

    def get_location_name(self, obj):
        if obj.group and obj.group.location:
            return obj.group.location.name
        return ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return ""

    def get_entry_count(self, obj):
        return obj.entries.count()


class WeeklyPlanDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested entries for detail/edit views."""
    entries = WeeklyPlanEntrySerializer(many=True, read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    location_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    calendar_week = serializers.IntegerField(read_only=True)

    class Meta:
        model = WeeklyPlan
        fields = [
            "id", "group", "group_name", "location_name",
            "week_start_date", "calendar_week", "title", "notes",
            "status", "is_template", "template_name",
            "created_by", "created_by_name",
            "entries",
            "created_at", "updated_at",
        ]

    def get_location_name(self, obj):
        if obj.group and obj.group.location:
            return obj.group.location.name
        return ""

    def get_created_by_name(self, obj):
        if obj.created_by:
            return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()
        return ""


class WeeklyPlanCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating plans with nested entries."""
    entries = WeeklyPlanEntryCreateSerializer(many=True, required=False)

    class Meta:
        model = WeeklyPlan
        fields = [
            "id", "group", "week_start_date", "title", "notes",
            "status", "is_template", "template_name", "entries",
        ]

    def create(self, validated_data):
        entries_data = validated_data.pop("entries", [])
        request = self.context.get("request")
        if request and request.user:
            validated_data["created_by"] = request.user
            # Set organization from group or user
            if validated_data.get("group") and validated_data["group"].location:
                validated_data["organization"] = validated_data["group"].location.organization
            elif hasattr(request.user, "organization") and request.user.organization:
                validated_data["organization"] = request.user.organization
        plan = WeeklyPlan.objects.create(**validated_data)
        for entry_data in entries_data:
            entry_data.pop("id", None)
            WeeklyPlanEntry.objects.create(weekly_plan=plan, **entry_data)
        return plan

    def update(self, instance, validated_data):
        entries_data = validated_data.pop("entries", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if entries_data is not None:
            # Replace all entries with new data
            instance.entries.all().delete()
            for entry_data in entries_data:
                entry_data.pop("id", None)
                WeeklyPlanEntry.objects.create(weekly_plan=instance, **entry_data)

        return instance
