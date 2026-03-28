"""
Views for Two-Factor Authentication (2FA) using TOTP.

Provides endpoints for:
- Setting up 2FA (generate secret + QR code)
- Verifying 2FA setup with a TOTP code
- Verifying 2FA during login
- Disabling 2FA
"""

import base64
import io

import pyotp
import qrcode
from drf_spectacular.utils import OpenApiResponse, extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken


class TwoFactorSetupSerializer(serializers.Serializer):
    """Response serializer for 2FA setup."""

    secret = serializers.CharField(read_only=True, help_text="TOTP Secret Key")
    qr_code = serializers.CharField(
        read_only=True, help_text="Base64-encoded QR Code PNG"
    )
    otpauth_url = serializers.CharField(
        read_only=True, help_text="otpauth:// URL for manual entry"
    )


class TwoFactorVerifySerializer(serializers.Serializer):
    """Serializer for verifying a TOTP code."""

    code = serializers.CharField(
        min_length=6,
        max_length=6,
        help_text="6-stelliger TOTP Code aus der Authenticator App",
    )


class TwoFactorLoginSerializer(serializers.Serializer):
    """Serializer for 2FA login verification."""

    user_id = serializers.IntegerField(help_text="User ID from initial login")
    code = serializers.CharField(
        min_length=6,
        max_length=6,
        help_text="6-stelliger TOTP Code aus der Authenticator App",
    )


