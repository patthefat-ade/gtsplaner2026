"""
Tests for Groups models: SchoolYear, Semester, Group, GroupMember, Student.
"""

import pytest
from datetime import date
from decimal import Decimal

from django.db import IntegrityError

from core.models import Organization, Location, User
from groups.models import Group, GroupMember, SchoolYear, Semester, Student


@pytest.fixture
def organization(db):
    return Organization.objects.create(
        name="Test Organisation GR",
        email="org@test.at",
        street="Teststr. 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def location(organization):
    return Location.objects.create(
        organization=organization,
        name="Test Standort GR",
        email="standort@test.at",
        street="Standortstr. 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def educator(location):
    return User.objects.create_user(
        username="educator_gr",
        email="educator_gr@test.at",
        password="testpass123",
        first_name="Lisa",
        last_name="Paedagogin",
        role=User.Role.EDUCATOR,
        location=location,
    )


@pytest.fixture
def educator2(location):
    return User.objects.create_user(
        username="educator_gr2",
        email="educator_gr2@test.at",
        password="testpass123",
        first_name="Maria",
        last_name="Assistenz",
        role=User.Role.EDUCATOR,
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
        name="Sonnenkinder",
        leader=educator,
    )


class TestSchoolYearModel:
    """Tests for SchoolYear model."""

    def test_create_school_year(self, school_year):
        assert school_year.name == "2025/2026"
        assert school_year.is_active is True
        assert school_year.start_date == date(2025, 9, 1)
        assert school_year.end_date == date(2026, 7, 31)

    def test_school_year_str(self, school_year):
        result = str(school_year)
        assert "2025/2026" in result
        assert "aktiv" in result

    def test_unique_together(self, location, school_year):
        """Same name + location should fail."""
        with pytest.raises(IntegrityError):
            SchoolYear.objects.create(
                location=location,
                name="2025/2026",
                start_date=date(2025, 9, 1),
                end_date=date(2026, 7, 31),
            )

    def test_multiple_school_years(self, location):
        sy1 = SchoolYear.objects.create(
            location=location,
            name="2024/2025",
            start_date=date(2024, 9, 1),
            end_date=date(2025, 7, 31),
        )
        sy2 = SchoolYear.objects.create(
            location=location,
            name="2025/2026",
            start_date=date(2025, 9, 1),
            end_date=date(2026, 7, 31),
            is_active=True,
        )
        assert SchoolYear.objects.filter(location=location).count() == 2


class TestSemesterModel:
    """Tests for Semester model."""

    def test_create_semester(self, school_year):
        sem = Semester.objects.create(
            school_year=school_year,
            name=Semester.SemesterType.AUTUMN,
            start_date=date(2025, 9, 1),
            end_date=date(2026, 1, 31),
            is_active=True,
        )
        assert sem.name == "autumn"
        assert sem.is_active is True

    def test_semester_str(self, school_year):
        sem = Semester.objects.create(
            school_year=school_year,
            name=Semester.SemesterType.SPRING,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 7, 31),
        )
        result = str(sem)
        assert "Fruehling" in result or "spring" in result.lower()

    def test_two_semesters_per_year(self, school_year):
        Semester.objects.create(
            school_year=school_year,
            name=Semester.SemesterType.AUTUMN,
            start_date=date(2025, 9, 1),
            end_date=date(2026, 1, 31),
        )
        Semester.objects.create(
            school_year=school_year,
            name=Semester.SemesterType.SPRING,
            start_date=date(2026, 2, 1),
            end_date=date(2026, 7, 31),
        )
        assert school_year.semesters.count() == 2


class TestGroupModel:
    """Tests for Group model."""

    def test_create_group(self, group):
        assert group.name == "Sonnenkinder"
        assert group.balance == Decimal("0")
        assert group.currency == "EUR"
        assert group.is_active is True

    def test_group_str(self, group):
        result = str(group)
        assert "Sonnenkinder" in result
        assert "2025/2026" in result

    def test_unique_together(self, location, school_year, group):
        """Same name + location + school_year should fail."""
        with pytest.raises(IntegrityError):
            Group.objects.create(
                location=location,
                school_year=school_year,
                name="Sonnenkinder",
            )

    def test_group_balance(self, group):
        group.balance = Decimal("150.75")
        group.save()
        group.refresh_from_db()
        assert group.balance == Decimal("150.75")

    def test_group_without_leader(self, location, school_year):
        group = Group.objects.create(
            location=location,
            school_year=school_year,
            name="Ohne Leitung",
        )
        assert group.leader is None


class TestGroupMemberModel:
    """Tests for GroupMember model."""

    def test_add_member(self, group, educator):
        member = GroupMember.objects.create(
            group=group,
            user=educator,
            role=GroupMember.MemberRole.EDUCATOR,
        )
        assert member.role == "educator"
        assert member.is_active is True
        assert member.joined_at is not None

    def test_member_str(self, group, educator):
        member = GroupMember.objects.create(
            group=group,
            user=educator,
        )
        result = str(member)
        assert "Lisa Paedagogin" in result
        assert "Sonnenkinder" in result

    def test_unique_together(self, group, educator):
        """Same user + group should fail."""
        GroupMember.objects.create(group=group, user=educator)
        with pytest.raises(IntegrityError):
            GroupMember.objects.create(group=group, user=educator)

    def test_multiple_members(self, group, educator, educator2):
        GroupMember.objects.create(
            group=group,
            user=educator,
            role=GroupMember.MemberRole.EDUCATOR,
        )
        GroupMember.objects.create(
            group=group,
            user=educator2,
            role=GroupMember.MemberRole.ASSISTANT,
        )
        assert group.members.count() == 2

    def test_member_roles(self, group, educator):
        member = GroupMember.objects.create(
            group=group,
            user=educator,
            role=GroupMember.MemberRole.SUBSTITUTE,
        )
        assert member.role == "substitute"
        assert member.get_role_display() == "Vertretung"


class TestStudentModel:
    """Tests for Student model."""

    def test_create_student(self, group):
        student = Student.objects.create(
            group=group,
            first_name="Max",
            last_name="Musterkind",
            date_of_birth=date(2020, 5, 15),
        )
        assert student.first_name == "Max"
        assert student.last_name == "Musterkind"
        assert student.is_active is True

    def test_student_str(self, group):
        student = Student.objects.create(
            group=group,
            first_name="Anna",
            last_name="Kind",
        )
        assert str(student) == "Kind, Anna"

    def test_student_full_name(self, group):
        student = Student.objects.create(
            group=group,
            first_name="Anna",
            last_name="Kind",
        )
        assert student.full_name == "Anna Kind"

    def test_student_with_contact(self, group):
        student = Student.objects.create(
            group=group,
            first_name="Max",
            last_name="Musterkind",
            email="eltern@test.at",
            phone="+43 664 1234567",
            street="Kinderstr. 1",
            city="Wien",
            postal_code="1010",
        )
        assert student.email == "eltern@test.at"
        assert student.phone == "+43 664 1234567"

    def test_multiple_students_per_group(self, group):
        for i in range(5):
            Student.objects.create(
                group=group,
                first_name=f"Kind{i}",
                last_name=f"Test{i}",
            )
        assert group.students.count() == 5

    def test_student_soft_delete(self, group):
        student = Student.objects.create(
            group=group,
            first_name="Geloescht",
            last_name="Kind",
        )
        student.is_deleted = True
        student.is_active = False
        student.save()
        student.refresh_from_db()
        assert student.is_deleted is True
        assert student.is_active is False
