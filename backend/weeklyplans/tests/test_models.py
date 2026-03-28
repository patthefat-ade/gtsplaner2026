"""
Model tests for WeeklyPlans: WeeklyPlan, WeeklyPlanEntry, DailyActivity.
"""

import datetime

from django.test import TestCase

from core.models import Location, Organization, User
from groups.models import Group, SchoolYear
from weeklyplans.models import DailyActivity, WeeklyPlan, WeeklyPlanEntry


class WeeklyPlanModelTestBase(TestCase):
    """Base class with shared setup for weekly plan model tests."""

    def setUp(self):
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


class WeeklyPlanModelTest(WeeklyPlanModelTestBase):
    """Tests for the WeeklyPlan model."""

    def test_create_weekly_plan(self):
        """Test creating a basic weekly plan."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Wochenplan KW 13",
            status="draft",
            created_by=self.educator,
            organization=self.org,
        )
        self.assertEqual(plan.title, "Wochenplan KW 13")
        self.assertEqual(plan.status, "draft")
        self.assertFalse(plan.is_template)
        self.assertFalse(plan.is_deleted)

    def test_calendar_week_property(self):
        """Test the calendar_week property returns correct ISO week."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Test KW",
            organization=self.org,
        )
        self.assertEqual(plan.calendar_week, 13)

    def test_calendar_week_none_when_no_date(self):
        """Test calendar_week returns None for templates without date."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            title="Template",
            is_template=True,
            organization=self.org,
        )
        self.assertIsNone(plan.calendar_week)

    def test_week_end_date_property(self):
        """Test the week_end_date property returns Friday."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),  # Monday
            title="Test",
            organization=self.org,
        )
        self.assertEqual(plan.week_end_date, datetime.date(2026, 3, 27))  # Friday

    def test_week_end_date_none_when_no_date(self):
        """Test week_end_date returns None for templates without date."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            title="Template",
            is_template=True,
            organization=self.org,
        )
        self.assertIsNone(plan.week_end_date)

    def test_str_with_date(self):
        """Test __str__ for plan with date."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Test",
            organization=self.org,
        )
        self.assertIn("KW 13", str(plan))
        self.assertIn("Testgruppe", str(plan))

    def test_str_template(self):
        """Test __str__ for template plan."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            title="Template",
            is_template=True,
            template_name="Standard GTS",
            organization=self.org,
        )
        self.assertIn("Vorlage", str(plan))
        self.assertIn("Standard GTS", str(plan))

    def test_weekly_theme_field(self):
        """Test that weekly_theme field stores HTML content."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Test",
            weekly_theme="<p><strong>Frühling</strong> – Natur entdecken</p>",
            organization=self.org,
        )
        self.assertIn("<strong>Frühling</strong>", plan.weekly_theme)

    def test_soft_delete(self):
        """Test that is_deleted flag works correctly."""
        plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Test",
            organization=self.org,
        )
        plan.is_deleted = True
        plan.save()
        self.assertTrue(plan.is_deleted)
        # Soft-deleted plans should still exist in DB
        self.assertEqual(WeeklyPlan.objects.filter(id=plan.id).count(), 1)

    def test_ordering(self):
        """Test default ordering is by week_start_date descending."""
        plan1 = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 16),
            title="KW 12",
            organization=self.org,
        )
        plan2 = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="KW 13",
            organization=self.org,
        )
        plans = list(WeeklyPlan.objects.all())
        self.assertEqual(plans[0].id, plan2.id)
        self.assertEqual(plans[1].id, plan1.id)


class WeeklyPlanEntryModelTest(WeeklyPlanModelTestBase):
    """Tests for the WeeklyPlanEntry model."""

    def setUp(self):
        super().setUp()
        self.plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Test Plan",
            organization=self.org,
        )

    def test_create_entry(self):
        """Test creating a basic entry."""
        entry = WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            start_time="12:00",
            end_time="13:00",
            activity="Mittagessen",
            category="essen",
        )
        self.assertEqual(entry.activity, "Mittagessen")
        self.assertEqual(entry.day_of_week, 0)

    def test_auto_color_from_category(self):
        """Test that color is auto-set from category on save."""
        entry = WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            start_time="12:00",
            end_time="13:00",
            activity="Mittagessen",
            category="essen",
        )
        self.assertEqual(entry.color, "#F97316")

    def test_explicit_color_not_overridden(self):
        """Test that explicit color is not overridden by category."""
        entry = WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            start_time="12:00",
            end_time="13:00",
            activity="Test",
            category="essen",
            color="#FF0000",
        )
        self.assertEqual(entry.color, "#FF0000")

    def test_str_representation(self):
        """Test __str__ for entry."""
        entry = WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            start_time="12:00",
            end_time="13:00",
            activity="Mittagessen",
            category="essen",
        )
        self.assertIn("Montag", str(entry))
        self.assertIn("Mittagessen", str(entry))

    def test_ordering(self):
        """Test default ordering by day_of_week, start_time."""
        entry2 = WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=1,
            start_time="12:00",
            end_time="13:00",
            activity="Dienstag",
            category="sonstiges",
        )
        entry1 = WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            start_time="12:00",
            end_time="13:00",
            activity="Montag",
            category="sonstiges",
        )
        entries = list(self.plan.entries.all())
        self.assertEqual(entries[0].id, entry1.id)
        self.assertEqual(entries[1].id, entry2.id)

    def test_cascade_delete(self):
        """Test that entries are deleted when plan is deleted."""
        WeeklyPlanEntry.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            start_time="12:00",
            end_time="13:00",
            activity="Test",
            category="sonstiges",
        )
        self.assertEqual(WeeklyPlanEntry.objects.count(), 1)
        self.plan.delete()
        self.assertEqual(WeeklyPlanEntry.objects.count(), 0)


class DailyActivityModelTest(WeeklyPlanModelTestBase):
    """Tests for the DailyActivity model."""

    def setUp(self):
        super().setUp()
        self.plan = WeeklyPlan.objects.create(
            group=self.group,
            week_start_date=datetime.date(2026, 3, 23),
            title="Test Plan",
            organization=self.org,
        )

    def test_create_daily_activity(self):
        """Test creating a daily activity."""
        da = DailyActivity.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            content="<p>Basteln mit Naturmaterialien</p>",
        )
        self.assertEqual(da.day_of_week, 0)
        self.assertIn("Basteln", da.content)

    def test_unique_together(self):
        """Test that only one activity per day per plan is allowed."""
        DailyActivity.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            content="Erste Aktivität",
        )
        with self.assertRaises(Exception):
            DailyActivity.objects.create(
                weekly_plan=self.plan,
                day_of_week=0,
                content="Zweite Aktivität",
            )

    def test_str_representation(self):
        """Test __str__ for daily activity."""
        da = DailyActivity.objects.create(
            weekly_plan=self.plan,
            day_of_week=2,
            content="Mittwoch Aktivität",
        )
        self.assertIn("Mittwoch", str(da))

    def test_cascade_delete(self):
        """Test that daily activities are deleted when plan is deleted."""
        DailyActivity.objects.create(
            weekly_plan=self.plan,
            day_of_week=0,
            content="Test",
        )
        self.assertEqual(DailyActivity.objects.count(), 1)
        self.plan.delete()
        self.assertEqual(DailyActivity.objects.count(), 0)
