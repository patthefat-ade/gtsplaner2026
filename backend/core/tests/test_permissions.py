"""
Tests for RBAC permission classes.

Verifies that each permission class correctly grants or denies access
based on the user's role.
"""

import pytest
from django.test import RequestFactory
from rest_framework.test import APIRequestFactory

from core.models import User
from core.permissions import (
    IsAdminOrAbove,
    IsEducator,
    IsLocationManagerOrAbove,
    IsOwnerOrAdmin,
    IsSuperAdmin,
)


@pytest.mark.django_db
class TestIsEducatorPermission:
    """Tests for IsEducator permission."""

    def test_educator_allowed(self, educator_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = educator_user
        assert IsEducator().has_permission(request, None) is True

    def test_admin_allowed(self, admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = admin_user
        assert IsEducator().has_permission(request, None) is True

    def test_unauthenticated_denied(self) -> None:
        from django.contrib.auth.models import AnonymousUser

        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = AnonymousUser()
        assert IsEducator().has_permission(request, None) is False


@pytest.mark.django_db
class TestIsLocationManagerOrAbovePermission:
    """Tests for IsLocationManagerOrAbove permission."""

    def test_educator_denied(self, educator_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = educator_user
        assert IsLocationManagerOrAbove().has_permission(request, None) is False

    def test_location_manager_allowed(self, location_manager_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = location_manager_user
        assert IsLocationManagerOrAbove().has_permission(request, None) is True

    def test_admin_allowed(self, admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = admin_user
        assert IsLocationManagerOrAbove().has_permission(request, None) is True

    def test_super_admin_allowed(self, super_admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = super_admin_user
        assert IsLocationManagerOrAbove().has_permission(request, None) is True


@pytest.mark.django_db
class TestIsAdminOrAbovePermission:
    """Tests for IsAdminOrAbove permission."""

    def test_educator_denied(self, educator_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = educator_user
        assert IsAdminOrAbove().has_permission(request, None) is False

    def test_location_manager_denied(self, location_manager_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = location_manager_user
        assert IsAdminOrAbove().has_permission(request, None) is False

    def test_admin_allowed(self, admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = admin_user
        assert IsAdminOrAbove().has_permission(request, None) is True

    def test_super_admin_allowed(self, super_admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = super_admin_user
        assert IsAdminOrAbove().has_permission(request, None) is True


@pytest.mark.django_db
class TestIsSuperAdminPermission:
    """Tests for IsSuperAdmin permission."""

    def test_educator_denied(self, educator_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = educator_user
        assert IsSuperAdmin().has_permission(request, None) is False

    def test_admin_denied(self, admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = admin_user
        assert IsSuperAdmin().has_permission(request, None) is False

    def test_super_admin_allowed(self, super_admin_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = super_admin_user
        assert IsSuperAdmin().has_permission(request, None) is True


@pytest.mark.django_db
class TestIsOwnerOrAdminPermission:
    """Tests for IsOwnerOrAdmin object-level permission."""

    def test_owner_allowed(self, educator_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = educator_user
        assert IsOwnerOrAdmin().has_object_permission(request, None, educator_user) is True

    def test_non_owner_denied(self, educator_user: User, location_manager_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = educator_user
        assert IsOwnerOrAdmin().has_object_permission(request, None, location_manager_user) is False

    def test_admin_always_allowed(self, admin_user: User, educator_user: User) -> None:
        factory = APIRequestFactory()
        request = factory.get("/")
        request.user = admin_user
        assert IsOwnerOrAdmin().has_object_permission(request, None, educator_user) is True
