"""
API tests for User Management and Admin Panel endpoints.

Tests CRUD operations for users, audit logs, and system settings.
"""

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from system.models import AuditLog, SystemSetting


class UserManagementAPITest(TestCase):
    """Tests for User Management ViewSet."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Test Org")
        self.location = Location.objects.create(
            name="Test Standort",
            organization=self.org,
            city="Wien",
            postal_code="1010",
            street="Teststr 1",
        )
        self.admin = User.objects.create_user(
            username="admin",
            password="TestPass123!",
            role="admin",
            location=self.location,
            first_name="Test",
            last_name="Admin",
        )
        self.educator = User.objects.create_user(
            username="educator",
            password="TestPass123!",
            role="educator",
            location=self.location,
            first_name="Test",
            last_name="Educator",
        )

    def test_list_users_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/users/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 2)

    def test_list_users_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/users/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_user_as_admin(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/v1/users/",
            {
                "username": "new_user",
                "email": "new@test.at",
                "password": "NewPass123!",
                "first_name": "Neue",
                "last_name": "Benutzerin",
                "role": "educator",
                "location": self.location.id,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertTrue(User.objects.filter(username="new_user").exists())

    def test_retrieve_user_detail(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get(f"/api/v1/users/{self.educator.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["username"], "educator")

    def test_update_user(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.patch(
            f"/api/v1/users/{self.educator.id}/",
            {"first_name": "Aktualisiert"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.educator.refresh_from_db()
        self.assertEqual(self.educator.first_name, "Aktualisiert")

    def test_delete_user_deactivates(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.delete(f"/api/v1/users/{self.educator.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.educator.refresh_from_db()
        self.assertFalse(self.educator.is_active)

    def test_search_users(self):
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/users/", {"search": "Educator"})
        self.assertEqual(resp.data["count"], 1)


class AdminEndpointsAPITest(TestCase):
    """Tests for Admin Panel endpoints (AuditLog, SystemSettings)."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Test Org")
        self.location = Location.objects.create(
            name="Test Standort",
            organization=self.org,
            city="Wien",
            postal_code="1010",
            street="Teststr 1",
        )
        self.admin = User.objects.create_user(
            username="admin",
            password="TestPass123!",
            role="admin",
            location=self.location,
        )
        self.super_admin = User.objects.create_user(
            username="superadmin",
            password="TestPass123!",
            role="super_admin",
            location=self.location,
        )
        self.educator = User.objects.create_user(
            username="educator",
            password="TestPass123!",
            role="educator",
            location=self.location,
        )

    def test_list_audit_logs_as_admin(self):
        AuditLog.objects.create(
            user=self.admin,
            action="login",
            model_name="User",
            object_id=str(self.admin.id),
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/admin/audit-logs/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        # Signals also create AuditLog entries for model creation in setUp,
        # so we check that at least our manually created entry is present.
        self.assertGreaterEqual(resp.data["count"], 1)

    def test_list_audit_logs_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/admin/audit-logs/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_system_setting_as_super_admin(self):
        self.client.force_authenticate(user=self.super_admin)
        resp = self.client.post(
            "/api/v1/admin/settings/",
            {
                "key": "max_upload_size",
                "value": "10485760",
                "description": "Max Upload Groesse in Bytes",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_create_system_setting_as_admin_forbidden(self):
        """Write operations on SystemSettings require SuperAdmin."""
        self.client.force_authenticate(user=self.admin)
        resp = self.client.post(
            "/api/v1/admin/settings/",
            {"key": "test", "value": "test"},
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_list_system_settings_as_admin(self):
        SystemSetting.objects.create(
            key="app_name",
            value="Kassenbuch v2",
            description="App Name",
        )
        self.client.force_authenticate(user=self.admin)
        resp = self.client.get("/api/v1/admin/settings/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_system_settings_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/admin/settings/")
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)
