"""
Tests for GroupTransfer model and API.
"""

import datetime

import pytest
from django.contrib.auth.models import Group as AuthGroup
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from conftest import _assign_auth_group
from core.models import Location, Organization, User
from groups.models import Group, GroupMember, SchoolYear, Student
from groups.models_transfer import GroupTransfer


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def org(db) -> Organization:
    return Organization.objects.create(
        name="Hilfswerk Kaernten",
        email="hw@test.at",
        street="Teststr 1",
        city="Klagenfurt",
        postal_code="9020",
    )


@pytest.fixture
def loc(org: Organization) -> Location:
    return Location.objects.create(
        organization=org,
        name="VS Annabichl",
        email="vs@test.at",
    )


@pytest.fixture
def loc2(org: Organization) -> Location:
    """Second location for cross-location validation tests."""
    return Location.objects.create(
        organization=org,
        name="VS Waidmannsdorf",
        email="vs2@test.at",
    )


@pytest.fixture
def school_year(org: Organization, loc: Location) -> SchoolYear:
    return SchoolYear.objects.create(
        organization=org,
        location=loc,
        name="2025/2026",
        start_date="2025-09-01",
        end_date="2026-07-04",
        is_active=True,
    )


@pytest.fixture
def group_a(org: Organization, loc: Location, school_year: SchoolYear) -> Group:
    return Group.objects.create(
        organization=org,
        location=loc,
        school_year=school_year,
        name="Gruene Gruppe",
    )


@pytest.fixture
def group_b(org: Organization, loc: Location, school_year: SchoolYear) -> Group:
    return Group.objects.create(
        organization=org,
        location=loc,
        school_year=school_year,
        name="Blaue Gruppe",
    )


@pytest.fixture
def group_other_loc(
    org: Organization, loc2: Location, school_year: SchoolYear
) -> Group:
    """Group at a different location."""
    sy = SchoolYear.objects.create(
        organization=org,
        location=loc2,
        name="2025/2026",
        start_date="2025-09-01",
        end_date="2026-07-04",
        is_active=True,
    )
    return Group.objects.create(
        organization=org,
        location=loc2,
        school_year=sy,
        name="Rote Gruppe",
    )


@pytest.fixture
def student(org: Organization, group_a: Group) -> Student:
    return Student.objects.create(
        organization=org,
        group=group_a,
        first_name="Max",
        last_name="Musterkind",
    )


@pytest.fixture
def educator_a(org: Organization, loc: Location, group_a: Group, setup_permissions) -> User:
    u = User.objects.create_user(
        username="edu_a",
        email="edu_a@test.at",
        password="TestPass123!",
        first_name="Anna",
        last_name="Paed",
        role=User.Role.EDUCATOR,
        location=loc,
        organization=org,
    )
    _assign_auth_group(u)
    GroupMember.objects.create(organization=org, group=group_a, user=u)
    return u


@pytest.fixture
def educator_b(org: Organization, loc: Location, group_b: Group, setup_permissions) -> User:
    u = User.objects.create_user(
        username="edu_b",
        email="edu_b@test.at",
        password="TestPass123!",
        first_name="Berta",
        last_name="Paed",
        role=User.Role.EDUCATOR,
        location=loc,
        organization=org,
    )
    _assign_auth_group(u)
    GroupMember.objects.create(organization=org, group=group_b, user=u)
    return u


@pytest.fixture
def loc_manager(org: Organization, loc: Location, setup_permissions) -> User:
    u = User.objects.create_user(
        username="loc_mgr",
        email="mgr@test.at",
        password="TestPass123!",
        first_name="Maria",
        last_name="Leitung",
        role=User.Role.LOCATION_MANAGER,
        location=loc,
        organization=org,
    )
    return _assign_auth_group(u)


# ---------------------------------------------------------------------------
# Model Tests
# ---------------------------------------------------------------------------


