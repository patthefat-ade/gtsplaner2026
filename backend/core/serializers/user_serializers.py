"""
Serializers for user-related endpoints.

Provides serialization for user profiles and user management (admin).
"""

from rest_framework import serializers

from core.models import Location, Organization, User


class LocationMinimalSerializer(serializers.ModelSerializer):
    """Minimal location serializer for nested use."""

    class Meta:
        model = Location
        fields = ["id", "name", "city"]


class OrganizationMinimalSerializer(serializers.ModelSerializer):
    """Minimal organization serializer for nested use."""

    class Meta:
        model = Organization
        fields = ["id", "name"]


class UserProfileSerializer(serializers.ModelSerializer):
    """Serializer for the authenticated user's profile (GET /api/v1/auth/me/)."""

    location_detail = LocationMinimalSerializer(source="location", read_only=True)
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "location",
            "location_detail",
            "phone",
            "profile_picture",
            "is_active",
            "last_login",
            "date_joined",
            "last_password_change",
        ]
        read_only_fields = [
            "id",
            "username",
            "email",
            "role",
            "is_active",
            "last_login",
            "date_joined",
            "last_password_change",
        ]

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()


class UserProfileUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating the authenticated user's profile."""

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "phone",
            "profile_picture",
        ]


# ---------------------------------------------------------------------------
# User Management Serializers (Admin)
# ---------------------------------------------------------------------------

class UserListSerializer(serializers.ModelSerializer):
    """Serializer for listing users (admin view)."""

    location_detail = LocationMinimalSerializer(source="location", read_only=True)
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "location",
            "location_detail",
            "phone",
            "is_active",
            "last_login",
            "date_joined",
        ]
        read_only_fields = fields

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()


class UserCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new user (admin only)."""

    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "password",
            "role",
            "location",
            "phone",
            "is_active",
        ]
        read_only_fields = ["id"]

    def create(self, validated_data):
        password = validated_data.pop("password")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class UserUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating a user (admin only)."""

    class Meta:
        model = User
        fields = [
            "first_name",
            "last_name",
            "email",
            "role",
            "location",
            "phone",
            "is_active",
        ]


class UserDetailSerializer(serializers.ModelSerializer):
    """Serializer for user detail view (admin)."""

    location_detail = LocationMinimalSerializer(source="location", read_only=True)
    full_name = serializers.SerializerMethodField()
    role_display = serializers.CharField(source="get_role_display", read_only=True)

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "full_name",
            "role",
            "role_display",
            "location",
            "location_detail",
            "phone",
            "profile_picture",
            "is_active",
            "last_login",
            "date_joined",
            "last_password_change",
        ]
        read_only_fields = fields

    def get_full_name(self, obj: User) -> str:
        return obj.get_full_name()
