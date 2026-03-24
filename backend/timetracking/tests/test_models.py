"""
Tests for Timetracking models: TimeEntry, LeaveType, LeaveRequest, WorkingHoursLimit.
"""

import pytest
from datetime import date, time
from decimal import Decimal

from django.db import IntegrityError

from core.models import Organization, Location, User
from groups.models import SchoolYear, Group
from timetracking.models import LeaveRequest, LeaveType, TimeEntry, WorkingHoursLimit


@pytest.fixture
def organization(db):
    return Organization.objects.create(
        name="Test Organisation TT",
        email="org@test.at",
        street="Teststr. 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def location(organization):
    return Location.objects.create(
        organization=organization,
        name="Test Standort TT",
        email="standort@test.at",
        street="Standortstr. 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def educator(location):
    return User.objects.create_user(
        username="educator_tt",
        email="educator_tt@test.at",
        password="testpass123",
        first_name="Anna",
        last_name="Muster",
        role=User.Role.EDUCATOR,
        location=location,
    )


@pytest.fixture
def manager(location):
    return User.objects.create_user(
        username="manager_tt",
        email="manager_tt@test.at",
        password="testpass123",
        first_name="Max",
        last_name="Manager",
        role=User.Role.LOCATION_MANAGER,
        location=location,
    )


@pytest.fixture
def school_year(location):
    return SchoolYear.objects.create(
        location=location,
        name="2025/2026",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 7, 31),
        is_active=True,
    )


@pytest.fixture
def group(location, school_year, educator):
    return Group.objects.create(
        location=location,
        school_year=school_year,
        name="Testgruppe TT",
        leader=educator,
    )


@pytest.fixture
def leave_type(location):
    return LeaveType.objects.create(
        location=location,
        name="Urlaub",
        requires_approval=True,
        max_days_per_year=25,
    )


class TestTimeEntryModel:
    """Tests for TimeEntry model."""

    def test_create_time_entry(self, educator, group):
        entry = TimeEntry.objects.create(
            user=educator,
            group=group,
            date=date(2026, 3, 1),
            start_time=time(8, 0),
            end_time=time(16, 0),
        )
        assert entry.duration_minutes == 480  # 8 hours

    def test_duration_calculation(self, educator, group):
        entry = TimeEntry.objects.create(
            user=educator,
            group=group,
            date=date(2026, 3, 1),
            start_time=time(9, 30),
            end_time=time(13, 45),
        )
        assert entry.duration_minutes == 255  # 4h 15min

    def test_time_entry_str(self, educator, group):
        entry = TimeEntry.objects.create(
            user=educator,
            group=group,
            date=date(2026, 3, 1),
            start_time=time(8, 0),
            end_time=time(16, 0),
        )
        result = str(entry)
        assert "Anna Muster" in result
        assert "480" in result

    def test_time_entry_with_notes(self, educator, group):
        entry = TimeEntry.objects.create(
            user=educator,
            group=group,
            date=date(2026, 3, 1),
            start_time=time(8, 0),
            end_time=time(12, 0),
            notes="Vormittagsbetreuung",
        )
        assert entry.notes == "Vormittagsbetreuung"

    def test_multiple_entries_per_day(self, educator, group):
        TimeEntry.objects.create(
            user=educator,
            group=group,
            date=date(2026, 3, 1),
            start_time=time(8, 0),
            end_time=time(12, 0),
        )
        TimeEntry.objects.create(
            user=educator,
            group=group,
            date=date(2026, 3, 1),
            start_time=time(13, 0),
            end_time=time(16, 0),
        )
        entries = TimeEntry.objects.filter(user=educator, date=date(2026, 3, 1))
        assert entries.count() == 2
        total = sum(e.duration_minutes for e in entries)
        assert total == 420  # 7 hours


class TestLeaveTypeModel:
    """Tests for LeaveType model."""

    def test_create_leave_type(self, leave_type):
        assert leave_type.name == "Urlaub"
        assert leave_type.requires_approval is True
        assert leave_type.max_days_per_year == 25

    def test_leave_type_str(self, leave_type):
        assert "Urlaub" in str(leave_type)

    def test_unique_together(self, location, leave_type):
        """Same name + location should fail."""
        with pytest.raises(IntegrityError):
            LeaveType.objects.create(
                location=location,
                name="Urlaub",
            )

    def test_system_type(self, location):
        lt = LeaveType.objects.create(
            location=location,
            name="Krankheit",
            is_system_type=True,
            requires_approval=False,
        )
        assert lt.is_system_type is True
        assert lt.requires_approval is False


class TestLeaveRequestModel:
    """Tests for LeaveRequest model."""

    def test_create_leave_request(self, educator, leave_type):
        req = LeaveRequest.objects.create(
            user=educator,
            leave_type=leave_type,
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 5),
            reason="Osterurlaub",
        )
        assert req.total_days == 5
        assert req.status == "pending"

    def test_total_days_calculation(self, educator, leave_type):
        req = LeaveRequest.objects.create(
            user=educator,
            leave_type=leave_type,
            start_date=date(2026, 6, 1),
            end_date=date(2026, 6, 14),
            reason="Sommerurlaub",
        )
        assert req.total_days == 14

    def test_single_day_request(self, educator, leave_type):
        req = LeaveRequest.objects.create(
            user=educator,
            leave_type=leave_type,
            start_date=date(2026, 3, 15),
            end_date=date(2026, 3, 15),
            reason="Arzttermin",
        )
        assert req.total_days == 1

    def test_leave_request_approval(self, educator, manager, leave_type):
        from django.utils import timezone

        req = LeaveRequest.objects.create(
            user=educator,
            leave_type=leave_type,
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 5),
            reason="Urlaub",
        )
        req.status = LeaveRequest.Status.APPROVED
        req.approved_by = manager
        req.approved_at = timezone.now()
        req.approval_notes = "Genehmigt"
        req.save()
        req.refresh_from_db()
        assert req.status == "approved"
        assert req.approved_by == manager

    def test_leave_request_rejection(self, educator, manager, leave_type):
        req = LeaveRequest.objects.create(
            user=educator,
            leave_type=leave_type,
            start_date=date(2026, 12, 20),
            end_date=date(2026, 12, 31),
            reason="Weihnachtsurlaub",
        )
        req.status = LeaveRequest.Status.REJECTED
        req.approved_by = manager
        req.approval_notes = "Zu viele Abwesenheiten im Dezember"
        req.save()
        req.refresh_from_db()
        assert req.status == "rejected"

    def test_leave_request_str(self, educator, leave_type):
        req = LeaveRequest.objects.create(
            user=educator,
            leave_type=leave_type,
            start_date=date(2026, 4, 1),
            end_date=date(2026, 4, 5),
            reason="Test",
        )
        result = str(req)
        assert "Anna Muster" in result
        assert "Ausstehend" in result


