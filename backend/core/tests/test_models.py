"""Tests for Core models – User, Organization, Location."""

import pytest
from core.models import Location, Organization, User


@pytest.mark.django_db
class TestUserModel:
    """Tests for the custom User model."""

    def test_create_user(self, educator_user: User) -> None:
        """Test that a user can be created with the correct role."""
        assert educator_user.username == "educator"
        assert educator_user.role == User.Role.EDUCATOR
        assert educator_user.is_educator is True
        assert educator_user.is_location_manager is False
        assert educator_user.is_admin_role is False
        assert educator_user.is_super_admin is False

    def test_user_str(self, educator_user: User) -> None:
        """Test the string representation of a user."""
        expected = f"{educator_user.get_full_name()} ({educator_user.get_role_display()})"
        assert str(educator_user) == expected

    def test_role_choices(self) -> None:
        """Test that all four roles are defined."""
        roles = [choice[0] for choice in User.Role.choices]
        assert "educator" in roles
        assert "location_manager" in roles
        assert "admin" in roles
        assert "super_admin" in roles

    def test_location_manager_role(self, location_manager_user: User) -> None:
        """Test Location Manager role properties."""
        assert location_manager_user.is_location_manager is True
        assert location_manager_user.is_educator is False

    def test_admin_role(self, admin_user: User) -> None:
        """Test Admin role properties."""
        assert admin_user.is_admin_role is True

    def test_super_admin_role(self, super_admin_user: User) -> None:
        """Test Super Admin role properties."""
        assert super_admin_user.is_super_admin is True
        assert super_admin_user.is_staff is True


@pytest.mark.django_db
class TestOrganizationModel:
    """Tests for the Organization model."""

    def test_create_organization(self, organization: Organization) -> None:
        """Test that an organization can be created."""
        assert organization.name == "Test Organisation"
        assert organization.is_active is True
        assert organization.is_deleted is False

    def test_organization_str(self, organization: Organization) -> None:
        """Test the string representation of an organization."""
        assert str(organization) == "Test Organisation"


@pytest.mark.django_db
class TestLocationModel:
    """Tests for the Location model."""

    def test_create_location(self, location: Location) -> None:
        """Test that a location can be created."""
        assert location.name == "Test Standort"
        assert location.organization is not None
        assert location.is_active is True

    def test_location_str(self, location: Location) -> None:
        """Test the string representation of a location."""
        assert "Test Standort" in str(location)
        assert "Test Organisation" in str(location)
