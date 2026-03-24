"""
Tests for Celery email notification tasks.
"""

from datetime import date, timedelta
from unittest.mock import patch

from django.test import TestCase, override_settings

from core.models import Location, Organization, User
from system.tasks import (
    send_leave_request_status_notification,
    send_new_leave_request_notification,
    send_password_reset_email,
    send_system_notification,
    send_transaction_status_notification,
)


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class TransactionNotificationTest(TestCase):
    """Tests for transaction status notification tasks."""

    def setUp(self):
        """Set up test data."""
        self.org = Organization.objects.create(
            name="Task Org",
            email="org@test.at",
            street="Teststraße 1",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="Task Location",
            organization=self.org,
            email="loc@test.at",
            street="Standortstraße 1",
            city="Wien",
            postal_code="1010",
        )
        self.user = User.objects.create_user(
            username="task_user",
            email="task_user@test.com",
            password="testpass123",
            first_name="Task",
            last_name="User",
            role="educator",
            location=self.location,
        )
        self.admin = User.objects.create_user(
            username="task_admin",
            email="task_admin@test.com",
            password="testpass123",
            first_name="Task",
            last_name="Admin",
            role="admin",
            location=self.location,
        )

    @patch("system.tasks.send_mail")
    def test_transaction_approved_notification(self, mock_send_mail):
        """Test that approval notification email is sent."""
        from finance.models import Transaction, TransactionCategory
        from groups.models import Group, SchoolYear

        school_year = SchoolYear.objects.create(
            location=self.location,
            name="2025/2026",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 7, 31),
        )
        group = Group.objects.create(
            name="Test Group",
            location=self.location,
            school_year=school_year,
        )
        category = TransactionCategory.objects.create(
            name="Test Cat",
            category_type="expense",
            location=self.location,
        )
        transaction = Transaction.objects.create(
            group=group,
            category=category,
            transaction_type="expense",
            amount=50.00,
            transaction_date=date.today(),
            description="Test Transaction",
            status="approved",
            created_by=self.user,
            approved_by=self.admin,
        )

        send_transaction_status_notification(transaction.id, "approved")

        mock_send_mail.assert_called_once()
        call_kwargs = mock_send_mail.call_args
        self.assertIn("genehmigt", call_kwargs[1]["subject"])
        self.assertEqual(call_kwargs[1]["recipient_list"], ["task_user@test.com"])

    @patch("system.tasks.send_mail")
    def test_transaction_rejected_notification(self, mock_send_mail):
        """Test that rejection notification email is sent."""
        from finance.models import Transaction, TransactionCategory
        from groups.models import Group, SchoolYear

        school_year = SchoolYear.objects.create(
            location=self.location,
            name="2025/2026",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 7, 31),
        )
        group = Group.objects.create(
            name="Test Group 2",
            location=self.location,
            school_year=school_year,
        )
        category = TransactionCategory.objects.create(
            name="Test Cat 2",
            category_type="expense",
            location=self.location,
        )
        transaction = Transaction.objects.create(
            group=group,
            category=category,
            transaction_type="expense",
            amount=100.00,
            transaction_date=date.today(),
            description="Rejected Transaction",
            status="rejected",
            created_by=self.user,
        )

        send_transaction_status_notification(transaction.id, "rejected")

        mock_send_mail.assert_called_once()
        self.assertIn("abgelehnt", mock_send_mail.call_args[1]["subject"])


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class LeaveRequestNotificationTest(TestCase):
    """Tests for leave request notification tasks."""

    def setUp(self):
        """Set up test data."""
        self.org = Organization.objects.create(
            name="Leave Org",
            email="org2@test.at",
            street="Teststraße 2",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="Leave Location",
            organization=self.org,
            email="loc2@test.at",
            street="Standortstraße 2",
            city="Wien",
            postal_code="1010",
        )
        self.user = User.objects.create_user(
            username="leave_user",
            email="leave_user@test.com",
            password="testpass123",
            first_name="Leave",
            last_name="User",
            role="educator",
            location=self.location,
        )
        self.manager = User.objects.create_user(
            username="leave_manager",
            email="leave_manager@test.com",
            password="testpass123",
            first_name="Leave",
            last_name="Manager",
            role="location_manager",
            location=self.location,
        )

    @patch("system.tasks.send_mail")
    def test_leave_approved_notification(self, mock_send_mail):
        """Test that leave approval notification is sent."""
        from timetracking.models import LeaveRequest, LeaveType

        leave_type = LeaveType.objects.create(
            name="Urlaub",
            location=self.location,
        )
        leave = LeaveRequest.objects.create(
            user=self.user,
            leave_type=leave_type,
            start_date=date.today() + timedelta(days=7),
            end_date=date.today() + timedelta(days=14),
            status="approved",
            approved_by=self.manager,
        )

        send_leave_request_status_notification(leave.id, "approved")

        mock_send_mail.assert_called_once()
        self.assertIn("genehmigt", mock_send_mail.call_args[1]["subject"])

    @patch("system.tasks.send_mail")
    def test_new_leave_request_notifies_managers(self, mock_send_mail):
        """Test that new leave request notifies location managers."""
        from timetracking.models import LeaveRequest, LeaveType

        leave_type = LeaveType.objects.create(
            name="Krankheit",
            location=self.location,
        )
        leave = LeaveRequest.objects.create(
            user=self.user,
            leave_type=leave_type,
            start_date=date.today(),
            end_date=date.today() + timedelta(days=3),
            status="pending",
        )

        send_new_leave_request_notification(leave.id)

        mock_send_mail.assert_called_once()
        self.assertIn("leave_manager@test.com", mock_send_mail.call_args[1]["recipient_list"])


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class PasswordResetEmailTest(TestCase):
    """Tests for password reset email task."""

    def setUp(self):
        """Set up test data."""
        self.org = Organization.objects.create(
            name="Reset Org",
            email="org3@test.at",
            street="Teststraße 3",
            city="Wien",
            postal_code="1010",
        )
        self.location = Location.objects.create(
            name="Reset Location",
            organization=self.org,
            email="loc3@test.at",
            street="Standortstraße 3",
            city="Wien",
            postal_code="1010",
        )
        self.user = User.objects.create_user(
            username="reset_user",
            email="reset@test.com",
            password="testpass123",
            role="educator",
            location=self.location,
        )

    @patch("system.tasks.send_mail")
    def test_password_reset_email_sent(self, mock_send_mail):
        """Test that password reset email is sent."""
        send_password_reset_email(self.user.id, "abc123token")

        mock_send_mail.assert_called_once()
        call_kwargs = mock_send_mail.call_args[1]
        self.assertIn("Passwort", call_kwargs["subject"])
        self.assertIn("abc123token", call_kwargs["message"])
        self.assertEqual(call_kwargs["recipient_list"], ["reset@test.com"])


@override_settings(
    EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend",
    CELERY_TASK_ALWAYS_EAGER=True,
    CELERY_TASK_EAGER_PROPAGATES=True,
)
class SystemNotificationTest(TestCase):
    """Tests for generic system notification task."""

    @patch("system.tasks.send_mail")
    def test_system_notification_sent(self, mock_send_mail):
        """Test that system notification is sent."""
        send_system_notification(
            "Test Subject",
            "Test Message",
            ["admin@test.com", "manager@test.com"],
        )

        mock_send_mail.assert_called_once()
        call_kwargs = mock_send_mail.call_args[1]
        self.assertEqual(call_kwargs["subject"], "Test Subject")
        self.assertEqual(len(call_kwargs["recipient_list"]), 2)