class TestWorkingHoursLimitModel:
    """Tests for WorkingHoursLimit model."""

    def test_create_working_hours_limit(self, location):
        limit = WorkingHoursLimit.objects.create(
            location=location,
            max_hours_per_week=Decimal("38.50"),
            max_hours_per_day=Decimal("8.00"),
            min_break_duration_minutes=30,
            min_break_after_hours=Decimal("6.00"),
        )
        assert limit.max_hours_per_week == Decimal("38.50")
        assert limit.max_hours_per_day == Decimal("8.00")
        assert limit.min_break_duration_minutes == 30

    def test_default_values(self, location):
        limit = WorkingHoursLimit.objects.create(location=location)
        assert limit.max_hours_per_week == Decimal("40")
        assert limit.max_hours_per_day == Decimal("8")
        assert limit.min_break_duration_minutes == 30
        assert limit.min_break_after_hours == Decimal("6")
        assert limit.require_break_confirmation is False

    def test_one_per_location(self, location):
        """Only one WorkingHoursLimit per location (OneToOne)."""
        WorkingHoursLimit.objects.create(location=location)
        with pytest.raises(IntegrityError):
            WorkingHoursLimit.objects.create(location=location)

    def test_str(self, location):
        limit = WorkingHoursLimit.objects.create(location=location)
        assert "Test Standort TT" in str(limit)
