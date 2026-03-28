"""
API tests for WeeklyPlans endpoints.
Tests CRUD operations, duplication, entry duplication, templates, and RBAC.
"""

import datetime

from django.test import TestCase
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from groups.models import Group, SchoolYear
from weeklyplans.models import DailyActivity, WeeklyPlan, WeeklyPlanEntry


class WeeklyPlanAPITestBase(TestCase):
    """Base class with shared setup for weekly plan API tests."""

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
        )
        self.base_url = "/api/v1/weeklyplans/"

    def create_plan(self, **kwargs):
        """Helper to create a weekly plan."""
        defaults = {
            "group": self.group,
            "week_start_date": datetime.date(2026, 3, 23),
            "title": "Wochenplan KW 13",
            "status": "draft",
            "created_by": self.educator,
            "organization": self.org,
        }
        defaults.update(kwargs)
        return WeeklyPlan.objects.create(**defaults)

    def create_entry(self, plan, **kwargs):
        """Helper to create a weekly plan entry."""
        defaults = {
            "weekly_plan": plan,
            "day_of_week": 0,
            "start_time": "12:00",
            "end_time": "13:00",
            "activity": "Mittagessen",
            "category": "essen",
            "sort_order": 0,
        }
        defaults.update(kwargs)
        return WeeklyPlanEntry.objects.create(**defaults)


class WeeklyPlanListTest(WeeklyPlanAPITestBase):
    """Tests for GET /api/weeklyplans/."""

    def test_unauthenticated_returns_401(self):
        """Unauthenticated requests should be rejected."""
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_educator_sees_own_group_plans(self):
        """Educator should see plans for their groups."""
        self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_list_contains_calendar_week(self):
        """List response should include calendar_week."""
        self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url)
        self.assertEqual(response.data["results"][0]["calendar_week"], 13)

    def test_list_contains_week_end_date(self):
        """List response should include week_end_date."""
        self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url)
        self.assertEqual(response.data["results"][0]["week_end_date"], "2026-03-27")

    def test_filter_by_status(self):
        """Filter by status should work."""
        self.create_plan(status="draft")
        self.create_plan(
            status="published",
            week_start_date=datetime.date(2026, 3, 30),
            title="Published Plan",
        )
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url, {"status": "published"})
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(response.data["results"][0]["status"], "published")

    def test_filter_by_group(self):
        """Filter by group should work."""
        self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url, {"group": self.group.id})
        self.assertEqual(response.data["count"], 1)

    def test_filter_by_is_template(self):
        """Filter by is_template should work."""
        self.create_plan(is_template=False)
        self.create_plan(
            is_template=True,
            template_name="Standard",
            title="Template",
            week_start_date=None,
        )
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url, {"is_template": "false"})
        self.assertEqual(response.data["count"], 1)

    def test_search_by_title(self):
        """Search by title should work."""
        self.create_plan(title="Spezialwoche Frühling")
        self.create_plan(
            title="Normal",
            week_start_date=datetime.date(2026, 3, 30),
        )
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url, {"search": "Frühling"})
        self.assertEqual(response.data["count"], 1)

    def test_manager_sees_all_location_plans(self):
        """Location manager should see all plans for their location."""
        self.create_plan()
        self.client.force_authenticate(user=self.manager)
        response = self.client.get(self.base_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["count"], 1)

    def test_soft_deleted_plans_hidden(self):
        """Soft-deleted plans should not appear in list."""
        plan = self.create_plan()
        plan.is_deleted = True
        plan.save()
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(self.base_url)
        self.assertEqual(response.data["count"], 0)


