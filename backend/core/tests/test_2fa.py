"""
Tests for Two-Factor Authentication (2FA) endpoints.
"""

import pyotp
import pytest
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from core.models import User


@pytest.fixture
def user(db):
    """Create a test user."""
    return User.objects.create_user(
        username="testuser",
        email="test@example.com",
        password="testpass123",
        first_name="Test",
        last_name="User",
    )


@pytest.fixture
def auth_client(user):
    """Create an authenticated API client."""
    client = APIClient()
    client.force_authenticate(user=user)
    return client


@pytest.mark.django_db
class TestTwoFactorSetup:
    """Tests for 2FA setup endpoint."""

    def test_setup_returns_secret_and_qr(self, auth_client, user):
        """Test that 2FA setup returns a secret and QR code."""
        url = reverse("auth:2fa-setup")
        response = auth_client.post(url)

        assert response.status_code == status.HTTP_200_OK
        assert "secret" in response.data
        assert "qr_code" in response.data
        assert "otpauth_url" in response.data
        assert response.data["qr_code"].startswith("data:image/png;base64,")
        assert "GTS" in response.data["otpauth_url"]
        assert "Planer" in response.data["otpauth_url"]

        # Verify secret was saved to user
        user.refresh_from_db()
        assert user.totp_secret == response.data["secret"]
        assert not user.is_2fa_enabled  # Not yet enabled

    def test_setup_requires_auth(self):
        """Test that 2FA setup requires authentication."""
        client = APIClient()
        url = reverse("auth:2fa-setup")
        response = client.post(url)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTwoFactorVerify:
    """Tests for 2FA verification endpoint."""

    def test_verify_valid_code_activates_2fa(self, auth_client, user):
        """Test that a valid TOTP code activates 2FA."""
        # Setup first
        setup_url = reverse("auth:2fa-setup")
        setup_response = auth_client.post(setup_url)
        secret = setup_response.data["secret"]

        # Generate valid code
        totp = pyotp.TOTP(secret)
        code = totp.now()

        # Verify
        verify_url = reverse("auth:2fa-verify")
        response = auth_client.post(verify_url, {"code": code})

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert user.is_2fa_enabled

    def test_verify_invalid_code_fails(self, auth_client, user):
        """Test that an invalid TOTP code fails verification."""
        # Setup first
        setup_url = reverse("auth:2fa-setup")
        auth_client.post(setup_url)

        # Try invalid code
        verify_url = reverse("auth:2fa-verify")
        response = auth_client.post(verify_url, {"code": "000000"})

        assert response.status_code == status.HTTP_400_BAD_REQUEST
        user.refresh_from_db()
        assert not user.is_2fa_enabled

    def test_verify_without_setup_fails(self, auth_client):
        """Test that verification without setup fails."""
        verify_url = reverse("auth:2fa-verify")
        response = auth_client.post(verify_url, {"code": "123456"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTwoFactorLogin:
    """Tests for 2FA login flow."""

    def test_login_with_2fa_requires_code(self, user):
        """Test that login with 2FA enabled returns requires_2fa."""
        # Enable 2FA
        secret = pyotp.random_base32()
        user.totp_secret = secret
        user.is_2fa_enabled = True
        user.save()

        client = APIClient()
        login_url = reverse("auth:login")
        response = client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["requires_2fa"] is True
        assert "user_id" in response.data
        assert "access" not in response.data

    def test_login_without_2fa_returns_tokens(self, user):
        """Test that login without 2FA returns tokens directly."""
        client = APIClient()
        login_url = reverse("auth:login")
        response = client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
        )

        assert response.status_code == status.HTTP_200_OK
        assert response.data["requires_2fa"] is False
        assert "access" in response.data
        assert "refresh" in response.data

    def test_2fa_login_verify_with_valid_code(self, user):
        """Test 2FA login verification with a valid code."""
        # Enable 2FA
        secret = pyotp.random_base32()
        user.totp_secret = secret
        user.is_2fa_enabled = True
        user.save()

        # Step 1: Login
        client = APIClient()
        login_url = reverse("auth:login")
        login_response = client.post(
            login_url,
            {"username": "testuser", "password": "testpass123"},
        )
        user_id = login_response.data["user_id"]

        # Step 2: Verify 2FA
        totp = pyotp.TOTP(secret)
        code = totp.now()

        verify_url = reverse("auth:2fa-login-verify")
        response = client.post(
            verify_url,
            {"user_id": user_id, "code": code},
        )

        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
        assert "user" in response.data

    def test_2fa_login_verify_with_invalid_code(self, user):
        """Test 2FA login verification with an invalid code."""
        # Enable 2FA
        secret = pyotp.random_base32()
        user.totp_secret = secret
        user.is_2fa_enabled = True
        user.save()

        client = APIClient()
        verify_url = reverse("auth:2fa-login-verify")
        response = client.post(
            verify_url,
            {"user_id": user.id, "code": "000000"},
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTwoFactorDisable:
    """Tests for 2FA disable endpoint."""

    def test_disable_with_valid_code(self, auth_client, user):
        """Test that 2FA can be disabled with a valid code."""
        # Enable 2FA
        secret = pyotp.random_base32()
        user.totp_secret = secret
        user.is_2fa_enabled = True
        user.save()

        # Disable with valid code
        totp = pyotp.TOTP(secret)
        code = totp.now()

        disable_url = reverse("auth:2fa-disable")
        response = auth_client.post(disable_url, {"code": code})

        assert response.status_code == status.HTTP_200_OK
        user.refresh_from_db()
        assert not user.is_2fa_enabled
        assert user.totp_secret == ""

    def test_disable_without_2fa_fails(self, auth_client):
        """Test that disabling 2FA when not enabled fails."""
        disable_url = reverse("auth:2fa-disable")
        response = auth_client.post(disable_url, {"code": "123456"})
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestTwoFactorStatus:
    """Tests for 2FA status endpoint."""

    def test_status_returns_2fa_info(self, auth_client, user):
        """Test that status returns 2FA information."""
        url = reverse("auth:2fa-status")
        response = auth_client.get(url)

        assert response.status_code == status.HTTP_200_OK
        assert "is_2fa_enabled" in response.data
        assert response.data["is_2fa_enabled"] is False
