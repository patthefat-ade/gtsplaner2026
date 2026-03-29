"""
Custom JWT Authentication backends.

Includes:
- CookieJWTAuthentication: Reads JWT from httpOnly cookies (primary)
  Falls back to the standard Authorization header (Bearer token) for API clients.

Security note (OWASP A04):
  Query parameter authentication (?token=...) has been removed because tokens
  in URLs are logged in browser history, server logs, and referrer headers.
  All downloads now use fetch() with credentials: "include" to send httpOnly
  cookies, eliminating the need for tokens in URLs.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError

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
