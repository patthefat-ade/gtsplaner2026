"""
Thread-local storage for the current request user.

Provides a lightweight mechanism to make the authenticated user available
in Django signal handlers and other contexts where the HTTP request is
not directly accessible (e.g. management commands, Celery tasks).

Usage in signals:
    from system.thread_local import get_current_user
    user = get_current_user()  # Returns User instance or None

The user is automatically set/cleared by ``CurrentUserMiddleware``
which must be placed **after** ``AuthenticationMiddleware`` in
``settings.MIDDLEWARE``.
"""

import threading

_thread_locals = threading.local()


def set_current_user(user):
    """Store the authenticated user for the current thread."""
    _thread_locals.user = user


def get_current_user():
    """Return the authenticated user for the current thread, or ``None``."""
    return getattr(_thread_locals, "user", None)


def clear_current_user():
    """Remove the stored user reference (call at end of request)."""
    _thread_locals.user = None
