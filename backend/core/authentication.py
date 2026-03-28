"""
Custom JWT Authentication backends.

Includes a query-parameter based authentication for file downloads,
where the browser opens a new window/tab and cannot send Authorization headers.
"""

from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import AccessToken


class QueryParameterJWTAuthentication(JWTAuthentication):
    """
    JWT Authentication that also accepts the token via query parameter.

    This is needed for file downloads (PDF, XLSX) where the browser
    opens a direct URL via window.open() and cannot send Authorization headers.

    Usage:
        GET /api/v1/weeklyplans/123/pdf/?token=<jwt_access_token>
    """

    def authenticate(self, request):
        # First try standard header-based authentication
        header_result = super().authenticate(request)
        if header_result is not None:
            return header_result

        # Fall back to query parameter
        raw_token = request.query_params.get("token")
        if raw_token is None:
            return None

        try:
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token
        except (InvalidToken, TokenError):
            return None
