"""
Security utilities for the GTS Planner application.

Provides:
- Account lockout after repeated failed login attempts (OWASP A04)
- Security event logging for failed authentications (OWASP A09)
- Brute-force detection and alerting

Account lockout uses Django's cache framework (Redis in production,
in-memory in development) so no database migration is required.
"""

import logging
from datetime import timedelta

from django.core.cache import cache
from django.utils import timezone

logger = logging.getLogger("kassenbuch.security")

# ── Configuration ─────────────────────────────────────────────────────────────
MAX_FAILED_ATTEMPTS = 10  # Lock after 10 failed attempts
LOCKOUT_DURATION = 30 * 60  # 30 minutes in seconds
FAILED_ATTEMPTS_WINDOW = 15 * 60  # Track attempts within 15 minutes
BRUTE_FORCE_THRESHOLD = 5  # Alert after 5 failed attempts in 5 minutes
BRUTE_FORCE_WINDOW = 5 * 60  # 5 minutes in seconds


def _cache_key_attempts(identifier: str) -> str:
    """Build cache key for failed login attempts counter."""
    return f"security:login_attempts:{identifier}"


def _cache_key_lockout(identifier: str) -> str:
    """Build cache key for account lockout."""
    return f"security:lockout:{identifier}"


def _cache_key_recent(identifier: str) -> str:
    """Build cache key for recent failed attempts (brute-force detection)."""
    return f"security:recent_attempts:{identifier}"


def is_account_locked(identifier: str) -> bool:
    """
    Check if an account or IP is currently locked out.

    Args:
        identifier: Username, email, or IP address to check.

    Returns:
        True if the account is locked, False otherwise.
    """
    return cache.get(_cache_key_lockout(identifier)) is not None


def get_remaining_lockout_seconds(identifier: str) -> int:
    """
    Get the remaining lockout time in seconds.

    Returns 0 if not locked.
    """
    lockout_until = cache.get(_cache_key_lockout(identifier))
    if lockout_until is None:
        return 0
    remaining = (lockout_until - timezone.now()).total_seconds()
    return max(0, int(remaining))


def record_failed_login(
    identifier: str,
    ip_address: str = "",
    user_agent: str = "",
) -> bool:
    """
    Record a failed login attempt and check if lockout should be triggered.

    Args:
        identifier: Username or email that was used.
        ip_address: Client IP address.
        user_agent: Client User-Agent string.

    Returns:
        True if the account is now locked, False otherwise.
    """
    # Increment failed attempts counter
    attempts_key = _cache_key_attempts(identifier)
    attempts = cache.get(attempts_key, 0) + 1
    cache.set(attempts_key, attempts, FAILED_ATTEMPTS_WINDOW)

    # Also track by IP to prevent distributed attacks
    ip_attempts_key = _cache_key_attempts(f"ip:{ip_address}")
    ip_attempts = cache.get(ip_attempts_key, 0) + 1
    cache.set(ip_attempts_key, ip_attempts, FAILED_ATTEMPTS_WINDOW)

    # Log the failed attempt
    logger.warning(
        "Failed login attempt | user=%s | ip=%s | attempts=%d | ua=%s",
        identifier,
        ip_address,
        attempts,
        user_agent[:200] if user_agent else "",
    )

    # Check for brute-force pattern (rapid attempts)
    recent_key = _cache_key_recent(identifier)
    recent = cache.get(recent_key, 0) + 1
    cache.set(recent_key, recent, BRUTE_FORCE_WINDOW)

    if recent >= BRUTE_FORCE_THRESHOLD:
        logger.warning(
            "BRUTE FORCE DETECTED | user=%s | ip=%s | %d attempts in %d seconds",
            identifier,
            ip_address,
            recent,
            BRUTE_FORCE_WINDOW,
        )

    # Lock account if threshold exceeded
    if attempts >= MAX_FAILED_ATTEMPTS:
        lockout_until = timezone.now() + timedelta(seconds=LOCKOUT_DURATION)
        cache.set(
            _cache_key_lockout(identifier),
            lockout_until,
            LOCKOUT_DURATION,
        )
        logger.warning(
            "ACCOUNT LOCKED | user=%s | ip=%s | locked for %d minutes",
            identifier,
            ip_address,
            LOCKOUT_DURATION // 60,
        )
        return True

    # Also lock by IP if too many attempts from same IP
    if ip_attempts >= MAX_FAILED_ATTEMPTS * 2:
        lockout_until = timezone.now() + timedelta(seconds=LOCKOUT_DURATION)
        cache.set(
            _cache_key_lockout(f"ip:{ip_address}"),
            lockout_until,
            LOCKOUT_DURATION,
        )
        logger.warning(
            "IP LOCKED | ip=%s | locked for %d minutes after %d attempts",
            ip_address,
            LOCKOUT_DURATION // 60,
            ip_attempts,
        )
        return True

    return False


def record_successful_login(identifier: str, ip_address: str = "") -> None:
    """
    Clear failed login attempts after a successful login.

    Args:
        identifier: Username or email that was used.
        ip_address: Client IP address.
    """
    cache.delete(_cache_key_attempts(identifier))
    cache.delete(_cache_key_recent(identifier))
    # Note: We don't clear the IP counter here because other accounts
    # from the same IP might still be under attack.

    logger.info(
        "Successful login | user=%s | ip=%s",
        identifier,
        ip_address,
    )


def record_failed_2fa(
    user_id: int,
    ip_address: str = "",
) -> bool:
    """
    Record a failed 2FA verification attempt.

    Args:
        user_id: The user's ID.
        ip_address: Client IP address.

    Returns:
        True if the 2FA is now locked, False otherwise.
    """
    identifier = f"2fa:{user_id}"
    attempts_key = _cache_key_attempts(identifier)
    attempts = cache.get(attempts_key, 0) + 1
    cache.set(attempts_key, attempts, FAILED_ATTEMPTS_WINDOW)

    logger.warning(
        "Failed 2FA attempt | user_id=%d | ip=%s | attempts=%d",
        user_id,
        ip_address,
        attempts,
    )

    # Lock 2FA after 5 failed attempts (stricter than login)
    if attempts >= 5:
        lockout_until = timezone.now() + timedelta(seconds=LOCKOUT_DURATION)
        cache.set(
            _cache_key_lockout(identifier),
            lockout_until,
            LOCKOUT_DURATION,
        )
        logger.warning(
            "2FA LOCKED | user_id=%d | ip=%s | locked for %d minutes",
            user_id,
            ip_address,
            LOCKOUT_DURATION // 60,
        )
        return True

    return False


def clear_2fa_attempts(user_id: int) -> None:
    """Clear failed 2FA attempts after successful verification."""
    identifier = f"2fa:{user_id}"
    cache.delete(_cache_key_attempts(identifier))
