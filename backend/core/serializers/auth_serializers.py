"""
Serializers for authentication endpoints.

Handles login, logout, token refresh, password reset, and password change.
"""

from django.contrib.auth import authenticate
from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken

from core.models import User


class LoginSerializer(serializers.Serializer):
    """Serializer for user login via email/username and password."""

    username = serializers.CharField(
        help_text="Benutzername oder E-Mail-Adresse",
    )
    password = serializers.CharField(
        write_only=True,
        help_text="Passwort",
    )

    def validate(self, attrs: dict) -> dict:
        username = attrs.get("username", "")
        password = attrs.get("password", "")

        # Allow login with email or username
        user = None
        if "@" in username:
            try:
                user_obj = User.objects.get(email=username)
                user = authenticate(
                    request=self.context.get("request"),
                    username=user_obj.username,
                    password=password,
                )
            except User.DoesNotExist:
                pass
        else:
            user = authenticate(
                request=self.context.get("request"),
                username=username,
                password=password,
            )

        if user is None:
            raise serializers.ValidationError(
                "Ungültige Anmeldedaten. Bitte überprüfen Sie Benutzername und Passwort."
            )

        if not user.is_active:
            raise serializers.ValidationError(
                "Dieses Konto ist deaktiviert. Bitte kontaktieren Sie den Administrator."
            )

        if user.is_deleted:
            raise serializers.ValidationError(
                "Dieses Konto wurde gelöscht."
            )

        attrs["user"] = user
        return attrs

    def create(self, validated_data: dict) -> dict:
        user = validated_data["user"]

        # If 2FA is enabled, return partial response requiring TOTP verification
        if user.is_2fa_enabled and user.totp_secret:
            return {
                "requires_2fa": True,
                "user_id": user.id,
            }

        # Standard login without 2FA
        refresh = RefreshToken.for_user(user)

        # Update last login
        user.last_login = timezone.now()
        user.save(update_fields=["last_login"])

        return {
            "requires_2fa": False,
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
        }


class LogoutSerializer(serializers.Serializer):
    """Serializer for user logout – blacklists the refresh token."""

    refresh = serializers.CharField(
        help_text="Refresh Token zum Blacklisten",
    )

    def validate_refresh(self, value: str) -> str:
        try:
            RefreshToken(value)
        except Exception:
            raise serializers.ValidationError("Ungültiger Refresh Token.")
        return value

    def save(self, **kwargs) -> None:
        try:
            token = RefreshToken(self.validated_data["refresh"])
            token.blacklist()
        except Exception:
            raise serializers.ValidationError(
                {"refresh": "Token konnte nicht blacklisted werden."}
            )


class PasswordResetRequestSerializer(serializers.Serializer):
    """Serializer for requesting a password reset email."""

    email = serializers.EmailField(
        help_text="E-Mail-Adresse des Benutzerkontos",
    )

    def validate_email(self, value: str) -> str:
        # Always return success to prevent email enumeration
        return value.lower()

    def save(self, **kwargs) -> dict:
        email = self.validated_data["email"]
        try:
            user = User.objects.get(email=email, is_active=True, is_deleted=False)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            token = default_token_generator.make_token(user)
            # In production, send email via Celery task
            return {"uid": uid, "token": token, "user": user}
        except User.DoesNotExist:
            # Return empty dict – no error to prevent email enumeration
            return {}


class PasswordResetConfirmSerializer(serializers.Serializer):
    """Serializer for confirming a password reset with a new password."""

    uid = serializers.CharField(help_text="Base64-encoded User ID")
    token = serializers.CharField(help_text="Password reset token")
    new_password = serializers.CharField(
        min_length=8,
        write_only=True,
        help_text="Neues Passwort (mindestens 8 Zeichen)",
    )
    new_password_confirm = serializers.CharField(
        min_length=8,
        write_only=True,
        help_text="Neues Passwort bestätigen",
    )

    def validate(self, attrs: dict) -> dict:
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Die Passwörter stimmen nicht überein."}
            )

        try:
            uid = urlsafe_base64_decode(attrs["uid"]).decode()
            user = User.objects.get(pk=uid)
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            raise serializers.ValidationError(
                {"uid": "Ungültiger Benutzer."}
            )

        if not default_token_generator.check_token(user, attrs["token"]):
            raise serializers.ValidationError(
                {"token": "Ungültiger oder abgelaufener Token."}
            )

        attrs["user"] = user
        return attrs

    def save(self, **kwargs) -> User:
        user = self.validated_data["user"]
        user.set_password(self.validated_data["new_password"])
        user.last_password_change = timezone.now()
        user.save(update_fields=["password", "last_password_change"])
        return user


class PasswordChangeSerializer(serializers.Serializer):
    """Serializer for changing the password of the authenticated user."""

    old_password = serializers.CharField(
        write_only=True,
        help_text="Aktuelles Passwort",
    )
    new_password = serializers.CharField(
        min_length=8,
        write_only=True,
        help_text="Neues Passwort (mindestens 8 Zeichen)",
    )
    new_password_confirm = serializers.CharField(
        min_length=8,
        write_only=True,
        help_text="Neues Passwort bestätigen",
    )

    def validate_old_password(self, value: str) -> str:
        user = self.context["request"].user
        if not user.check_password(value):
            raise serializers.ValidationError("Das aktuelle Passwort ist falsch.")
        return value

    def validate(self, attrs: dict) -> dict:
        if attrs["new_password"] != attrs["new_password_confirm"]:
            raise serializers.ValidationError(
                {"new_password_confirm": "Die Passwörter stimmen nicht überein."}
            )
        return attrs

    def save(self, **kwargs) -> User:
        user = self.context["request"].user
        user.set_password(self.validated_data["new_password"])
        user.last_password_change = timezone.now()
        user.save(update_fields=["password", "last_password_change"])
        return user
