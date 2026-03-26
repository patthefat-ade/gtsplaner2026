"""
Tests for GDPR/DSGVO compliance features.

Tests cover:
- User anonymization
- Student anonymization
- Data export (ZIP) for users and students
- Data retention configuration
- Automatic cleanup task
"""

import json
import zipfile
from io import BytesIO

from django.test import TestCase, override_settings
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from groups.models import Group, SchoolYear, Semester, Student
from system.gdpr_service import GDPRService
from system.models import SystemSetting
from system.tasks import gdpr_cleanup_expired_data


def create_test_fixtures():
    """Create common test fixtures for GDPR tests."""
    org = Organization.objects.create(name="Test Org")
    location = Location.objects.create(
        name="Test Standort",
        organization=org,
    )
    school_year = SchoolYear.objects.create(
        name="2025/26",
        start_date="2025-09-01",
        end_date="2026-06-30",
        location=location,
    )
    semester = Semester.objects.create(
        school_year=school_year,
        name="WS 2025",
        start_date="2025-09-01",
        end_date="2026-01-31",
    )
    group = Group.objects.create(
        name="Gruppe A",
        school_year=school_year,
        location=location,
    )
    return org, location, school_year, semester, group


@override_settings(
    ENCRYPTION_KEY="test-key-for-encryption-32bytes!",
    SALT_KEY="test-salt-key-for-hashing-32by!",
)
class GDPRAnonymizationTest(TestCase):
    """Test GDPR pseudoanonymization of users and students."""

    def setUp(self):
        self.org, self.location, self.school_year, self.semester, self.group = create_test_fixtures()
        self.super_admin = User.objects.create_user(
            username="superadmin",
            email="superadmin@gtsplaner.app",
            password="Test123!",
            role="super_admin",
            first_name="Super",
            last_name="Admin",
        )
        self.test_user = User.objects.create_user(
            username="testuser",
            email="test@gtsplaner.app",
            password="Test123!",
            role="educator",
            first_name="Maria",
            last_name="Muster",
            phone="0660 1234567",
        )
        self.student = Student.objects.create(
            group=self.group,
            first_name="Max",
            last_name="Musterkind",
            email="max@test.at",
            phone="0660 9876543",
            street="Teststraße 1",
            city="Wien",
            postal_code="1010",
        )

    def test_anonymize_user(self):
        """Test that user anonymization replaces all PII."""
        result = GDPRService.anonymize_user(self.test_user)

        self.assertEqual(result["status"], "anonymized")
        self.test_user.refresh_from_db()
        self.assertEqual(self.test_user.first_name, "Gel\u00f6schter")
        self.assertEqual(self.test_user.last_name, "Benutzer")
        self.assertEqual(self.test_user.email, f"deleted_{self.test_user.pk}@anonymized.local")
        # EncryptedFields with null=True store empty string as None
        self.assertIn(self.test_user.phone, ["", None])
        self.assertFalse(self.test_user.is_active)
        self.assertTrue(self.test_user.is_anonymized)

    def test_anonymize_user_already_anonymized(self):
        """Test that re-anonymization is prevented."""
        GDPRService.anonymize_user(self.test_user)
        result = GDPRService.anonymize_user(self.test_user)
        self.assertEqual(result["status"], "already_anonymized")

    def test_anonymize_student(self):
        """Test that student anonymization replaces all PII."""
        result = GDPRService.anonymize_student(self.student)

        self.assertEqual(result["status"], "anonymized")
        self.student.refresh_from_db()
        self.assertEqual(self.student.first_name, "Anonymisiert")
        self.assertEqual(self.student.last_name, "Kind")
        self.assertIsNone(self.student.date_of_birth)
        # EncryptedFields with null=True store empty string as None
        self.assertIn(self.student.email, ["", None])
        self.assertIn(self.student.phone, ["", None])
        self.assertIn(self.student.street, ["", None])
        self.assertIn(self.student.city, ["", None])
        self.assertIn(self.student.postal_code, ["", None])
        self.assertFalse(self.student.is_active)
        self.assertTrue(self.student.is_anonymized)


@override_settings(
    ENCRYPTION_KEY="test-key-for-encryption-32bytes!",
    SALT_KEY="test-salt-key-for-hashing-32by!",
)
class GDPRDataExportTest(TestCase):
    """Test GDPR data export functionality."""

    def setUp(self):
        self.org, self.location, self.school_year, self.semester, self.group = create_test_fixtures()
        self.user = User.objects.create_user(
            username="testuser",
            email="test@gtsplaner.app",
            password="Test123!",
            role="educator",
            first_name="Maria",
            last_name="Muster",
        )
        self.student = Student.objects.create(
            group=self.group,
            first_name="Max",
            last_name="Musterkind",
        )

    def test_export_user_data_returns_zip(self):
        """Test that user data export returns a valid ZIP file."""
        zip_buffer = GDPRService.export_user_data(self.user)

        self.assertIsInstance(zip_buffer, BytesIO)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            self.assertIn("README.txt", names)
            self.assertIn("01_profildaten.json", names)
            self.assertIn("02_zeiteintraege.json", names)
            self.assertIn("03_urlaubsantraege.json", names)
            self.assertIn("04_transaktionen.json", names)

            # Verify profile data
            profile = json.loads(zf.read("01_profildaten.json"))
            self.assertEqual(profile["vorname"], "Maria")
            self.assertEqual(profile["nachname"], "Muster")
            self.assertEqual(profile["email"], "test@gtsplaner.app")

    def test_export_student_data_returns_zip(self):
        """Test that student data export returns a valid ZIP file."""
        zip_buffer = GDPRService.export_student_data(self.student)

        self.assertIsInstance(zip_buffer, BytesIO)
        with zipfile.ZipFile(zip_buffer, "r") as zf:
            names = zf.namelist()
            self.assertIn("README.txt", names)
            self.assertIn("01_profildaten.json", names)

            # Verify profile data
            profile = json.loads(zf.read("01_profildaten.json"))
            self.assertEqual(profile["vorname"], "Max")
            self.assertEqual(profile["nachname"], "Musterkind")


