"""
Custom JWT Authentication backends.

Includes:
- CookieJWTAuthentication: Reads JWT from httpOnly cookies (primary)
- QueryParameterJWTAuthentication: Reads JWT from query params (file downloads)

The authentication order is:
1. Standard Authorization header (Bearer token) – for API clients
2. httpOnly cookie (access_token) – for browser sessions
3. Query parameter (?token=...) – for file downloads via window.open()
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken

from core.cookie_utils import ACCESS_TOKEN_COOKIE


class CookieJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that reads the access token from an httpOnly cookie.

    Falls back to the standard Authorization header if no cookie is present,
    ensuring backward compatibility with API clients and mobile apps.
    """

    def authenticate(self, request):
        # First try standard header-based authentication (Authorization: Bearer ...)
        header_result = super().authenticate(request)
        if header_result is not None:
            return header_result

        # Fall back to httpOnly cookie
        raw_token = request.COOKIES.get(ACCESS_TOKEN_COOKIE)
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            return None


class QueryParameterJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that also accepts the token via query parameter.

    This is needed for file downloads (PDF, XLSX) where the browser
    opens a new window/tab and cannot send Authorization headers or cookies.

    Usage:
        GET /api/v1/weeklyplans/123/pdf/?token=<jwt_access_token>
    """

    def authenticate(self, request):
        # First try standard header-based authentication
        header_result = super().authenticate(request)
        if header_result is not None:
            return header_result

        # Then try cookie-based authentication
        cookie_token = request.COOKIES.get(ACCESS_TOKEN_COOKIE)
        if cookie_token:
            try:
                validated_token = self.get_validated_token(cookie_token)
                return self.get_user(validated_token), validated_token
            except (InvalidToken, TokenError):
                pass

        # Fall back to query parameter
        raw_token = request.query_params.get("token")
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            return None
