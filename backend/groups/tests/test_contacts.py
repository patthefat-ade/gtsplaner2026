"""
Tests for StudentContact model and API.
"""

import pytest
from django.core.exceptions import ValidationError
from rest_framework.test import APIClient

from conftest import _assign_auth_group
from core.models import Location, Organization, User
from groups.models import Group, GroupMember, SchoolYear, Student
from groups.models_contacts import StudentContact


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
def group(org: Organization, loc: Location, school_year: SchoolYear) -> Group:
    return Group.objects.create(
        organization=org,
        location=loc,
        school_year=school_year,
        name="Gruene Gruppe",
    )


@pytest.fixture
def student(org: Organization, group: Group) -> Student:
    return Student.objects.create(
        organization=org,
        group=group,
        first_name="Max",
        last_name="Musterkind",
    )


@pytest.fixture
def educator(org: Organization, loc: Location, group: Group, setup_permissions) -> User:
    u = User.objects.create_user(
        username="edu",
        email="edu@test.at",
        password="TestPass123!",
        first_name="Anna",
        last_name="Paed",
        role=User.Role.EDUCATOR,
        location=loc,
        organization=org,
    )
    _assign_auth_group(u)
    GroupMember.objects.create(organization=org, group=group, user=u)
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


class TestStudentContactModel:
    """Tests for the StudentContact model."""

    def test_create_contact(self, org, student):
        contact = StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
            phone="+43 664 1234567",
            email="erika@test.at",
            whatsapp_available=True,
        )
        assert contact.is_primary is True
        assert "Hauptansprechperson" in str(contact)
        assert contact.organization == org

    def test_auto_set_organization(self, student):
        contact = StudentContact.objects.create(
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        assert contact.organization_id == student.group.organization_id

    def test_max_4_contacts(self, org, student):
        for i in range(4):
            StudentContact.objects.create(
                organization=org,
                student=student,
                is_primary=(i == 0),
                relationship=StudentContact.Relationship.PARENT,
                first_name=f"Person{i}",
                last_name="Test",
            )
        with pytest.raises(ValidationError, match="maximal 4"):
            StudentContact.objects.create(
                organization=org,
                student=student,
                is_primary=False,
                relationship=StudentContact.Relationship.AUTHORIZED,
                first_name="Person5",
                last_name="Test",
            )

    def test_only_one_primary(self, org, student):
        StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        with pytest.raises(ValidationError, match="Hauptansprechperson"):
            StudentContact.objects.create(
                organization=org,
                student=student,
                is_primary=True,
                relationship=StudentContact.Relationship.PARENT,
                first_name="Hans",
                last_name="Mustermann",
            )

    def test_all_relationship_types(self, org, student):
        for rel in StudentContact.Relationship:
            c = StudentContact(
                organization=org,
                student=student,
                is_primary=False,
                relationship=rel,
                first_name="Test",
                last_name=rel.label,
            )
            # Just validate, don't save (would hit max 4 limit)
            assert c.get_relationship_display() == rel.label


# ---------------------------------------------------------------------------
# API Tests
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestStudentContactAPI:
    """Tests for the StudentContact API endpoints."""

    base_url = "/api/v1/groups/contacts/"

    def _auth(self, user: User) -> APIClient:
        client = APIClient()
        client.force_authenticate(user=user)
        return client

    def test_create_contact(self, loc_manager, student):
        client = self._auth(loc_manager)
        resp = client.post(
            self.base_url,
            {
                "student": student.id,
                "is_primary": True,
                "relationship": "parent",
                "first_name": "Erika",
                "last_name": "Mustermann",
                "phone": "+43 664 1234567",
                "email": "erika@test.at",
                "whatsapp_available": True,
            },
            format="json",
        )
        assert resp.status_code == 201
        assert resp.data["is_primary"] is True
        assert resp.data["relationship"] == "parent"

    def test_list_contacts(self, educator, org, student):
        StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        client = self._auth(educator)
        resp = client.get(f"{self.base_url}?student_id={student.id}")
        assert resp.status_code == 200
        assert resp.data["count"] == 1
        assert resp.data["results"][0]["relationship_display"] == "Elternteil"

    def test_update_contact(self, loc_manager, org, student):
        contact = StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        client = self._auth(loc_manager)
        resp = client.patch(
            f"{self.base_url}{contact.id}/",
            {"phone": "+43 664 9999999"},
            format="json",
        )
        assert resp.status_code == 200

    def test_soft_delete(self, loc_manager, org, student):
        contact = StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        client = self._auth(loc_manager)
        resp = client.delete(f"{self.base_url}{contact.id}/")
        assert resp.status_code == 204
        contact.refresh_from_db()
        assert contact.is_deleted is True

    def test_educator_cannot_create(self, educator, student):
        """Educators should not be able to create contacts."""
        client = self._auth(educator)
        resp = client.post(
            self.base_url,
            {
                "student": student.id,
                "is_primary": True,
                "relationship": "parent",
                "first_name": "Erika",
                "last_name": "Mustermann",
            },
            format="json",
        )
        assert resp.status_code == 403

    def test_educator_can_read(self, educator, org, student):
        StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        client = self._auth(educator)
        resp = client.get(self.base_url)
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_filter_by_relationship(self, loc_manager, org, student):
        StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=True,
            relationship=StudentContact.Relationship.PARENT,
            first_name="Erika",
            last_name="Mustermann",
        )
        StudentContact.objects.create(
            organization=org,
            student=student,
            is_primary=False,
            relationship=StudentContact.Relationship.GRANDPARENT,
            first_name="Oma",
            last_name="Mustermann",
        )
        client = self._auth(loc_manager)
        resp = client.get(f"{self.base_url}?relationship=grandparent")
        assert resp.status_code == 200
        assert resp.data["count"] == 1

    def test_max_4_contacts_api(self, loc_manager, org, student):
        for i in range(4):
            StudentContact.objects.create(
                organization=org,
                student=student,
                is_primary=(i == 0),
                relationship=StudentContact.Relationship.PARENT,
                first_name=f"Person{i}",
                last_name="Test",
            )
        client = self._auth(loc_manager)
        resp = client.post(
            self.base_url,
            {
                "student": student.id,
                "is_primary": False,
                "relationship": "authorized",
                "first_name": "Person5",
                "last_name": "Test",
            },
            format="json",
        )
        assert resp.status_code == 400
