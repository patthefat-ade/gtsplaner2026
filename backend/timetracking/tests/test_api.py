"""
API tests for Timetracking endpoints: TimeEntry, LeaveType, LeaveRequest.

Tests CRUD operations, leave approval workflow, and RBAC access control.
"""

import datetime

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from groups.models import Group, GroupMember, SchoolYear
from timetracking.models import LeaveRequest, LeaveType, TimeEntry


class TimetrackingAPITestBase(TestCase):
    """Base class with shared setup for timetracking API tests."""

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
        self.educator = User.objects.create_user(
            username="educator",
            password="TestPass123!",
            role="educator",
            location=self.location,
            first_name="Test",
            last_name="Educator",
        )
        self.manager = User.objects.create_user(
            username="manager",
            password="TestPass123!",
            role="location_manager",
            location=self.location,
            first_name="Test",
            last_name="Manager",
        )
        self.school_year = SchoolYear.objects.create(
            name="2025/2026",
            location=self.location,
            start_date=datetime.date(2025, 9, 1),
            end_date=datetime.date(2026, 6, 30),
        )
        self.group = Group.objects.create(
            name="Testgruppe",
            location=self.location,
            school_year=self.school_year,
            leader=self.educator,
        )
        GroupMember.objects.create(
            group=self.group, user=self.educator, role="leader"
        )
        self.leave_type = LeaveType.objects.create(
            name="Urlaub",
            location=self.location,
            max_days_per_year=25,
        )


class TimeEntryAPITest(TimetrackingAPITestBase):
    """Tests for TimeEntry CRUD."""

    def test_create_time_entry(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/timetracking/entries/",
            {
                "group": self.group.id,
                "date": "2026-03-01",
                "start_time": "08:00:00",
                "end_time": "16:00:00",
                "notes": "Normaler Arbeitstag",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        entry = TimeEntry.objects.first()
        self.assertEqual(entry.user, self.educator)

    def test_list_time_entries_educator_sees_own(self):
        TimeEntry.objects.create(
            user=self.educator,
            group=self.group,
            date=datetime.date(2026, 3, 1),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
        )
        other_educator = User.objects.create_user(
            username="other",
            password="TestPass123!",
            role="educator",
            location=self.location,
        )
        TimeEntry.objects.create(
            user=other_educator,
            group=self.group,
            date=datetime.date(2026, 3, 1),
            start_time=datetime.time(9, 0),
            end_time=datetime.time(17, 0),
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/timetracking/entries/")
        self.assertEqual(resp.data["count"], 1)

    def test_manager_sees_all_location_entries(self):
        TimeEntry.objects.create(
            user=self.educator,
            group=self.group,
            date=datetime.date(2026, 3, 1),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get("/api/v1/timetracking/entries/")
        self.assertEqual(resp.data["count"], 1)

    def test_filter_entries_by_date(self):
        TimeEntry.objects.create(
            user=self.educator,
            group=self.group,
            date=datetime.date(2026, 3, 1),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
        )
        TimeEntry.objects.create(
            user=self.educator,
            group=self.group,
            date=datetime.date(2026, 3, 15),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            "/api/v1/timetracking/entries/",
            {"start_date": "2026-03-10", "end_date": "2026-03-31"},
        )
        self.assertEqual(resp.data["count"], 1)

    def test_delete_time_entry_soft_delete(self):
        entry = TimeEntry.objects.create(
            user=self.educator,
            group=self.group,
            date=datetime.date(2026, 3, 1),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.delete(f"/api/v1/timetracking/entries/{entry.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        entry.refresh_from_db()
        self.assertTrue(entry.is_deleted)

    def test_unauthenticated_access_denied(self):
        resp = self.client.get("/api/v1/timetracking/entries/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class LeaveTypeAPITest(TimetrackingAPITestBase):
    """Tests for LeaveType CRUD."""

    def test_list_leave_types(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/timetracking/leave-types/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_create_leave_type_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/timetracking/leave-types/",
            {"name": "Krankheit", "max_days_per_year": 30},
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_leave_type_as_manager(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/v1/timetracking/leave-types/",
            {"name": "Krankheit", "max_days_per_year": 30},
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)


class LeaveRequestAPITest(TimetrackingAPITestBase):
    """Tests for LeaveRequest CRUD and approval workflow."""

    def test_create_leave_request(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/timetracking/leave-requests/",
            {
                "leave_type": self.leave_type.id,
                "start_date": "2026-04-01",
                "end_date": "2026-04-05",
                "reason": "Osterurlaub",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_approve_leave_request(self):
        lr = LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 5),
            reason="Urlaub",
            status="pending",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/v1/timetracking/leave-requests/{lr.id}/approve/",
            {"approval_notes": "Genehmigt"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        lr.refresh_from_db()
        self.assertEqual(lr.status, "approved")

    def test_reject_leave_request(self):
        lr = LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 5),
            reason="Urlaub",
            status="pending",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/v1/timetracking/leave-requests/{lr.id}/reject/",
            {"approval_notes": "Leider nicht moeglich"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        lr.refresh_from_db()
        self.assertEqual(lr.status, "rejected")

    def test_cancel_own_leave_request(self):
        lr = LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 5),
            reason="Urlaub",
            status="pending",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            f"/api/v1/timetracking/leave-requests/{lr.id}/cancel/"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        lr.refresh_from_db()
        self.assertEqual(lr.status, "cancelled")

    def test_cancel_other_user_request_forbidden(self):
        """Other educator cannot cancel - gets 404 because queryset filters by user."""
        lr = LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 5),
            reason="Urlaub",
            status="pending",
        )
        other = User.objects.create_user(
            username="other",
            password="TestPass123!",
            role="educator",
            location=self.location,
        )
        self.client.force_authenticate(user=other)
        resp = self.client.post(
            f"/api/v1/timetracking/leave-requests/{lr.id}/cancel/"
        )
        # 404 because the queryset filters by user - other educator cannot see this request
        self.assertEqual(resp.status_code, status.HTTP_404_NOT_FOUND)

    def test_educator_cannot_approve(self):
        lr = LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 5),
            reason="Urlaub",
            status="pending",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            f"/api/v1/timetracking/leave-requests/{lr.id}/approve/", {}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_filter_leave_requests_by_status(self):
        LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 4, 1),
            end_date=datetime.date(2026, 4, 5),
            reason="Pending",
            status="pending",
        )
        LeaveRequest.objects.create(
            user=self.educator,
            leave_type=self.leave_type,
            start_date=datetime.date(2026, 5, 1),
            end_date=datetime.date(2026, 5, 5),
            reason="Draft",
            status="draft",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            "/api/v1/timetracking/leave-requests/", {"status": "pending"}
        )
        self.assertEqual(resp.data["count"], 1)
