"""
Audit Logging Middleware.

Provides two middleware classes:

1. ``CurrentUserMiddleware`` – stores ``request.user`` in thread-local
   storage so that Django signal handlers can attribute changes to the
   correct user.

2. ``AuditLoggingMiddleware`` – logs all state-changing API requests
   (POST, PUT, PATCH, DELETE) to the ``AuditLog`` model for compliance
   and traceability.  Sets a thread-local flag so that the signal-based
   logger in ``system.signals`` can skip the same event and avoid
   duplicate entries.
"""

import json
import logging
import threading

from django.utils.deprecation import MiddlewareMixin

from system.thread_local import clear_current_user, set_current_user

logger = logging.getLogger("kassenbuch.audit")

# Thread-local flag used to prevent duplicate audit entries.
# When the middleware creates an audit log for an API request the flag
# is set to ``True`` so that the ``post_save`` / ``post_delete`` signal
# handler can skip its own log entry for the same request cycle.
_audit_context = threading.local()


def is_audit_logged_by_middleware():
    """Return ``True`` if the middleware already logged this request."""
    return getattr(_audit_context, "logged", False)


def set_audit_logged_by_middleware(value: bool):
    """Set the middleware-logged flag for the current thread."""
    _audit_context.logged = value


# ───────────────────────────────────────────────────────────────────
# CurrentUserMiddleware
# ───────────────────────────────────────────────────────────────────

class CurrentUserMiddleware(MiddlewareMixin):
    """
    Store the authenticated ``request.user`` in thread-local storage.

    Must be placed **after** ``AuthenticationMiddleware`` in
    ``settings.MIDDLEWARE`` so that ``request.user`` is already resolved.
    """

    def process_request(self, request):
        if hasattr(request, "user") and request.user.is_authenticated:
            set_current_user(request.user)
        else:
            set_current_user(None)

    def process_response(self, request, response):
        clear_current_user()
        return response


# ───────────────────────────────────────────────────────────────────
# AuditLoggingMiddleware
# ───────────────────────────────────────────────────────────────────

class AuditLoggingMiddleware(MiddlewareMixin):
    """
    Middleware that logs all state-changing API requests to the AuditLog.

    Captures:
    - User performing the action
    - HTTP method and path
    - Model/resource affected (derived from URL path)
    - Action type (create, update, delete)
    - Request data (sanitized – no passwords)
    - Response status code
    """

    # Methods that change state
    AUDITABLE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

    # URL prefixes to audit
    AUDIT_PREFIXES = ("/api/v1/",)

    # URL paths to exclude from auditing
    EXCLUDE_PATHS = (
        "/api/v1/auth/login/",
        "/api/v1/auth/refresh/",
        "/api/health/",
        "/api/schema/",
    )

    # Sensitive fields to redact
    SENSITIVE_FIELDS = {
        "password",
        "new_password",
        "old_password",
        "new_password_confirm",
        "token",
        "refresh",
    }

    def process_request(self, request):
        """Reset the deduplication flag at the start of each request."""
        set_audit_logged_by_middleware(False)

    def process_response(self, request, response):
        """Log state-changing API requests after response is generated."""
        # Only audit state-changing methods
        if request.method not in self.AUDITABLE_METHODS:
            return response

        # Only audit API paths
        path = request.path
        if not any(path.startswith(prefix) for prefix in self.AUDIT_PREFIXES):
            return response

        # Exclude certain paths
        if any(path.startswith(excluded) for excluded in self.EXCLUDE_PATHS):
            return response

        # Only audit authenticated requests
        if not hasattr(request, "user") or not request.user.is_authenticated:
            return response

        # Only audit successful state changes (2xx responses)
        if response.status_code < 200 or response.status_code >= 300:
            return response

        try:
            self._create_audit_log(request, response)
            # Set the flag so signal handlers skip their own entry
            set_audit_logged_by_middleware(True)
        except Exception as e:
            logger.error(f"Failed to create audit log: {e}")

        return response

    # ── helpers ────────────────────────────────────────────────────

    def _create_audit_log(self, request, response):
        """Create an AuditLog entry for the request."""
        from system.models import AuditLog

        action = self._get_action(request.method)
        model_name, object_id = self._parse_resource(request.path)
        request_data = self._get_sanitized_data(request)

        # Build a human-readable display string
        display = self._build_display(request, response, model_name, action)
        if display:
            request_data["display"] = display

        # Resolve organization from user's location or tenant context
        organization = None
        if hasattr(request.user, "location") and request.user.location:
            organization = request.user.location.organization
        elif hasattr(request, "tenant") and request.tenant:
            organization = request.tenant

        AuditLog.objects.create(
            user=request.user,
            action=action,
            model_name=model_name,
            object_id=object_id or "",
            changes=request_data,
            ip_address=self._get_client_ip(request),
            user_agent=request.META.get("HTTP_USER_AGENT", "")[:500],
            organization=organization,
        )

    def _build_display(self, request, response, model_name, action):
        """Try to build a human-readable summary from the response."""
        try:
            if response.get("Content-Type", "").startswith("application/json"):
                data = json.loads(response.content.decode("utf-8"))
                # Try common display fields
                for field in ("__str__", "name", "title", "description", "username"):
                    if field in data:
                        return str(data[field])[:200]
                # Fallback: use id
                if "id" in data:
                    return f"{model_name} #{data['id']}"
        except Exception:
            pass
        return None

    def _get_action(self, method):
        """Map HTTP method to action type."""
        mapping = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
        }
        return mapping.get(method, "other")

    def _parse_resource(self, path):
        """
        Extract model name and object ID from the URL path.

        Examples:
        - /api/v1/finance/transactions/     -> ('Transaction', None)
        - /api/v1/finance/transactions/42/   -> ('Transaction', '42')
        - /api/v1/finance/transactions/42/approve/ -> ('Transaction', '42')
        """
        clean_path = path.replace("/api/v1/", "").strip("/")
        parts = clean_path.split("/")

        model_name = "Unknown"
        object_id = None

        if len(parts) >= 2:
            resource = parts[1]
            model_name = (
                resource.rstrip("s").replace("-", "_").title().replace("_", "")
            )
        elif len(parts) == 1:
            model_name = parts[0].title()

        # Try to find numeric ID in path
        for part in parts[2:]:
            if part.isdigit():
                object_id = part
                break

        return model_name, object_id

    def _get_sanitized_data(self, request):
        """Get request data with sensitive fields redacted."""
        try:
            if hasattr(request, "data") and request.data:
                data = (
                    dict(request.data) if hasattr(request.data, "items") else {}
                )
            elif hasattr(request, "POST") and request.POST:
                data = dict(request.POST)
            else:
                try:
                    if request.content_type and "json" in request.content_type:
                        data = json.loads(request.body.decode("utf-8"))
                    else:
                        data = {}
                except Exception:
                    data = {}
        except Exception:
            data = {}

        return self._redact_sensitive(data)

    def _redact_sensitive(self, data):
        """Recursively redact sensitive fields from data."""
        if isinstance(data, dict):
            return {
                key: (
                    "***REDACTED***"
                    if key.lower() in self.SENSITIVE_FIELDS
                    else self._redact_sensitive(value)
                )
                for key, value in data.items()
            }
        elif isinstance(data, list):
            return [self._redact_sensitive(item) for item in data]
        return data

    def _get_client_ip(self, request):
        """Get the client's IP address from the request."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            return x_forwarded_for.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")
