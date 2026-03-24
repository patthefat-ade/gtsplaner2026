"""
Tests for authentication endpoints.

Covers login, logout, token refresh, password reset, password change,
and the /me/ profile endpoint.
"""

import pytest
from django.contrib.auth.tokens import default_token_generator
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework import status
from rest_framework.test import APIClient
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import User


@pytest.mark.django_db
class TestLoginEndpoint:
    """Tests for POST /api/v1/auth/login/."""

    URL = "/api/v1/auth/login/"

    def test_login_with_username(self, api_client: APIClient, educator_user: User) -> None:
        """Test successful login with username."""
        response = api_client.post(
            self.URL,
            {"username": "educator", "password": "TestPass123!"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data
        assert "refresh" in response.data
        assert response.data["user"]["role"] == "educator"

    def test_login_with_email(self, api_client: APIClient, educator_user: User) -> None:
        """Test successful login with email address."""
        response = api_client.post(
            self.URL,
            {"username": "educator@test.at", "password": "TestPass123!"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["user"]["email"] == "educator@test.at"

    def test_login_invalid_password(self, api_client: APIClient, educator_user: User) -> None:
        """Test login with wrong password returns 400."""
        response = api_client.post(
            self.URL,
            {"username": "educator", "password": "WrongPassword"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_nonexistent_user(self, api_client: APIClient) -> None:
        """Test login with non-existent user returns 400."""
        response = api_client.post(
            self.URL,
            {"username": "nobody", "password": "TestPass123!"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_inactive_user(self, api_client: APIClient, educator_user: User) -> None:
        """Test login with inactive user returns 400."""
        educator_user.is_active = False
        educator_user.save()
        response = api_client.post(
            self.URL,
            {"username": "educator", "password": "TestPass123!"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_deleted_user(self, api_client: APIClient, educator_user: User) -> None:
        """Test login with soft-deleted user returns 400."""
        educator_user.is_deleted = True
        educator_user.save()
        response = api_client.post(
            self.URL,
            {"username": "educator", "password": "TestPass123!"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_login_returns_user_data(self, api_client: APIClient, educator_user: User) -> None:
        """Test that login response contains correct user data."""
        response = api_client.post(
            self.URL,
            {"username": "educator", "password": "TestPass123!"},
        )
        user_data = response.data["user"]
        assert user_data["id"] == educator_user.id
        assert user_data["username"] == "educator"
        assert user_data["first_name"] == "Test"
        assert user_data["last_name"] == "Pädagogin"

    def test_login_all_roles(
        self,
        api_client: APIClient,
        educator_user: User,
        location_manager_user: User,
        admin_user: User,
        super_admin_user: User,
    ) -> None:
        """Test that all four roles can login successfully."""
        for username, expected_role in [
            ("educator", "educator"),
            ("manager", "location_manager"),
            ("admin", "admin"),
            ("superadmin", "super_admin"),
        ]:
            response = api_client.post(
                self.URL,
                {"username": username, "password": "TestPass123!"},
            )
            assert response.status_code == status.HTTP_200_OK, f"Login failed for {username}"
            assert response.data["user"]["role"] == expected_role


@pytest.mark.django_db
class TestLogoutEndpoint:
    """Tests for POST /api/v1/auth/logout/."""

    URL = "/api/v1/auth/logout/"

    def test_logout_success(
        self, authenticated_educator_client: APIClient, educator_user: User
    ) -> None:
        """Test successful logout with valid refresh token."""
        refresh = RefreshToken.for_user(educator_user)
        response = authenticated_educator_client.post(
            self.URL,
            {"refresh": str(refresh)},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_logout_invalid_token(
        self, authenticated_educator_client: APIClient
    ) -> None:
        """Test logout with invalid token returns 400."""
        response = authenticated_educator_client.post(
            self.URL,
            {"refresh": "invalid-token"},
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_logout_unauthenticated(self, api_client: APIClient) -> None:
        """Test that unauthenticated users cannot logout."""
        response = api_client.post(
            self.URL,
            {"refresh": "some-token"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTokenRefreshEndpoint:
    """Tests for POST /api/v1/auth/refresh/."""

    URL = "/api/v1/auth/refresh/"

    def test_refresh_success(self, api_client: APIClient, educator_user: User) -> None:
        """Test successful token refresh."""
        refresh = RefreshToken.for_user(educator_user)
        response = api_client.post(
            self.URL,
            {"refresh": str(refresh)},
        )
        assert response.status_code == status.HTTP_200_OK
        assert "access" in response.data

    def test_refresh_invalid_token(self, api_client: APIClient) -> None:
        """Test refresh with invalid token returns 401."""
        response = api_client.post(
            self.URL,
            {"refresh": "invalid-token"},
        )
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestMeEndpoint:
    """Tests for GET/PATCH /api/v1/auth/me/."""

    URL = "/api/v1/auth/me/"

    def test_get_profile(
        self, authenticated_educator_client: APIClient, educator_user: User
    ) -> None:
        """Test getting the authenticated user's profile."""
        response = authenticated_educator_client.get(self.URL)
        assert response.status_code == status.HTTP_200_OK
        assert response.data["username"] == "educator"
        assert response.data["role"] == "educator"
        assert response.data["role_display"] == "Pädagogin"
        assert "full_name" in response.data

    def test_update_profile(
        self, authenticated_educator_client: APIClient
    ) -> None:
        """Test updating the authenticated user's profile."""
        response = authenticated_educator_client.patch(
            self.URL,
            {"first_name": "Neuer", "phone": "+43 123 456"},
        )
        assert response.status_code == status.HTTP_200_OK
        assert response.data["first_name"] == "Neuer"
        assert response.data["phone"] == "+43 123 456"

    def test_cannot_change_role(
        self, authenticated_educator_client: APIClient
    ) -> None:
        """Test that users cannot change their own role."""
        response = authenticated_educator_client.patch(
            self.URL,
            {"role": "admin"},
        )
        # Role should remain unchanged
        assert response.status_code == status.HTTP_200_OK
        assert response.data["role"] == "educator"

    def test_unauthenticated_access(self, api_client: APIClient) -> None:
        """Test that unauthenticated users cannot access /me/."""
        response = api_client.get(self.URL)
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestPasswordChangeEndpoint:
    """Tests for POST /api/v1/auth/password-change/."""

    URL = "/api/v1/auth/password-change/"

    def test_change_password_success(
        self, authenticated_educator_client: APIClient, educator_user: User
    ) -> None:
        """Test successful password change."""
        response = authenticated_educator_client.post(
            self.URL,
            {
                "old_password": "TestPass123!",
                "new_password": "NewSecurePass456!",
                "new_password_confirm": "NewSecurePass456!",
            },
        )
        assert response.status_code == status.HTTP_200_OK
        educator_user.refresh_from_db()
        assert educator_user.check_password("NewSecurePass456!")
        assert educator_user.last_password_change is not None

    def test_change_password_wrong_old(
        self, authenticated_educator_client: APIClient
    ) -> None:
        """Test password change with wrong old password."""
        response = authenticated_educator_client.post(
            self.URL,
            {
                "old_password": "WrongPassword",
                "new_password": "NewSecurePass456!",
                "new_password_confirm": "NewSecurePass456!",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_change_password_mismatch(
        self, authenticated_educator_client: APIClient
    ) -> None:
        """Test password change with mismatched new passwords."""
        response = authenticated_educator_client.post(
            self.URL,
            {
                "old_password": "TestPass123!",
                "new_password": "NewSecurePass456!",
                "new_password_confirm": "DifferentPass789!",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestPasswordResetEndpoint:
    """Tests for password reset flow."""

    REQUEST_URL = "/api/v1/auth/password-reset/"
    CONFIRM_URL = "/api/v1/auth/password-reset/confirm/"

    def test_request_reset_existing_email(
        self, api_client: APIClient, educator_user: User
    ) -> None:
        """Test password reset request with existing email."""
        response = api_client.post(
            self.REQUEST_URL,
            {"email": "educator@test.at"},
        )
        assert response.status_code == status.HTTP_200_OK

    def test_request_reset_nonexistent_email(self, api_client: APIClient) -> None:
        """Test password reset request with non-existent email (no error for security)."""
        response = api_client.post(
            self.REQUEST_URL,
            {"email": "nobody@test.at"},
        )
        # Should still return 200 to prevent email enumeration
        assert response.status_code == status.HTTP_200_OK

    def test_confirm_reset_success(
        self, api_client: APIClient, educator_user: User
    ) -> None:
        """Test successful password reset confirmation."""
        uid = urlsafe_base64_encode(force_bytes(educator_user.pk))
        token = default_token_generator.make_token(educator_user)

        response = api_client.post(
            self.CONFIRM_URL,
            {
                "uid": uid,
                "token": token,
                "new_password": "ResetPass789!",
                "new_password_confirm": "ResetPass789!",
            },
        )
        assert response.status_code == status.HTTP_200_OK
        educator_user.refresh_from_db()
        assert educator_user.check_password("ResetPass789!")

    def test_confirm_reset_invalid_token(
        self, api_client: APIClient, educator_user: User
    ) -> None:
        """Test password reset with invalid token."""
        uid = urlsafe_base64_encode(force_bytes(educator_user.pk))
        response = api_client.post(
            self.CONFIRM_URL,
            {
                "uid": uid,
                "token": "invalid-token",
                "new_password": "ResetPass789!",
                "new_password_confirm": "ResetPass789!",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_confirm_reset_password_mismatch(
        self, api_client: APIClient, educator_user: User
    ) -> None:
        """Test password reset with mismatched passwords."""
        uid = urlsafe_base64_encode(force_bytes(educator_user.pk))
        token = default_token_generator.make_token(educator_user)
        response = api_client.post(
            self.CONFIRM_URL,
            {
                "uid": uid,
                "token": token,
                "new_password": "ResetPass789!",
                "new_password_confirm": "DifferentPass!",
            },
        )
        assert response.status_code == status.HTTP_400_BAD_REQUEST
