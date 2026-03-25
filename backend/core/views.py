"""
Views for authentication and user profile endpoints.

Provides login, logout, token refresh, password reset/change,
and user profile management.
"""

from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.views import TokenRefreshView

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
    Returns JWT access and refresh tokens along with user data.
    Rate limited to 5 attempts per minute to prevent brute-force attacks.
    """

    permission_classes = [permissions.AllowAny]
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "login"
    serializer_class = LoginSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Benutzer anmelden",
        description="Authentifizierung mit Benutzername/E-Mail und Passwort. Gibt JWT-Tokens zurück.",
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
        return Response(data, status=status.HTTP_200_OK)


class LogoutView(APIView):
    """
    POST /api/v1/auth/logout/

    Logout the user by blacklisting the refresh token.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = LogoutSerializer

    @extend_schema(
        tags=["Auth"],
        summary="Benutzer abmelden",
        description="Blacklistet den Refresh Token und meldet den Benutzer ab.",
        request=LogoutSerializer,
        responses={
            200: OpenApiResponse(description="Logout erfolgreich"),
            400: OpenApiResponse(description="Ungültiger Token"),
        },
    )
    def post(self, request):
        serializer = LogoutSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            {"detail": "Erfolgreich abgemeldet."},
            status=status.HTTP_200_OK,
        )


class CustomTokenRefreshView(TokenRefreshView):
    """
    POST /api/v1/auth/refresh/

    Refresh the JWT access token using a valid refresh token.
    """

    @extend_schema(
        tags=["Auth"],
        summary="Token erneuern",
        description="Erneuert den Access Token mit einem gültigen Refresh Token.",
    )
    def post(self, request, *args, **kwargs):
        return super().post(request, *args, **kwargs)


class MeView(APIView):
    """
    GET /api/v1/auth/me/
    PATCH /api/v1/auth/me/

    Get or update the authenticated user's profile.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Auth"],
        summary="Eigenes Profil abrufen",
        description="Gibt die Profildaten des angemeldeten Benutzers zurück.",
        responses={200: UserProfileSerializer},
    )
    def get(self, request):
        serializer = UserProfileSerializer(request.user)
        return Response(serializer.data)

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
            send_password_reset_email.delay(user.pk, reset_link)

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
        return Response(
            {"detail": "Passwort wurde erfolgreich geändert."},
            status=status.HTTP_200_OK,
        )
