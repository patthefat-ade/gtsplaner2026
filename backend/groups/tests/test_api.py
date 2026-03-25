"""
API tests for Groups endpoints: SchoolYear, Group, GroupMember, Student.

Tests CRUD operations, member management, and RBAC access control.
"""

from decimal import Decimal

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from groups.models import Group, GroupMember, SchoolYear, Semester, Student


class GroupsAPITestBase(TestCase):
    """Base class with shared setup for groups API tests."""

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
        self.admin = User.objects.create_user(
            username="admin",
            password="TestPass123!",
            role="admin",
            location=self.location,
            first_name="Test",
            last_name="Admin",
        )
        self.school_year = SchoolYear.objects.create(
            name="2025/2026",
            location=self.location,
            start_date="2025-09-01",
            end_date="2026-06-30",
        )
        self.group = Group.objects.create(
            name="Testgruppe",
            location=self.location,
            school_year=self.school_year,
            leader=self.educator,
            balance=Decimal("100.00"),
        )
        GroupMember.objects.create(
            group=self.group, user=self.educator, role="leader"
        )


class SchoolYearAPITest(GroupsAPITestBase):
    """Tests for SchoolYear CRUD."""

    def test_list_school_years(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/groups/school-years/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_create_school_year_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/groups/school-years/",
            {
                "name": "2026/2027",
                "start_date": "2026-09-01",
                "end_date": "2027-06-30",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_school_year_as_manager(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/v1/groups/school-years/",
            {
                "name": "2026/2027",
                "start_date": "2026-09-01",
                "end_date": "2027-06-30",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_update_school_year(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(
            f"/api/v1/groups/school-years/{self.school_year.id}/",
            {"name": "2025/2026 (aktualisiert)"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)

    def test_delete_school_year_soft_delete(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.delete(
            f"/api/v1/groups/school-years/{self.school_year.id}/"
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.school_year.refresh_from_db()
        self.assertTrue(self.school_year.is_deleted)


class GroupAPITest(GroupsAPITestBase):
    """Tests for Group CRUD and member management."""

    def test_list_groups_educator_sees_own(self):
        # Create another group without educator as member
        Group.objects.create(
            name="Andere Gruppe",
            location=self.location,
            school_year=self.school_year,
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/groups/groups/")
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["name"], "Testgruppe")

    def test_manager_sees_all_location_groups(self):
        Group.objects.create(
            name="Andere Gruppe",
            location=self.location,
            school_year=self.school_year,
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get("/api/v1/groups/groups/")
        self.assertEqual(resp.data["count"], 2)

    def test_create_group_as_manager(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/v1/groups/groups/",
            {
                "name": "Neue Gruppe",
                "school_year": self.school_year.id,
                "description": "Testbeschreibung",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_create_group_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/groups/groups/",
            {
                "name": "Neue Gruppe",
                "school_year": self.school_year.id,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_retrieve_group_detail(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(f"/api/v1/groups/groups/{self.group.id}/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["name"], "Testgruppe")

    def test_list_group_members_as_manager(self):
        """Members endpoint uses the group's get_permissions which requires
        LocationManagerOrAbove for non-list/retrieve actions. The list_members
        action is a detail action that inherits the ViewSet's permissions."""
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(
            f"/api/v1/groups/groups/{self.group.id}/members/"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)

    def test_add_group_member(self):
        new_user = User.objects.create_user(
            username="new_educator",
            password="TestPass123!",
            role="educator",
            location=self.location,
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/v1/groups/groups/{self.group.id}/members/add/",
            {"user": new_user.id, "role": "educator"},
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(GroupMember.objects.filter(group=self.group).count(), 2)

    def test_remove_group_member(self):
        new_user = User.objects.create_user(
            username="new_educator",
            password="TestPass123!",
            role="educator",
            location=self.location,
        )
        member = GroupMember.objects.create(
            group=self.group, user=new_user, role="member"
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.delete(
            f"/api/v1/groups/groups/{self.group.id}/members/{member.id}/"
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)

    def test_list_group_students_as_manager(self):
        Student.objects.create(
            first_name="Max",
            last_name="Mustermann",
            group=self.group,
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(
            f"/api/v1/groups/groups/{self.group.id}/students/"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)

    def test_filter_groups_by_school_year(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.get(
            "/api/v1/groups/groups/",
            {"school_year_id": self.school_year.id},
        )
        self.assertEqual(resp.data["count"], 1)


class StudentAPITest(GroupsAPITestBase):
    """Tests for Student CRUD."""

    def test_create_student(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/v1/groups/students/",
            {
                "first_name": "Max",
                "last_name": "Mustermann",
                "group": self.group.id,
                "date_of_birth": "2018-05-15",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)

    def test_list_students(self):
        Student.objects.create(
            first_name="Max",
            last_name="Mustermann",
            group=self.group,
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/groups/students/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_create_student_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/groups/students/",
            {
                "first_name": "Max",
                "last_name": "Mustermann",
                "group": self.group.id,
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_search_students_encrypted_fields_not_searchable(self):
        """Encrypted fields cannot be searched via SQL.

        With field-level encryption, first_name/last_name/email are stored
        as encrypted blobs. DRF SearchFilter cannot search them.
        A search query returns all results instead of filtered ones.
        """
        Student.objects.create(
            first_name="Max",
            last_name="Mustermann",
            group=self.group,
        )
        Student.objects.create(
            first_name="Anna",
            last_name="Schmidt",
            group=self.group,
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            "/api/v1/groups/students/", {"search": "Mustermann"}
        )
        # Search on encrypted fields returns all results (no SQL filtering)
        self.assertEqual(resp.data["count"], 2)

    def test_delete_student_soft_delete(self):
        student = Student.objects.create(
            first_name="Max",
            last_name="Mustermann",
            group=self.group,
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.delete(f"/api/v1/groups/students/{student.id}/")
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        student.refresh_from_db()
        self.assertTrue(student.is_deleted)

    def test_unauthenticated_access_denied(self):
        resp = self.client.get("/api/v1/groups/students/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)