class TestGroupTransferModel:
    """Tests for the GroupTransfer model."""

    def test_create_transfer(self, org, group_a, group_b, student, educator_a):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            end_time=datetime.time(16, 0),
            reason="Personalengpass",
            requested_by=educator_a,
        )
        assert transfer.status == GroupTransfer.Status.PENDING
        assert transfer.organization == org
        assert str(transfer) == "Musterkind, Max → Blaue Gruppe (2026-03-28, Ausstehend)"

    def test_auto_set_organization(self, group_a, group_b, student, educator_a):
        transfer = GroupTransfer.objects.create(
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        assert transfer.organization_id == group_a.organization_id

    def test_reject_cross_location(self, org, group_a, group_other_loc, student, educator_a):
        with pytest.raises(ValidationError, match="innerhalb desselben Standorts"):
            GroupTransfer.objects.create(
                organization=org,
                student=student,
                source_group=group_a,
                target_group=group_other_loc,
                transfer_date=datetime.date(2026, 3, 28),
                start_time=datetime.time(8, 0),
                requested_by=educator_a,
            )

    def test_reject_same_group(self, org, group_a, student, educator_a):
        with pytest.raises(ValidationError, match="nicht identisch"):
            GroupTransfer.objects.create(
                organization=org,
                student=student,
                source_group=group_a,
                target_group=group_a,
                transfer_date=datetime.date(2026, 3, 28),
                start_time=datetime.time(8, 0),
                requested_by=educator_a,
            )

    def test_reject_end_before_start(self, org, group_a, group_b, student, educator_a):
        with pytest.raises(ValidationError, match="Endzeit"):
            GroupTransfer.objects.create(
                organization=org,
                student=student,
                source_group=group_a,
                target_group=group_b,
                transfer_date=datetime.date(2026, 3, 28),
                start_time=datetime.time(16, 0),
                end_time=datetime.time(8, 0),
                requested_by=educator_a,
            )


# ---------------------------------------------------------------------------
# API Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGroupTransferAPI:
    """Tests for the GroupTransfer API endpoints."""

    base_url = "/api/v1/groups/transfers/"

    def _auth(self, user: User) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_create_transfer(self, educator_a, group_a, group_b, student):
        client = self._auth(educator_a)
        resp = client.post(
            self.base_url,
            {
                "student": student.id,
                "source_group": group_a.id,
                "target_group": group_b.id,
                "transfer_date": "2026-03-28",
                "start_time": "08:00",
                "end_time": "16:00",
                "reason": "Personalengpass",
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["status"] == "pending"
        assert resp.data["requested_by"] == educator_a.id

    def test_create_transfer_wrong_group(self, educator_a, group_a, group_b, student):
        """Student does not belong to source_group."""
        client = self._auth(educator_a)
        resp = client.post(
            self.base_url,
            {
                "student": student.id,
                "source_group": group_b.id,
                "target_group": group_a.id,
                "transfer_date": "2026-03-28",
                "start_time": "08:00",
            },
            format="json",
        )
        assert resp.status_code == 400

    def test_list_transfers_educator(self, educator_a, org, group_a, group_b, student):
        GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        client = self._auth(educator_a)
        resp = client.get(self.base_url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_confirm_transfer_by_target_educator(
        self, educator_a, educator_b, org, group_a, group_b, student
    ):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        client = self._auth(educator_b)
        resp = client.post(f"{self.base_url}{transfer.id}/confirm/")
        assert resp.status_code == 200
        assert resp.data["status"] == "confirmed"
        assert resp.data["confirmed_by"] == educator_b.id

    def test_confirm_transfer_by_loc_manager(
        self, educator_a, loc_manager, org, group_a, group_b, student
    ):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        client = self._auth(loc_manager)
        resp = client.post(f"{self.base_url}{transfer.id}/confirm/")
        assert resp.status_code == 200
        assert resp.data["status"] == "confirmed"

    def test_reject_transfer(self, educator_a, educator_b, org, group_a, group_b, student):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        client = self._auth(educator_b)
        resp = client.post(
            f"{self.base_url}{transfer.id}/reject/",
            {"notes": "Kein Platz"},
            format="json",
        )
        assert resp.status_code == 200
        assert resp.data["status"] == "rejected"

    def test_complete_transfer(self, educator_a, loc_manager, org, group_a, group_b, student):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            status=GroupTransfer.Status.CONFIRMED,
            requested_by=educator_a,
        )
        client = self._auth(loc_manager)
        resp = client.post(f"{self.base_url}{transfer.id}/complete/")
        assert resp.status_code == 200
        assert resp.data["status"] == "completed"

    def test_cannot_confirm_non_pending(self, educator_b, org, group_a, group_b, student, educator_a):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            status=GroupTransfer.Status.CONFIRMED,
            requested_by=educator_a,
        )
        client = self._auth(educator_b)
        resp = client.post(f"{self.base_url}{transfer.id}/confirm/")
        assert resp.status_code == 400

    def test_cannot_complete_non_confirmed(self, loc_manager, org, group_a, group_b, student, educator_a):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            status=GroupTransfer.Status.PENDING,
            requested_by=educator_a,
        )
        client = self._auth(loc_manager)
        resp = client.post(f"{self.base_url}{transfer.id}/complete/")
        assert resp.status_code == 400

    def test_source_educator_cannot_confirm_own(
        self, educator_a, org, group_a, group_b, student
    ):
        """Source group educator should not be able to confirm their own request."""
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        client = self._auth(educator_a)
        resp = client.post(f"{self.base_url}{transfer.id}/confirm/")
        # educator_a is not member of target_group (group_b), so 403
        assert resp.status_code == 403

    def test_filter_by_status(self, educator_a, org, group_a, group_b, student):
        GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            status=GroupTransfer.Status.PENDING,
            requested_by=educator_a,
        )
        GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 29),
            start_time=datetime.time(8, 0),
            status=GroupTransfer.Status.CONFIRMED,
            requested_by=educator_a,
        )
        client = self._auth(educator_a)
        resp = client.get(f"{self.base_url}?status=pending")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_soft_delete(self, loc_manager, org, group_a, group_b, student, educator_a):
        transfer = GroupTransfer.objects.create(
            organization=org,
            student=student,
            source_group=group_a,
            target_group=group_b,
            transfer_date=datetime.date(2026, 3, 28),
            start_time=datetime.time(8, 0),
            requested_by=educator_a,
        )
        client = self._auth(loc_manager)
        resp = client.delete(f"{self.base_url}{transfer.id}/")
        assert resp.status_code == 204
        transfer.refresh_from_db()
        assert transfer.is_deleted is True
