"""
TEMPORARY debug views to isolate the exact logout error.
MUST be removed after debugging.
"""
import traceback
import logging
import sys

from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

logger = logging.getLogger(__name__)


class DebugMinimalPostView(APIView):
    """
    Absolute minimal POST view with IsAuthenticated.
    If this returns 200, the problem is in the logout code.
    If this returns 500, the problem is in middleware/auth.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        return Response({"detail": "minimal post works", "user": str(request.user)})


class DebugLogoutView(APIView):
    """
    Temporary debug endpoint that returns the exact error traceback.
    REMOVE AFTER DEBUGGING.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        errors = []
        refresh_token = None

        try:
            from core.cookie_utils import REFRESH_TOKEN_COOKIE, clear_auth_cookies
            errors.append("Step 0: Imports OK")
        except Exception as e:
            errors.append(f"Step 0 FAILED: {type(e).__name__}: {e}")
            return Response({"debug_steps": errors}, status=200)

        try:
            refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)
            errors.append(f"Step 1: Got refresh from cookie: {bool(refresh_token)}")
        except Exception as e:
            errors.append(f"Step 1 FAILED: {type(e).__name__}: {e}")

        if not refresh_token:
            try:
                refresh_token = request.data.get("refresh")
                errors.append(f"Step 2: Got refresh from body: {bool(refresh_token)}")
            except Exception as e:
                errors.append(f"Step 2 FAILED: {type(e).__name__}: {e}")

        if refresh_token:
            try:
                from rest_framework_simplejwt.tokens import RefreshToken
                token = RefreshToken(refresh_token)
                errors.append(f"Step 3: RefreshToken created, jti={token.payload.get('jti', '?')}")
            except Exception as e:
                errors.append(f"Step 3 FAILED: {type(e).__name__}: {e}\n{traceback.format_exc()}")
                token = None

            if token:
                try:
                    result = token.blacklist()
                    errors.append(f"Step 4: blacklist() succeeded: {result}")
                except Exception as e:
                    errors.append(f"Step 4 FAILED: {type(e).__name__}: {e}\n{traceback.format_exc()}")

        try:
            response = Response(
                {"detail": "Debug logout completed.", "debug_steps": errors},
                status=status.HTTP_200_OK,
            )
            clear_auth_cookies(response)
            errors.append("Step 5: Response created and cookies cleared")
        except Exception as e:
            errors.append(f"Step 5 FAILED: {type(e).__name__}: {e}")
            response = Response({"debug_steps": errors}, status=200)

        return response
