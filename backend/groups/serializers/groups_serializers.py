"""
Serializers for Groups models: SchoolYear, Semester, Group, GroupMember, Student.
"""

from rest_framework import serializers

from core.models import Location
from groups.models import Group, GroupMember, SchoolYear, Semester, Student


# ---------------------------------------------------------------------------
# Nested / Compact Serializers
# ---------------------------------------------------------------------------

class UserCompactSerializer(serializers.Serializer):
    """Compact user representation for nested display."""

    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    role = serializers.CharField(read_only=True)


# ---------------------------------------------------------------------------
# Semester Serializers
# ---------------------------------------------------------------------------

class SemesterSerializer(serializers.ModelSerializer):
    """Serializer for semester display and CRUD."""

    class Meta:
        model = Semester
        fields = [
            "id",
            "school_year",
            "name",
            "start_date",
            "end_date",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SemesterCompactSerializer(serializers.ModelSerializer):
    """Compact semester for nested display."""

    name_display = serializers.CharField(source="get_name_display", read_only=True)

    class Meta:
        model = Semester
        fields = ["id", "name", "name_display", "start_date", "end_date", "is_active"]


# ---------------------------------------------------------------------------
# SchoolYear Serializers
# ---------------------------------------------------------------------------

class SchoolYearListSerializer(serializers.ModelSerializer):
    """Serializer for listing school years."""

    location_name = serializers.CharField(source="location.name", read_only=True)
    semesters = SemesterCompactSerializer(many=True, read_only=True)

    class Meta:
        model = SchoolYear
        fields = [
            "id",
            "location",
            "location_name",
            "name",
            "start_date",
            "end_date",
            "is_active",
            "semesters",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class SchoolYearCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating school years."""

    class Meta:
        model = SchoolYear
        fields = [
            "id",
            "name",
            "start_date",
            "end_date",
            "is_active",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        start = attrs.get("start_date")
        end = attrs.get("end_date")
        if start and end and end <= start:
            raise serializers.ValidationError(
                {"end_date": "Enddatum muss nach dem Startdatum liegen."}
            )
        return attrs


# ---------------------------------------------------------------------------
# GroupMember Serializers
# ---------------------------------------------------------------------------

class GroupMemberSerializer(serializers.ModelSerializer):
    """Serializer for group member display."""

    user_id = serializers.IntegerField(source="user.id", read_only=True)
    first_name = serializers.CharField(source="user.first_name", read_only=True)
    last_name = serializers.CharField(source="user.last_name", read_only=True)
    user_role = serializers.CharField(source="user.role", read_only=True)

    class Meta:
        model = GroupMember
        fields = [
            "id",
            "user_id",
            "first_name",
            "last_name",
            "user_role",
            "role",
            "is_active",
            "joined_at",
            "left_at",
        ]
        read_only_fields = ["id", "joined_at"]


class GroupMemberCreateSerializer(serializers.ModelSerializer):
    """Serializer for adding a member to a group."""

    class Meta:
        model = GroupMember
        fields = [
            "id",
            "group",
            "user",
            "role",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        group = attrs.get("group")
        user = attrs.get("user")
        if group and user:
            if GroupMember.objects.filter(group=group, user=user).exists():
                raise serializers.ValidationError(
                    "Dieser Benutzer ist bereits Mitglied dieser Gruppe."
                )
        return attrs


# ---------------------------------------------------------------------------
# Student Serializers
# ---------------------------------------------------------------------------

class StudentListSerializer(serializers.ModelSerializer):
    """Serializer for listing students."""

    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "group",
            "group_name",
            "first_name",
            "last_name",
            "date_of_birth",
            "email",
            "phone",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class StudentCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating students."""

    class Meta:
        model = Student
        fields = [
            "id",
            "group",
            "first_name",
            "last_name",
            "date_of_birth",
            "email",
            "phone",
            "street",
            "city",
            "postal_code",
            "is_active",
        ]
        read_only_fields = ["id"]


class StudentDetailSerializer(serializers.ModelSerializer):
    """Serializer for student detail view (includes address)."""

    group_name = serializers.CharField(source="group.name", read_only=True)

    class Meta:
        model = Student
        fields = [
            "id",
            "group",
            "group_name",
            "first_name",
            "last_name",
            "date_of_birth",
            "email",
            "phone",
            "street",
            "city",
            "postal_code",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]


# ---------------------------------------------------------------------------
# Group Serializers
# ---------------------------------------------------------------------------

class GroupListSerializer(serializers.ModelSerializer):
    """Serializer for listing groups (compact)."""

    location_name = serializers.CharField(source="location.name", read_only=True)
    school_year_name = serializers.CharField(source="school_year.name", read_only=True)
    leader = UserCompactSerializer(read_only=True)
    member_count = serializers.IntegerField(source="members.count", read_only=True)
    student_count = serializers.IntegerField(source="students.count", read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "location",
            "location_name",
            "school_year",
            "school_year_name",
            "name",
            "description",
            "leader",
            "member_count",
            "student_count",
            "balance",
            "currency",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "balance", "created_at"]


class GroupDetailSerializer(serializers.ModelSerializer):
    """Serializer for group detail view (includes members and students)."""

    location_name = serializers.CharField(source="location.name", read_only=True)
    school_year_name = serializers.CharField(source="school_year.name", read_only=True)
    leader = UserCompactSerializer(read_only=True)
    members = GroupMemberSerializer(many=True, read_only=True)
    students = StudentListSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = [
            "id",
            "location",
            "location_name",
            "school_year",
            "school_year_name",
            "name",
            "description",
            "leader",
            "members",
            "students",
            "balance",
            "currency",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "balance", "created_at", "updated_at"]


class GroupCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating groups."""

    location = serializers.PrimaryKeyRelatedField(
        queryset=Location.objects.filter(is_active=True),
        required=False,
        help_text="Standort-ID (erforderlich fuer Admins ohne eigenen Standort)",
    )

    class Meta:
        model = Group
        fields = [
            "id",
            "location",
            "school_year",
            "name",
            "description",
            "leader",
            "is_active",
        ]
        read_only_fields = ["id"]
