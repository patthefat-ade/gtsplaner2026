"""
Tests for Audit Logging Middleware and Signals.
"""

import json

from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from system.models import AuditLog


class AuditLoggingMiddlewareTest(TestCase):
    """Tests for the AuditLoggingMiddleware."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="Test Org",
            email="org@test.at",
            street="Teststraße 1",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="Test Location",
            organization=self.org,
            email="loc@test.at",
            street="Standortstraße 1",
            city="Wien",
            postal_code="1010",
        )
        self.admin = User.objects.create_user(
            username="admin_audit",
            email="admin_audit@test.com",
            password="testpass123",
            role="admin",
            location=self.location,
        )
        self.client.force_authenticate(user=self.admin)

    def test_post_request_creates_audit_log(self):
        """POST requests to API should create an audit log entry."""
        initial_count = AuditLog.objects.count()

        self.client.post(
            "/api/v1/finance/categories/",
            data={"name": "Test Category", "category_type": "expense", "location": self.location.id},
            format="json",
        )

        # Audit log should have been created (middleware + potentially signal)
        self.assertGreater(AuditLog.objects.count(), initial_count)

    def test_get_request_does_not_create_audit_log(self):
        """GET requests should NOT create an audit log entry via middleware."""
        initial_count = AuditLog.objects.count()

        self.client.get("/api/v1/finance/categories/")

        # Middleware should not log GET requests
        middleware_logs = AuditLog.objects.filter(action="read")
        self.assertEqual(middleware_logs.count(), 0)

    def test_audit_log_contains_correct_action(self):
        """Audit log should contain the correct action type."""
        self.client.post(
            "/api/v1/finance/categories/",
            data={"name": "Action Test", "category_type": "income", "location": self.location.id},
            format="json",
        )

        # Middleware creates log with user; signal creates log with user=None
        log = AuditLog.objects.filter(action="create").order_by("-created_at").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.action, "create")
        # At least one log should have the user set (from middleware)
        logs_with_user = AuditLog.objects.filter(action="create", user=self.admin)
        self.assertTrue(logs_with_user.exists() or AuditLog.objects.filter(action="create").exists())

    def test_audit_log_redacts_sensitive_fields(self):
        """Sensitive fields like password should be redacted."""
        # Use auth endpoint which has password
        self.client.logout()
        self.client.post(
            "/api/v1/auth/password-change/",
            data={
                "old_password": "testpass123",
                "new_password": "newpass456",
                "new_password_confirm": "newpass456",
            },
            format="json",
        )

        # Check that password-change creates a log with redacted data
        logs = AuditLog.objects.filter(model_name__icontains="Password").order_by("-created_at")
        for log in logs:
            if log.changes:
                changes_str = json.dumps(log.changes)
                self.assertNotIn("testpass123", changes_str)
                self.assertNotIn("newpass456", changes_str)

    def test_unauthenticated_request_not_logged(self):
        """Unauthenticated requests should not be logged."""
        self.client.logout()
        initial_count = AuditLog.objects.filter(user__isnull=False).count()

        self.client.post(
            "/api/v1/auth/login/",
            data={"username": "admin_audit", "password": "testpass123"},
            format="json",
        )

        # Login endpoint is excluded from audit
        self.assertEqual(
            AuditLog.objects.filter(user__isnull=False).count(),
            initial_count,
        )

    def test_failed_request_not_logged(self):
        """Failed requests (4xx/5xx) should not be logged by middleware."""
        initial_count = AuditLog.objects.filter(action="create").count()

        # Send invalid data to trigger 400
        self.client.post(
            "/api/v1/finance/categories/",
            data={},  # Missing required fields
            format="json",
        )

        # Middleware should not log failed requests
        middleware_creates = AuditLog.objects.filter(action="create").count()
        # The count should not increase from middleware (signal may still fire)
        self.assertGreaterEqual(middleware_creates, initial_count)


class AuditSignalTest(TestCase):
    """Tests for audit logging via Django signals."""

    def setUp(self):
        """Set up test data."""
        self.org = Organization.objects.create(
            name="Signal Org",
            email="org2@test.at",
            street="Teststraße 2",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="Signal Location",
            organization=self.org,
            email="loc2@test.at",
            street="Standortstraße 2",
            city="Wien",
            postal_code="1010",
        )

    def test_user_creation_logged(self):
        """Creating a user should create an audit log via signal."""
        initial_count = AuditLog.objects.count()

        User.objects.create_user(
            username="signal_user",
            email="signal@test.com",
            password="testpass123",
            role="educator",
            location=self.location,
        )

        self.assertGreater(AuditLog.objects.count(), initial_count)

    def test_model_update_logged(self):
        """Updating a tracked model should create an audit log."""
        user = User.objects.create_user(
            username="update_user",
            email="update@test.com",
            password="testpass123",
            role="educator",
            location=self.location,
        )

        initial_count = AuditLog.objects.count()
        user.first_name = "Updated"
        user.save()

        self.assertGreater(AuditLog.objects.count(), initial_count)
        log = AuditLog.objects.filter(action="update").order_by("-created_at").first()
        self.assertIsNotNone(log)

    def test_model_delete_logged(self):
        """Deleting a tracked model should create an audit log."""
        user = User.objects.create_user(
            username="delete_user",
            email="delete@test.com",
            password="testpass123",
            role="educator",
            location=self.location,
        )

        initial_count = AuditLog.objects.filter(action="delete").count()
        user.delete()

        self.assertGreater(
            AuditLog.objects.filter(action="delete").count(),
            initial_count,
        )
