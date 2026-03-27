"""
Authentication URL patterns.

All endpoints are prefixed with /api/v1/auth/ via config/urls.py.
"""

from django.urls import path

from core.views import (
    AcceptTermsView,
    CustomTokenRefreshView,
    LoginView,
    LogoutView,
    MeView,
    PasswordChangeView,
    PasswordResetConfirmView,
    PasswordResetRequestView,
    SeedDiagnosticView,
)
from core.views_2fa import (
    TwoFactorDisableView,
    TwoFactorLoginVerifyView,
    TwoFactorSetupView,
    TwoFactorStatusView,
    TwoFactorVerifyView,
)

app_name = "auth"

urlpatterns = [
    path("login/", LoginView.as_view(), name="login"),
    path("logout/", LogoutView.as_view(), name="logout"),
    path("refresh/", CustomTokenRefreshView.as_view(), name="token-refresh"),
    path("me/", MeView.as_view(), name="me"),
    path("password-reset/", PasswordResetRequestView.as_view(), name="password-reset"),
    path(
        "password-reset/confirm/",
        PasswordResetConfirmView.as_view(),
        name="password-reset-confirm",
    ),
    path("password-change/", PasswordChangeView.as_view(), name="password-change"),
    path("accept-terms/", AcceptTermsView.as_view(), name="accept-terms"),
    # Two-Factor Authentication (2FA)
    path("2fa/setup/", TwoFactorSetupView.as_view(), name="2fa-setup"),
    path("2fa/verify/", TwoFactorVerifyView.as_view(), name="2fa-verify"),
    path("2fa/disable/", TwoFactorDisableView.as_view(), name="2fa-disable"),
    path(
        "2fa/login-verify/",
        TwoFactorLoginVerifyView.as_view(),
        name="2fa-login-verify",
    ),
    path("2fa/status/", TwoFactorStatusView.as_view(), name="2fa-status"),
    # Temporary diagnostic endpoint – REMOVE AFTER DEBUGGING
    path("seed-diagnostic/", SeedDiagnosticView.as_view(), name="seed-diagnostic"),
]
