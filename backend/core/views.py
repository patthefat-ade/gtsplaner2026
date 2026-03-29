"""
Views for authentication and user profile endpoints.

Provides login, logout, token refresh, password reset/change,
and user profile management.

JWT tokens are stored in httpOnly cookies for browser security.
The Authorization header is still supported for API clients.
"""

from django.conf import settings
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.exceptions import InvalidToken, TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from core.cookie_utils import (
    REFRESH_TOKEN_COOKIE,
    clear_auth_cookies,
    set_auth_cookies,
)
from core.middleware import ensure_tenant_context
from core.serializers import (
    LoginSerializer,
    LogoutSerializer,
    PasswordChangeSerializer,
    PasswordResetConfirmSerializer,
    PasswordResetRequestSerializer,
    UserProfileSerializer,
    UserProfileUpdateSerializer,
)


class LoginView(APIView):
    """
    POST /api/v1/auth/login/

    Authenticate a user with username/email and password.
    Returns user data and sets JWT tokens as httpOnly cookies.
    Rate limited to 5 attempts per minute to prevent brute-force attacks.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
    serializer_class = LoginSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Benutzer anmelden",
        description="Authentifizierung mit Benutzername/E-Mail und Passwort. Setzt JWT-Tokens als httpOnly-Cookies.",
        request=LoginSerializer,
        responses={
            200: OpenApiResponse(description="Login erfolgreich"),
            400: OpenApiResponse(description="Ungültige Anmeldedaten"),
        },
    )
    def post(self, request):
        serializer = LoginSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.save()

        # If 2FA is required, return partial response without tokens
        if data.get("requires_2fa"):
            return Response(data, status=status.HTTP_200_OK)

        # Extract tokens from response data and set as cookies
        access_token = data.pop("access", None)
        refresh_token = data.pop("refresh", None)

        response = Response(data, status=status.HTTP_200_OK)

        if access_token and refresh_token:
            set_auth_cookies(response, access_token, refresh_token)

        return response


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Logout the user by blacklisting the refresh token and clearing cookies.
    Reads the refresh token from the httpOnly cookie or request body.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Benutzer abmelden",
        description="Blacklistet den Refresh Token und löscht die Auth-Cookies.",
        responses={
            200: OpenApiResponse(description="Logout erfolgreich"),
            400: OpenApiResponse(description="Ungültiger Token"),
        },
    )
    def post(self, request):
        # Try to get refresh token from cookie first, then from body
        refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)
        if not refresh_token:
            refresh_token = request.data.get("refresh")

        if refresh_token:
            try:
                token = RefreshToken(refresh_token)
                token.blacklist()
            except Exception:
                pass  # Token may already be blacklisted or invalid

        response = Response(
            {"detail": "Erfolgreich abgemeldet."},
            status=status.HTTP_200_OK,
        )
        clear_auth_cookies(response)
        return response


class CustomTokenRefreshView(APIView):
    """
    POST /api/v1/auth/refresh/

    Refresh the JWT access token using the refresh token from the httpOnly cookie.
    Sets new tokens as httpOnly cookies.
    """

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        tags=["Auth"],
        summary="Token erneuern",
        description="Erneuert den Access Token mit dem Refresh Token aus dem httpOnly-Cookie.",
        responses={
            200: OpenApiResponse(description="Token erfolgreich erneuert"),
            401: OpenApiResponse(description="Ungültiger oder abgelaufener Refresh Token"),
        },
    )
    def post(self, request):
        # Try to get refresh token from cookie first, then from body
        refresh_token = request.COOKIES.get(REFRESH_TOKEN_COOKIE)
        if not refresh_token:
            refresh_token = request.data.get("refresh")

        if not refresh_token:
            return Response(
                {"detail": "Kein Refresh Token vorhanden."},
                status=status.HTTP_401_UNAUTHORIZED,
            )

        try:
            old_token = RefreshToken(refresh_token)

            # Rotate: create new refresh token and blacklist old one
            if settings.SIMPLE_JWT.get("ROTATE_REFRESH_TOKENS", False):
                new_refresh = RefreshToken.for_user(old_token.payload.get("user_id"))
                # Get user from old token to generate proper new token
                from core.models import User
                user_id = old_token.payload.get("user_id")
                user = User.objects.get(pk=user_id)
                new_refresh = RefreshToken.for_user(user)

                if settings.SIMPLE_JWT.get("BLACKLIST_AFTER_ROTATION", False):
                    try:
                        old_token.blacklist()
                    except Exception:
                        pass

                new_access = str(new_refresh.access_token)
                new_refresh_str = str(new_refresh)
            else:
                new_access = str(old_token.access_token)
                new_refresh_str = str(old_token)

            response = Response(
                {"detail": "Token erfolgreich erneuert."},
                status=status.HTTP_200_OK,
            )
            set_auth_cookies(response, new_access, new_refresh_str)
            return response

        except (InvalidToken, TokenError) as e:
            response = Response(
                {"detail": "Ungültiger oder abgelaufener Refresh Token."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
            clear_auth_cookies(response)
            return response


class MeView(APIView):
    """
    GET /api/v1/auth/me/
    PATCH /api/v1/auth/me/

    Get or update the authenticated user's profile.
    Includes permissions, group, and tenant context.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Eigenes Profil abrufen",
        description="Gibt die Profildaten des angemeldeten Benutzers zurück, inklusive Berechtigungen und Tenant-Kontext.",
        responses={200: UserProfileSerializer},
    )
    def get(self, request):
        from core.permissions import get_user_group_name

        # Ensure tenant context is resolved (lazy resolution for JWT auth)
        ensure_tenant_context(request)

        serializer = UserProfileSerializer(request.user)
        data = serializer.data

        # Add permissions and tenant context
        user = request.user
        user_perms = [
            p.split(".")[1] for p in user.get_all_permissions()
            if p.startswith("core.")
        ]
        data["group"] = get_user_group_name(user) or ""
        data["permissions"] = user_perms
        data["organization_id"] = (
            user.location.organization_id
            if hasattr(user, "location") and user.location
            else None
        )
        data["tenant_ids"] = (
            list(request.tenant_ids) if hasattr(request, "tenant_ids") else []
        )
        data["is_cross_tenant"] = (
            request.is_cross_tenant if hasattr(request, "is_cross_tenant") else False
        )

        return Response(data)

    @extend_schema(
        tags=["Auth"],
        summary="Eigenes Profil aktualisieren",
        description="Aktualisiert die Profildaten des angemeldeten Benutzers.",
        request=UserProfileUpdateSerializer,
        responses={200: UserProfileSerializer},
    )
    def patch(self, request):
        serializer = UserProfileUpdateSerializer(
            request.user, data=request.data, partial=True
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(UserProfileSerializer(request.user).data)


class PasswordResetRequestView(APIView):
    """
    POST /api/v1/auth/password-reset/

    Request a password reset email.
    Always returns 200 to prevent email enumeration.
    Rate limited to 3 requests per hour to prevent abuse.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "password_reset"
    serializer_class = PasswordResetRequestSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Passwort-Reset anfordern",
        description="Sendet eine E-Mail mit einem Link zum Zurücksetzen des Passworts.",
        request=PasswordResetRequestSerializer,
        responses={
            200: OpenApiResponse(
                description="E-Mail wurde gesendet (falls Konto existiert)"
            ),
        },
    )
    def post(self, request):
        serializer = PasswordResetRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        result = serializer.save()

        # Send password reset email via Celery
        if result and "token" in result:
            from system.tasks import send_password_reset_email

            uid = result["uid"]
            token = result["token"]
            user = result["user"]
            # Build the frontend reset URL
            frontend_url = getattr(
                settings, "FRONTEND_URL", "http://localhost:3000"
            )
            reset_link = f"{frontend_url}/reset-password?uid={uid}&token={token}"
            try:
                send_password_reset_email.delay(user.pk, reset_link)
            except Exception:
                # Celery/Redis not available – send synchronously as fallback
                import logging

                logger = logging.getLogger(__name__)
                logger.warning(
                    "Celery/Redis unavailable – sending password reset email synchronously"
                )
                try:
                    send_password_reset_email(user.pk, reset_link)
                except Exception as sync_exc:
                    logger.error(
                        f"Synchronous email send also failed: {sync_exc}"
                    )

        return Response(
            {
                "detail": "Falls ein Konto mit dieser E-Mail-Adresse existiert, "
                "wurde eine E-Mail zum Zurücksetzen des Passworts gesendet."
            },
            status=status.HTTP_200_OK,
        )


class PasswordResetConfirmView(APIView):
    """
    POST /api/v1/auth/password-reset/confirm/

    Confirm a password reset with uid, token, and new password.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = PasswordResetConfirmSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Passwort-Reset bestätigen",
        description="Setzt das Passwort mit dem Token aus der E-Mail zurück.",
        request=PasswordResetConfirmSerializer,
        responses={
            200: OpenApiResponse(description="Passwort erfolgreich zurückgesetzt"),
            400: OpenApiResponse(description="Ungültiger Token oder Passwort"),
        },
    )
    def post(self, request):
        serializer = PasswordResetConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Passwort wurde erfolgreich zurückgesetzt."},
            status=status.HTTP_200_OK,
        )