@override_settings(
    ENCRYPTION_KEY="test-key-for-encryption-32bytes!",
    SALT_KEY="test-salt-key-for-hashing-32by!",
)
class GDPRAPITest(TestCase):
    """Test GDPR API endpoints."""

    def setUp(self):
        self.client = APIClient()
        self.org, self.location, self.school_year, self.semester, self.group = create_test_fixtures()
        self.super_admin = User.objects.create_user(
            username="superadmin",
            email="superadmin@gtsplaner.app",
            password="Test123!",
            role="super_admin",
            first_name="Super",
            last_name="Admin",
            is_staff=True,
        )
        self.test_user = User.objects.create_user(
            username="testuser",
            email="test@gtsplaner.app",
            password="Test123!",
            role="educator",
            first_name="Maria",
            last_name="Muster",
        )
        self.student = Student.objects.create(
            group=self.group,
            first_name="Max",
            last_name="Musterkind",
        )
        self.client.force_authenticate(user=self.super_admin)

    def test_anonymize_user_api(self):
        """Test user anonymization via API."""
        response = self.client.post(
            f"/api/v1/admin/gdpr/anonymize-user/{self.test_user.pk}/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "anonymized")

    def test_anonymize_self_forbidden(self):
        """Test that self-anonymization is forbidden."""
        response = self.client.post(
            f"/api/v1/admin/gdpr/anonymize-user/{self.super_admin.pk}/"
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_anonymize_student_api(self):
        """Test student anonymization via API."""
        response = self.client.post(
            f"/api/v1/admin/gdpr/anonymize-student/{self.student.pk}/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["status"], "anonymized")

    def test_export_user_data_api(self):
        """Test user data export via API returns ZIP."""
        response = self.client.get(
            f"/api/v1/admin/gdpr/export-user/{self.test_user.pk}/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/zip")

    def test_export_student_data_api(self):
        """Test student data export via API returns ZIP."""
        response = self.client.get(
            f"/api/v1/admin/gdpr/export-student/{self.student.pk}/"
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response["Content-Type"], "application/zip")

    def test_retention_stats_api(self):
        """Test retention statistics API."""
        response = self.client.get("/api/v1/admin/gdpr/stats/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("retention_years", response.data)
        self.assertIn("active_users", response.data)

    def test_retention_config_api(self):
        """Test retention configuration API."""
        # GET default
        response = self.client.get("/api/v1/admin/gdpr/retention-config/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data_retention_years"], 7)

        # PUT update
        response = self.client.put(
            "/api/v1/admin/gdpr/retention-config/",
            {"data_retention_years": 10},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["data_retention_years"], 10)

    def test_non_superadmin_forbidden(self):
        """Test that non-superadmin users cannot access GDPR endpoints."""
        educator = User.objects.create_user(
            username="educator",
            email="edu@gtsplaner.app",
            password="Test123!",
            role="educator",
        )
        self.client.force_authenticate(user=educator)
        response = self.client.get("/api/v1/admin/gdpr/stats/")
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


@override_settings(
    ENCRYPTION_KEY="test-key-for-encryption-32bytes!",
    SALT_KEY="test-salt-key-for-hashing-32by!",
)
class GDPRCleanupTaskTest(TestCase):
    """Test GDPR automatic cleanup task."""

    def setUp(self):
        self.org, self.location, self.school_year, self.semester, self.group = create_test_fixtures()

    def test_cleanup_does_not_delete_recent_anonymized(self):
        """Test that recently anonymized records are not deleted."""
        user = User.objects.create_user(
            username="recent",
            email="recent@test.at",
            password="Test123!",
            role="educator",
        )
        user.anonymize()

        result = gdpr_cleanup_expired_data()
        self.assertEqual(result["deleted_users"], 0)
        self.assertTrue(User.objects.filter(pk=user.pk).exists())

    def test_cleanup_deletes_old_anonymized(self):
        """Test that old anonymized records are deleted after retention period."""
        from datetime import timedelta

        user = User.objects.create_user(
            username="old",
            email="old@test.at",
            password="Test123!",
            role="educator",
        )
        user.anonymize()

        # Manually set anonymized_at to 8 years ago
        User.objects.filter(pk=user.pk).update(
            anonymized_at=timezone.now() - timedelta(days=8 * 365)
        )

        result = gdpr_cleanup_expired_data()
        self.assertEqual(result["deleted_users"], 1)
        self.assertFalse(User.objects.filter(pk=user.pk).exists())

    def test_cleanup_respects_configured_retention(self):
        """Test that cleanup respects the configured retention period."""
        from datetime import timedelta

        SystemSetting.objects.create(
            key="data_retention_years",
            value="3",
            description="Test retention",
        )

        user = User.objects.create_user(
            username="configured",
            email="configured@test.at",
            password="Test123!",
            role="educator",
        )
        user.anonymize()

        # Set anonymized_at to 4 years ago (should be deleted with 3-year retention)
        User.objects.filter(pk=user.pk).update(
            anonymized_at=timezone.now() - timedelta(days=4 * 365)
        )

        result = gdpr_cleanup_expired_data()
        self.assertEqual(result["deleted_users"], 1)
        self.assertEqual(result["retention_years"], 3)
