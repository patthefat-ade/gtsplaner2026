"""
Tests for CSV and Excel export endpoints.
"""

from datetime import date

from django.test import TestCase
from rest_framework.test import APIClient

from core.models import Location, Organization, User


class TransactionExportTest(TestCase):
    """Tests for transaction export endpoint."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="Export Org",
            email="org@test.at",
            street="Teststraße 1",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="Export Location",
            organization=self.org,
            email="loc@test.at",
            street="Standortstraße 1",
            city="Wien",
            postal_code="1010",
        )
        self.admin = User.objects.create_user(
            username="export_admin",
            email="export_admin@test.com",
            password="testpass123",
            role="admin",
            location=self.location,
        )
        self.educator = User.objects.create_user(
            username="export_educator",
            email="export_educator@test.com",
            password="testpass123",
            role="educator",
            location=self.location,
        )

        # Create test transactions
        from finance.models import Transaction, TransactionCategory
        from groups.models import Group, SchoolYear

        self.school_year = SchoolYear.objects.create(
            location=self.location,
            name="2025/2026",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 7, 31),
        )
        self.group = Group.objects.create(
            name="Export Group",
            location=self.location,
            school_year=self.school_year,
        )
        self.category = TransactionCategory.objects.create(
            name="Export Cat",
            category_type="expense",
            location=self.location,
        )
        for i in range(5):
            Transaction.objects.create(
                group=self.group,
                category=self.category,
                transaction_type="expense",
                amount=10.00 * (i + 1),
                transaction_date=date.today(),
                description=f"Export Transaction {i}",
                status="approved",
                created_by=self.admin,
            )

    def test_export_csv_as_admin(self):
        """Admin should be able to export transactions as CSV."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/export/transactions/?export_format=csv")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])
        self.assertIn("attachment", response["Content-Disposition"])
        self.assertIn(".csv", response["Content-Disposition"])

    def test_export_xlsx_as_admin(self):
        """Admin should be able to export transactions as Excel."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/export/transactions/?export_format=xlsx")

        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])
        self.assertIn(".xlsx", response["Content-Disposition"])

    def test_export_denied_for_educator(self):
        """Educator should not be able to export transactions."""
        self.client.force_authenticate(user=self.educator)
        response = self.client.get("/api/v1/export/transactions/?export_format=csv")

        self.assertEqual(response.status_code, 403)

    def test_export_with_date_filter(self):
        """Export should support date range filter."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(
            f"/api/v1/export/transactions/?export_format=csv"
            f"&start_date={date.today()}&end_date={date.today()}"
        )

        self.assertEqual(response.status_code, 200)

    def test_export_unauthenticated(self):
        """Unauthenticated users should not be able to export."""
        response = self.client.get("/api/v1/export/transactions/?export_format=csv")
        self.assertEqual(response.status_code, 401)


class TimeEntryExportTest(TestCase):
    """Tests for time entry export endpoint."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="TE Export Org",
            email="org2@test.at",
            street="Teststraße 2",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="TE Export Location",
            organization=self.org,
            email="loc2@test.at",
            street="Standortstraße 2",
            city="Wien",
            postal_code="1010",
        )
        self.manager = User.objects.create_user(
            username="te_manager",
            email="te_manager@test.com",
            password="testpass123",
            role="location_manager",
            location=self.location,
        )

    def test_export_time_entries_csv(self):
        """Location manager should be able to export time entries as CSV."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get("/api/v1/export/time-entries/?export_format=csv")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])

    def test_export_time_entries_xlsx(self):
        """Location manager should be able to export time entries as Excel."""
        self.client.force_authenticate(user=self.manager)
        response = self.client.get("/api/v1/export/time-entries/?export_format=xlsx")

        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])


class LeaveRequestExportTest(TestCase):
    """Tests for leave request export endpoint."""

    def setUp(self):
        """Set up test data."""
        self.client = APIClient()
        self.org = Organization.objects.create(
            name="LR Export Org",
            email="org3@test.at",
            street="Teststraße 3",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="LR Export Location",
            organization=self.org,
            email="loc3@test.at",
            street="Standortstraße 3",
            city="Wien",
            postal_code="1010",
        )
        self.admin = User.objects.create_user(
            username="lr_admin",
            email="lr_admin@test.com",
            password="testpass123",
            role="admin",
            location=self.location,
        )

    def test_export_leave_requests_csv(self):
        """Admin should be able to export leave requests as CSV."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/export/leave-requests/?export_format=csv")

        self.assertEqual(response.status_code, 200)
        self.assertIn("text/csv", response["Content-Type"])

    def test_export_leave_requests_xlsx(self):
        """Admin should be able to export leave requests as Excel."""
        self.client.force_authenticate(user=self.admin)
        response = self.client.get("/api/v1/export/leave-requests/?export_format=xlsx")

        self.assertEqual(response.status_code, 200)
        self.assertIn("spreadsheetml", response["Content-Type"])