class AcceptTermsView(APIView):
    """
    POST /api/v1/auth/accept-terms/

    Accept privacy policy and terms of service.
    Must be called before the user can access the dashboard.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Datenschutz & Nutzungsbedingungen akzeptieren",
        description="Markiert den Benutzer als einverstanden mit Datenschutz und Nutzungsbedingungen.",
        request=None,
        responses={
            200: OpenApiResponse(description="Bedingungen akzeptiert"),
        },
    )
    def post(self, request):
        from django.utils import timezone as tz

        user = request.user
        user.has_accepted_terms = True
        user.terms_accepted_at = tz.now()
        user.save(update_fields=["has_accepted_terms", "terms_accepted_at"])

        # Notify super admins
        try:
            from system.notification_service import notify_terms_accepted
            notify_terms_accepted(user)
        except Exception:
            pass  # Don't fail the request if notification fails

        return Response(
            {
                "detail": "Datenschutz und Nutzungsbedingungen akzeptiert.",
                "has_accepted_terms": True,
                "terms_accepted_at": user.terms_accepted_at.isoformat(),
            },
            status=status.HTTP_200_OK,
        )


class PasswordChangeView(APIView):
    """
    POST /api/v1/auth/password-change/

    Change the password of the authenticated user.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = PasswordChangeSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Passwort ändern",
        description="Ändert das Passwort des angemeldeten Benutzers.",
        request=PasswordChangeSerializer,
        responses={
            200: OpenApiResponse(description="Passwort erfolgreich geändert"),
            400: OpenApiResponse(description="Ungültiges Passwort"),
        },
    )
    def post(self, request):
        serializer = PasswordChangeSerializer(
            data=request.data, context={"request": request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        # Notify user about password change
        try:
            from system.notification_service import notify_password_changed
            notify_password_changed(request.user)
        except Exception:
            pass  # Don't fail the request if notification fails

        return Response(
            {"detail": "Passwort wurde erfolgreich geändert."},
            status=status.HTTP_200_OK,
        )
