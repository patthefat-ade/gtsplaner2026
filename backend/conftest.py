"""
Shared pytest fixtures for the Kassenbuch App v2 backend.

Provides reusable fixtures for users, organizations, locations,
and authenticated API clients.
"""

import pytest
from django.core.cache import cache
from django.core.management import call_command
from django.test import override_settings
from rest_framework.test import APIClient

from core.models import Location, Organization, User

__all__ = ["_assign_auth_group"]


@pytest.fixture(autouse=True)
def clear_throttle_cache():
    """Clear the throttle cache before each test to prevent 429 responses."""
    cache.clear()
    yield
    cache.clear()


@pytest.fixture(autouse=True)
def setup_permissions(db):
    """Ensure Django auth groups and permissions are created for every test."""
    call_command("setup_permissions", verbosity=0)


def _assign_auth_group(user: User) -> User:
    """Assign the Django auth group matching the user's role."""
    from django.contrib.auth.models import Group as AuthGroup
    from core.permissions import ROLE_TO_GROUP
    group_name = ROLE_TO_GROUP.get(user.role)
    if group_name:
        try:
            auth_group = AuthGroup.objects.get(name=group_name)
            user.groups.add(auth_group)
        except AuthGroup.DoesNotExist:
            pass
    return user


@pytest.fixture
def api_client() -> APIClient:
    """Return an unauthenticated DRF APIClient."""
    return APIClient()


@pytest.fixture
def organization(db) -> Organization:
    """Create and return a test organization."""
    return Organization.objects.create(
        name="Test Organisation",
        email="org@test.at",
        street="Teststraße 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def location(db, organization: Organization) -> Location:
    """Create and return a test location."""
    return Location.objects.create(
        organization=organization,
        name="Test Standort",
        email="standort@test.at",
        street="Standortstraße 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def educator_user(db, location: Location, setup_permissions) -> User:
    """Create and return a test user with Educator role."""
    user = User.objects.create_user(
        username="educator",
        email="educator@test.at",
        password="TestPass123!",
        first_name="Test",
        last_name="Pädagogin",
        role=User.Role.EDUCATOR,
        location=location,
    )
    return _assign_auth_group(user)


@pytest.fixture
def location_manager_user(db, location: Location, setup_permissions) -> User:
    """Create and return a test user with Location Manager role."""
    user = User.objects.create_user(
        username="manager",
        email="manager@test.at",
        password="TestPass123!",
        first_name="Test",
        last_name="Standortleitung",
        role=User.Role.LOCATION_MANAGER,
        location=location,
    )
    return _assign_auth_group(user)


@pytest.fixture
def admin_user(db, setup_permissions) -> User:
    """Create and return a test user with Admin role."""
    user = User.objects.create_user(
        username="admin",
        email="admin@test.at",
        password="TestPass123!",
        first_name="Test",
        last_name="Admin",
        role=User.Role.ADMIN,
    )
    return _assign_auth_group(user)


@pytest.fixture
def super_admin_user(db, setup_permissions) -> User:
    """Create and return a test user with Super Admin role."""
    user = User.objects.create_user(
        username="superadmin",
        email="superadmin@test.at",
        password="TestPass123!",
        first_name="Test",
        last_name="SuperAdmin",
        role=User.Role.SUPER_ADMIN,
        is_staff=True,
        is_superuser=True,
    )
    return _assign_auth_group(user)


@pytest.fixture
def authenticated_educator_client(
    api_client: APIClient, educator_user: User
) -> APIClient:
    """Return an APIClient authenticated as an Educator."""
    api_client.force_authenticate(user=educator_user)
    return api_client


@pytest.fixture
def authenticated_admin_client(
    api_client: APIClient, admin_user: User
) -> APIClient:
    """Return an APIClient authenticated as an Admin."""
    api_client.force_authenticate(user=admin_user)
    return api_client
