"""
WeeklyPlans serializers.
"""

from rest_framework import serializers

from weeklyplans.models import DailyActivity, WeeklyPlan, WeeklyPlanEntry


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


class DailyActivitySerializer(serializers.ModelSerializer):
    """Serializer for daily activity descriptions."""
    day_name = serializers.SerializerMethodField()

    class Meta:
        model = DailyActivity
        fields = ["id", "day_of_week", "day_name", "content"]

    def get_day_name(self, obj):
        return dict(DailyActivity.DAY_CHOICES).get(obj.day_of_week, "")


class DailyActivityCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating daily activities (no id required)."""

    class Meta:
        model = DailyActivity
        fields = ["id", "day_of_week", "content"]
        extra_kwargs = {"id": {"required": False, "read_only": False}}


class WeeklyPlanListSerializer(serializers.ModelSerializer):
    """Compact serializer for list views."""
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    location_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    calendar_week = serializers.IntegerField(read_only=True)
    entry_count = serializers.SerializerMethodField()
    school_year_name = serializers.SerializerMethodField()
    weekly_theme_preview = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyPlan
        fields = [
            "id", "group", "group_name", "location_name",
            "week_start_date", "calendar_week", "title",
            "weekly_theme_preview", "school_year_name",
            "status", "is_template", "template_name",
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

    def get_school_year_name(self, obj):
        if obj.school_year:
            return str(obj.school_year)
        return ""

    def get_weekly_theme_preview(self, obj):
        """Return first 100 chars of weekly_theme, stripped of HTML tags."""
        if not obj.weekly_theme:
            return ""
        import re
        text = re.sub(r"<[^>]+>", "", obj.weekly_theme)
        return text[:100] + ("..." if len(text) > 100 else "")


class WeeklyPlanDetailSerializer(serializers.ModelSerializer):
    """Full serializer with nested entries for detail/edit views."""
    entries = WeeklyPlanEntrySerializer(many=True, read_only=True)
    daily_activities = DailyActivitySerializer(many=True, read_only=True)
    group_name = serializers.CharField(source="group.name", read_only=True, default="")
    location_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    calendar_week = serializers.IntegerField(read_only=True)
    week_end_date = serializers.DateField(read_only=True)
    school_year_name = serializers.SerializerMethodField()
    leader_name = serializers.SerializerMethodField()

    class Meta:
        model = WeeklyPlan
        fields = [
            "id", "group", "group_name", "location_name",
            "week_start_date", "week_end_date", "calendar_week",
            "title", "weekly_theme", "notes",
            "school_year", "school_year_name", "leader_name",
            "status", "is_template", "template_name",
            "created_by", "created_by_name",
            "entries", "daily_activities",
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

    def get_school_year_name(self, obj):
        if obj.school_year:
            return str(obj.school_year)
        return ""

    def get_leader_name(self, obj):
        """Return the group leader name if available."""
        if obj.group and hasattr(obj.group, "leader") and obj.group.leader:
            leader = obj.group.leader
            return f"{leader.first_name} {leader.last_name}".strip()
        return ""


# ── Default time slots for new weekly plans ────────────────────────────────

DEFAULT_TIME_SLOTS = [
    {
        "start_time": "11:20",
        "end_time": "12:10",
        "activity": "Kinder kommen",
        "category": "sonstiges",
        "sort_order": 0,
    },
    {
        "start_time": "12:20",
        "end_time": "13:00",
        "activity": "Mittagessen",
        "category": "essen",
        "sort_order": 1,
    },
    {
        "start_time": "13:10",
        "end_time": "14:00",
        "activity": "Lernstunde",
        "category": "lernen",
        "sort_order": 2,
    },
    {
        "start_time": "14:30",
        "end_time": "15:00",
        "activity": "Jausenzeit",
        "category": "essen",
        "sort_order": 3,
    },
    {
        "start_time": "15:00",
        "end_time": "16:15",
        "activity": "Betreute Freizeit",
        "category": "freizeit",
        "sort_order": 4,
    },
]


class WeeklyPlanCreateUpdateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating plans with nested entries and daily activities."""
    entries = WeeklyPlanEntryCreateSerializer(many=True, required=False)
    daily_activities = DailyActivityCreateSerializer(many=True, required=False)

    class Meta:
        model = WeeklyPlan
        fields = [
            "id", "group", "week_start_date", "title", "weekly_theme",
            "notes", "school_year",
            "status", "is_template", "template_name",
            "entries", "daily_activities",
        ]

    def create(self, validated_data):
        entries_data = validated_data.pop("entries", [])
        daily_activities_data = validated_data.pop("daily_activities", [])
        request = self.context.get("request")

        if request and request.user:
            validated_data["created_by"] = request.user
            # Set organization from group or user
            if validated_data.get("group") and validated_data["group"].location:
                validated_data["organization"] = validated_data["group"].location.organization
            elif hasattr(request.user, "organization") and request.user.organization:
                validated_data["organization"] = request.user.organization

        plan = WeeklyPlan.objects.create(**validated_data)

        # If no entries provided, create default time slots for all 5 days
        if not entries_data:
            for slot in DEFAULT_TIME_SLOTS:
                for day in range(5):
                    WeeklyPlanEntry.objects.create(
                        weekly_plan=plan,
                        day_of_week=day,
                        **slot,
                    )
        else:
            for entry_data in entries_data:
                entry_data.pop("id", None)
                WeeklyPlanEntry.objects.create(weekly_plan=plan, **entry_data)

        # Create daily activities
        for da_data in daily_activities_data:
            da_data.pop("id", None)
            DailyActivity.objects.create(weekly_plan=plan, **da_data)

        return plan

    def update(self, instance, validated_data):
        entries_data = validated_data.pop("entries", None)
        daily_activities_data = validated_data.pop("daily_activities", None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if entries_data is not None:
            # Replace all entries with new data
            instance.entries.all().delete()
            for entry_data in entries_data:
                entry_data.pop("id", None)
                WeeklyPlanEntry.objects.create(weekly_plan=instance, **entry_data)

        if daily_activities_data is not None:
            # Replace all daily activities
            instance.daily_activities.all().delete()
            for da_data in daily_activities_data:
                da_data.pop("id", None)
                DailyActivity.objects.create(weekly_plan=instance, **da_data)

        return instance