class TwoFactorSetupView(APIView):
    """
    POST /api/v1/auth/2fa/setup/

    Generate a new TOTP secret and QR code for the authenticated user.
    The user must verify the code before 2FA is activated.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TwoFactorSetupSerializer

    @extend_schema(
        tags=["Auth – 2FA"],
        summary="2FA einrichten",
        description="Generiert ein TOTP-Secret und QR-Code. Der Benutzer muss den Code verifizieren, um 2FA zu aktivieren.",
        responses={200: TwoFactorSetupSerializer},
    )
    def post(self, request):
        user = request.user

        # Generate a new TOTP secret
        secret = pyotp.random_base32()

        # Store the secret temporarily (not yet enabled)
        user.totp_secret = secret
        user.save(update_fields=["totp_secret"])

        # Generate otpauth URL
        totp = pyotp.TOTP(secret)
        otpauth_url = totp.provisioning_uri(
            name=user.email or user.username,
            issuer_name="GTS Planer",
        )

        # Generate QR code as base64 PNG
        qr = qrcode.QRCode(version=1, box_size=10, border=5)
        qr.add_data(otpauth_url)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white")

        buffer = io.BytesIO()
        img.save(buffer, format="PNG")
        qr_base64 = base64.b64encode(buffer.getvalue()).decode("utf-8")

        return Response(
            {
                "secret": secret,
                "qr_code": f"data:image/png;base64,{qr_base64}",
                "otpauth_url": otpauth_url,
            },
            status=status.HTTP_200_OK,
        )


class TwoFactorVerifyView(APIView):
    """
    POST /api/v1/auth/2fa/verify/

    Verify a TOTP code to activate 2FA for the authenticated user.
    This completes the 2FA setup process.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TwoFactorVerifySerializer

    @extend_schema(
        tags=["Auth – 2FA"],
        summary="2FA verifizieren und aktivieren",
        description="Verifiziert den TOTP-Code und aktiviert 2FA für den Benutzer.",
        request=TwoFactorVerifySerializer,
        responses={
            200: OpenApiResponse(description="2FA erfolgreich aktiviert"),
            400: OpenApiResponse(description="Ungültiger Code"),
        },
    )
    def post(self, request):
        serializer = TwoFactorVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        code = serializer.validated_data["code"]

        if not user.totp_secret:
            return Response(
                {"detail": "Bitte zuerst 2FA einrichten."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response(
                {"detail": "Ungültiger Code. Bitte versuchen Sie es erneut."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Activate 2FA
        user.is_2fa_enabled = True
        user.save(update_fields=["is_2fa_enabled"])

        # Notify about 2FA activation
        try:
            from system.notification_service import notify_2fa_status_changed
            notify_2fa_status_changed(user, enabled=True)
        except Exception:
            pass

        return Response(
            {"detail": "Zwei-Faktor-Authentifizierung erfolgreich aktiviert."},
            status=status.HTTP_200_OK,
        )


class TwoFactorDisableView(APIView):
    """
    POST /api/v1/auth/2fa/disable/

    Disable 2FA for the authenticated user.
    Requires the current TOTP code for security.
    """

    permission_classes = [permissions.IsAuthenticated]
    serializer_class = TwoFactorVerifySerializer

    @extend_schema(
        tags=["Auth – 2FA"],
        summary="2FA deaktivieren",
        description="Deaktiviert 2FA für den Benutzer. Erfordert den aktuellen TOTP-Code.",
        request=TwoFactorVerifySerializer,
        responses={
            200: OpenApiResponse(description="2FA erfolgreich deaktiviert"),
            400: OpenApiResponse(description="Ungültiger Code"),
        },
    )
    def post(self, request):
        serializer = TwoFactorVerifySerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        code = serializer.validated_data["code"]

        if not user.is_2fa_enabled:
            return Response(
                {"detail": "2FA ist nicht aktiviert."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response(
                {"detail": "Ungültiger Code."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Disable 2FA
        user.is_2fa_enabled = False
        user.totp_secret = ""
        user.save(update_fields=["is_2fa_enabled", "totp_secret"])

        # Notify about 2FA deactivation
        try:
            from system.notification_service import notify_2fa_status_changed
            notify_2fa_status_changed(user, enabled=False)
        except Exception:
            pass

        return Response(
            {"detail": "Zwei-Faktor-Authentifizierung deaktiviert."},
            status=status.HTTP_200_OK,
        )


class TwoFactorLoginVerifyView(APIView):
    """
    POST /api/v1/auth/2fa/login-verify/

    Verify a TOTP code during the login process.
    Called after initial login returns requires_2fa=true.
    Returns JWT tokens upon successful verification.
    """

    permission_classes = [permissions.AllowAny]
    serializer_class = TwoFactorLoginSerializer

    @extend_schema(
        tags=["Auth – 2FA"],
        summary="2FA Login-Verifizierung",
        description="Verifiziert den TOTP-Code während des Login-Prozesses und gibt JWT-Tokens zurück.",
        request=TwoFactorLoginSerializer,
        responses={
            200: OpenApiResponse(description="Login erfolgreich mit 2FA"),
            400: OpenApiResponse(description="Ungültiger Code"),
        },
    )
    def post(self, request):
        serializer = TwoFactorLoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        from core.models import User

        user_id = serializer.validated_data["user_id"]
        code = serializer.validated_data["code"]

        try:
            user = User.objects.get(pk=user_id, is_active=True, is_deleted=False)
        except User.DoesNotExist:
            return Response(
                {"detail": "Benutzer nicht gefunden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not user.is_2fa_enabled or not user.totp_secret:
            return Response(
                {"detail": "2FA ist für diesen Benutzer nicht aktiviert."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        totp = pyotp.TOTP(user.totp_secret)
        if not totp.verify(code, valid_window=1):
            return Response(
                {"detail": "Ungültiger Code. Bitte versuchen Sie es erneut."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Generate JWT tokens
        from django.utils import timezone

        refresh = RefreshToken.for_user(user)
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        return Response(
            {
                "access": str(refresh.access_token),
                "refresh": str(refresh),
                "user": {
                    "id": user.id,
                    "username": user.username,
                    "email": user.email,
                    "first_name": user.first_name,
                    "last_name": user.last_name,
                    "role": user.role,
                    "location": user.location_id,
                },
            },
            status=status.HTTP_200_OK,
        )


class TwoFactorStatusView(APIView):
    """
    GET /api/v1/auth/2fa/status/

    Get the 2FA status for the authenticated user.
    """

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(
        tags=["Auth – 2FA"],
        summary="2FA Status abrufen",
        description="Gibt den 2FA-Status des angemeldeten Benutzers zurück.",
        responses={
            200: OpenApiResponse(description="2FA Status"),
        },
    )
    def get(self, request):
        return Response(
            {
                "is_2fa_enabled": request.user.is_2fa_enabled,
                "has_totp_secret": bool(request.user.totp_secret),
            },
            status=status.HTTP_200_OK,
        )
