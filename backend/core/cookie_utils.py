"""
Utility functions for JWT httpOnly cookie management.

Provides consistent cookie setting and clearing for access and refresh tokens.
Cookies are httpOnly, Secure (in production), and SameSite=Lax to prevent
XSS and CSRF attacks while allowing same-site navigation.
"""

from django.conf import settings
from rest_framework.response import Response


# Cookie names
ACCESS_TOKEN_COOKIE = "access_token"
REFRESH_TOKEN_COOKIE = "refresh_token"


def _get_cookie_defaults() -> dict:
    """Return default cookie attributes based on environment."""
    is_production = not settings.DEBUG
    return {
        "httponly": True,
        "secure": is_production,
        "samesite": "Lax",
        "path": "/",
        # Domain is not set explicitly – the browser will scope it
        # to the exact domain that set the cookie.
    }


def set_auth_cookies(
    response: Response,
    access_token: str,
    refresh_token: str,
) -> Response:
    """
    Set httpOnly cookies for both access and refresh JWT tokens.

    Args:
        response: The DRF Response object to attach cookies to.
        access_token: The JWT access token string.
        refresh_token: The JWT refresh token string.

    Returns:
        The response with cookies attached.
    """
    defaults = _get_cookie_defaults()

    # Access token cookie – shorter max_age matching JWT lifetime
    access_max_age = int(
        settings.SIMPLE_JWT.get("ACCESS_TOKEN_LIFETIME").total_seconds()
    )
    response.set_cookie(
        key=ACCESS_TOKEN_COOKIE,
        value=access_token,
        max_age=access_max_age,
        **defaults,
    )

    # Refresh token cookie – longer max_age matching JWT lifetime
    refresh_max_age = int(
        settings.SIMPLE_JWT.get("REFRESH_TOKEN_LIFETIME").total_seconds()
    )
    response.set_cookie(
        key=REFRESH_TOKEN_COOKIE,
        value=refresh_token,
        max_age=refresh_max_age,
        **defaults,
    )

    return response


def clear_auth_cookies(response: Response) -> Response:
    """
    Clear both access and refresh token cookies.

    Args:
        response: The DRF Response object to clear cookies from.

    Returns:
        The response with cookies cleared.
    """
    defaults = _get_cookie_defaults()
    # Remove httponly from kwargs for delete_cookie (not supported)
    delete_kwargs = {
        k: v for k, v in defaults.items() if k != "httponly"
    }

    response.delete_cookie(ACCESS_TOKEN_COOKIE, **delete_kwargs)
    response.delete_cookie(REFRESH_TOKEN_COOKIE, **delete_kwargs)

    return response