class WeeklyPlanDetailTest(WeeklyPlanAPITestBase):
    """Tests for GET /api/weeklyplans/{id}/."""

    def test_retrieve_plan_with_entries(self):
        """Retrieve should return plan with nested entries."""
        plan = self.create_plan()
        self.create_entry(plan)
        self.create_entry(plan, day_of_week=1, activity="Lernstunde")
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(f"{self.base_url}{plan.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["entries"]), 2)
        self.assertIn("calendar_week", response.data)
        self.assertIn("week_end_date", response.data)

    def test_retrieve_plan_with_daily_activities(self):
        """Retrieve should return plan with daily activities."""
        plan = self.create_plan()
        DailyActivity.objects.create(
            weekly_plan=plan,
            day_of_week=0,
            content="<p>Basteln</p>",
        )
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(f"{self.base_url}{plan.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data["daily_activities"]), 1)
        self.assertIn("Basteln", response.data["daily_activities"][0]["content"])

    def test_retrieve_plan_with_weekly_theme(self):
        """Retrieve should return plan with weekly_theme."""
        plan = self.create_plan(weekly_theme="<p>Frühling</p>")
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(f"{self.base_url}{plan.id}/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("Frühling", response.data["weekly_theme"])


class WeeklyPlanCreateTest(WeeklyPlanAPITestBase):
    """Tests for POST /api/weeklyplans/."""

    def test_create_plan_with_entries(self):
        """Create a plan with entries."""
        self.client.force_authenticate(user=self.educator)
        data = {
            "group": self.group.id,
            "week_start_date": "2026-04-06",
            "title": "Neue Woche",
            "status": "draft",
            "entries": [
                {
                    "day_of_week": 0,
                    "start_time": "12:00",
                    "end_time": "13:00",
                    "activity": "Mittagessen",
                    "category": "essen",
                    "sort_order": 0,
                },
                {
                    "day_of_week": 0,
                    "start_time": "13:00",
                    "end_time": "14:00",
                    "activity": "Lernstunde",
                    "category": "lernen",
                    "sort_order": 1,
                },
            ],
        }
        response = self.client.post(self.base_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plan = WeeklyPlan.objects.get(id=response.data["id"])
        self.assertEqual(plan.entries.count(), 2)

    def test_create_plan_without_entries_gets_defaults(self):
        """Create a plan without entries should generate default time slots."""
        self.client.force_authenticate(user=self.educator)
        data = {
            "group": self.group.id,
            "week_start_date": "2026-04-06",
            "title": "Default Slots",
            "status": "draft",
        }
        response = self.client.post(self.base_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plan = WeeklyPlan.objects.get(id=response.data["id"])
        # 5 default slots * 5 days = 25 entries
        self.assertEqual(plan.entries.count(), 25)

    def test_create_plan_with_daily_activities(self):
        """Create a plan with daily activities."""
        self.client.force_authenticate(user=self.educator)
        data = {
            "group": self.group.id,
            "week_start_date": "2026-04-06",
            "title": "Mit Tagesaktivitäten",
            "status": "draft",
            "entries": [
                {
                    "day_of_week": 0,
                    "start_time": "12:00",
                    "end_time": "13:00",
                    "activity": "Mittagessen",
                    "category": "essen",
                    "sort_order": 0,
                },
            ],
            "daily_activities": [
                {"day_of_week": 0, "content": "<p>Basteln</p>"},
                {"day_of_week": 1, "content": "<p>Sport</p>"},
            ],
        }
        response = self.client.post(self.base_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plan = WeeklyPlan.objects.get(id=response.data["id"])
        self.assertEqual(plan.daily_activities.count(), 2)

    def test_create_plan_with_weekly_theme(self):
        """Create a plan with weekly_theme."""
        self.client.force_authenticate(user=self.educator)
        data = {
            "group": self.group.id,
            "week_start_date": "2026-04-06",
            "title": "Themenwoche",
            "weekly_theme": "<p><strong>Frühling</strong></p>",
            "status": "draft",
            "entries": [],
        }
        response = self.client.post(self.base_url, data, format="json")
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        plan = WeeklyPlan.objects.get(id=response.data["id"])
        self.assertIn("Frühling", plan.weekly_theme)


class WeeklyPlanUpdateTest(WeeklyPlanAPITestBase):
    """Tests for PUT/PATCH /api/weeklyplans/{id}/."""

    def test_update_plan_title(self):
        """Update plan title via PATCH."""
        plan = self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f"{self.base_url}{plan.id}/",
            {"title": "Neuer Titel"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan.refresh_from_db()
        self.assertEqual(plan.title, "Neuer Titel")

    def test_update_plan_entries_replaces_all(self):
        """Update entries should replace all existing entries."""
        plan = self.create_plan()
        self.create_entry(plan)
        self.create_entry(plan, day_of_week=1, activity="Alt")
        self.assertEqual(plan.entries.count(), 2)

        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f"{self.base_url}{plan.id}/",
            {
                "entries": [
                    {
                        "day_of_week": 0,
                        "start_time": "12:00",
                        "end_time": "13:00",
                        "activity": "Nur ein Eintrag",
                        "category": "essen",
                        "sort_order": 0,
                    },
                ],
            },
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan.refresh_from_db()
        self.assertEqual(plan.entries.count(), 1)
        self.assertEqual(plan.entries.first().activity, "Nur ein Eintrag")

    def test_update_plan_status(self):
        """Update plan status to published."""
        plan = self.create_plan(status="draft")
        self.client.force_authenticate(user=self.educator)
        response = self.client.patch(
            f"{self.base_url}{plan.id}/",
            {"status": "published"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        plan.refresh_from_db()
        self.assertEqual(plan.status, "published")


class WeeklyPlanDeleteTest(WeeklyPlanAPITestBase):
    """Tests for DELETE /api/weeklyplans/{id}/."""

    def test_delete_is_soft_delete(self):
        """Delete should set is_deleted=True, not remove from DB."""
        plan = self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.delete(f"{self.base_url}{plan.id}/")
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        plan.refresh_from_db()
        self.assertTrue(plan.is_deleted)
        # Plan still exists in DB
        self.assertTrue(WeeklyPlan.objects.filter(id=plan.id).exists())


class WeeklyPlanDuplicateTest(WeeklyPlanAPITestBase):
    """Tests for POST /api/weeklyplans/{id}/duplicate/."""

    def test_duplicate_plan(self):
        """Duplicate a plan for a new week."""
        plan = self.create_plan()
        self.create_entry(plan)
        self.create_entry(plan, day_of_week=1, activity="Lernstunde")
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate/",
            {"week_start_date": "2026-03-30"},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_plan = WeeklyPlan.objects.get(id=response.data["id"])
        self.assertEqual(new_plan.week_start_date, datetime.date(2026, 3, 30))
        self.assertEqual(new_plan.entries.count(), 2)
        self.assertEqual(new_plan.status, "draft")

    def test_duplicate_without_date_returns_400(self):
        """Duplicate without week_start_date should return 400."""
        plan = self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate/",
            {},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class WeeklyPlanDuplicateEntryTest(WeeklyPlanAPITestBase):
    """Tests for POST /api/weeklyplans/{id}/duplicate-entry/."""

    def test_duplicate_entry_to_another_day(self):
        """Duplicate an entry to a different day."""
        plan = self.create_plan()
        entry = self.create_entry(plan, day_of_week=0, activity="Mittagessen")
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate-entry/",
            {"entry_id": entry.id, "target_day": 2},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(plan.entries.count(), 2)
        new_entry = plan.entries.exclude(id=entry.id).first()
        self.assertEqual(new_entry.day_of_week, 2)
        self.assertEqual(new_entry.activity, "Mittagessen")
        # Compare as string since entry fixture uses string, DB returns time
        self.assertEqual(str(new_entry.start_time)[:5], str(entry.start_time)[:5])
        self.assertEqual(str(new_entry.end_time)[:5], str(entry.end_time)[:5])

    def test_duplicate_entry_same_day(self):
        """Duplicate an entry to the same day should work."""
        plan = self.create_plan()
        entry = self.create_entry(plan, day_of_week=0)
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate-entry/",
            {"entry_id": entry.id, "target_day": 0},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(plan.entries.count(), 2)

    def test_duplicate_entry_missing_params(self):
        """Missing entry_id or target_day should return 400."""
        plan = self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate-entry/",
            {"entry_id": 999},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_entry_invalid_day(self):
        """Invalid target_day should return 400."""
        plan = self.create_plan()
        entry = self.create_entry(plan)
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate-entry/",
            {"entry_id": entry.id, "target_day": 7},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_duplicate_entry_not_found(self):
        """Non-existent entry_id should return 404."""
        plan = self.create_plan()
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/duplicate-entry/",
            {"entry_id": 99999, "target_day": 1},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class WeeklyPlanTemplateTest(WeeklyPlanAPITestBase):
    """Tests for template-related endpoints."""

    def test_list_templates(self):
        """GET /api/weeklyplans/templates/ should return only templates."""
        self.create_plan(is_template=False)
        self.create_plan(
            is_template=True,
            template_name="Standard GTS",
            title="Template",
        )
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(f"{self.base_url}templates/")
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertTrue(response.data[0]["is_template"])

    def test_create_from_template(self):
        """POST /api/weeklyplans/{id}/create-from-template/ should create a new plan."""
        template = self.create_plan(
            is_template=True,
            template_name="Standard",
            title="Template",
        )
        self.create_entry(template, activity="Template-Eintrag")
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{template.id}/create-from-template/",
            {"week_start_date": "2026-04-06", "group": self.group.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        new_plan = WeeklyPlan.objects.get(id=response.data["id"])
        self.assertFalse(new_plan.is_template)
        self.assertEqual(new_plan.entries.count(), 1)
        self.assertEqual(new_plan.entries.first().activity, "Template-Eintrag")

    def test_create_from_non_template_returns_400(self):
        """Creating from a non-template plan should return 400."""
        plan = self.create_plan(is_template=False)
        self.client.force_authenticate(user=self.educator)
        response = self.client.post(
            f"{self.base_url}{plan.id}/create-from-template/",
            {"week_start_date": "2026-04-06", "group": self.group.id},
            format="json",
        )
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class WeeklyPlanPDFTest(WeeklyPlanAPITestBase):
    """Tests for GET /api/weeklyplans/{id}/pdf/."""

    def test_pdf_export(self):
        """PDF export should return a response (HTML fallback or PDF)."""
        plan = self.create_plan()
        self.create_entry(plan)
        self.client.force_authenticate(user=self.educator)
        response = self.client.get(f"{self.base_url}{plan.id}/pdf/")
        self.assertIn(response.status_code, [status.HTTP_200_OK])
        # Should be either PDF or HTML
        self.assertIn(
            response["Content-Type"],
            ["application/pdf", "text/html; charset=utf-8"],
        )
