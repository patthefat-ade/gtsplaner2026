"""
WeeklyPlans API views.
Provides CRUD operations for weekly plans with tenant-based isolation,
template management, duplication, and PDF export.
"""

import datetime

from django.db.models import Q
from django.http import HttpResponse
from django.template.loader import render_to_string
from django_filters import rest_framework as django_filters
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from core.mixins_export import ExportMixin
from core.permissions import (
    GROUP_HIERARCHY,
    GROUP_LOCATION_MANAGER,
    IsEducator,
    get_user_hierarchy_level,
    require_permission,
)
from weeklyplans.models import DailyActivity, WeeklyPlan, WeeklyPlanEntry
from weeklyplans.serializers import (
    WeeklyPlanCreateUpdateSerializer,
    WeeklyPlanDetailSerializer,
    WeeklyPlanListSerializer,
)


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------
class WeeklyPlanFilter(django_filters.FilterSet):
    """Filter for weekly plans."""

    group = django_filters.NumberFilter(field_name="group_id")
    location = django_filters.NumberFilter(field_name="group__location_id")
    week_start_date = django_filters.DateFilter(field_name="week_start_date")
    week_start_date_gte = django_filters.DateFilter(
        field_name="week_start_date", lookup_expr="gte"
    )
    week_start_date_lte = django_filters.DateFilter(
        field_name="week_start_date", lookup_expr="lte"
    )
    is_template = django_filters.BooleanFilter(field_name="is_template")
    status = django_filters.CharFilter(field_name="status")

    class Meta:
        model = WeeklyPlan
        fields = [
            "group",
            "location",
            "week_start_date",
            "is_template",
            "status",
        ]


# ---------------------------------------------------------------------------
# WeeklyPlan ViewSet
# ---------------------------------------------------------------------------
class WeeklyPlanViewSet(ExportMixin, TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for weekly plans with tenant isolation and role-based visibility.

    - Educators: own group plans only
    - LocationManager: all plans for their location
    - Admin/SuperAdmin: full access within tenant
    """

    queryset = WeeklyPlan.objects.filter(is_deleted=False)
    filterset_class = WeeklyPlanFilter
    search_fields = ["title", "template_name", "group__name"]
    ordering_fields = ["week_start_date", "created_at", "title"]
    ordering = ["-week_start_date", "-created_at"]

    # Export-Konfiguration
    export_fields = [
        {"key": "id", "label": "ID", "width": 8},
        {"key": "group.name", "label": "Gruppe", "width": 20},
        {"key": "week_start_date", "label": "Wochenbeginn", "width": 14},
        {"key": "calendar_week", "label": "KW", "width": 6},
        {"key": "title", "label": "Titel", "width": 25},
        {"key": "weekly_theme", "label": "Wochenthema", "width": 30},
        {"key": "status", "label": "Status", "width": 12},
        {"key": "is_template", "label": "Vorlage", "width": 10},
        {"key": "created_by.get_full_name", "label": "Erstellt von", "width": 18},
        {"key": "created_at", "label": "Erstellt am", "width": 14},
    ]
    export_filename = "wochenplaene"
    export_title = "Wochenpl\u00e4ne"

    def get_row_data(self, obj, fields):
        """Override to handle status display and boolean values."""
        row = super().get_row_data(obj, fields)
        status_map = {"draft": "Entwurf", "published": "Ver\u00f6ffentlicht"}
        for i, field in enumerate(fields):
            if field["key"] == "status":
                row[i] = status_map.get(row[i], row[i])
            elif field["key"] == "is_template":
                row[i] = "Ja" if row[i] else "Nein"
            elif field["key"] == "weekly_theme" and row[i]:
                # Strip HTML tags for export
                import re
                row[i] = re.sub(r"<[^>]+>", "", str(row[i])).strip()
        return row

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return WeeklyPlan.objects.none()

        qs = super().get_queryset()
        qs = qs.select_related("group", "group__location", "created_by")

        user = self.request.user
        level = get_user_hierarchy_level(user)

        if level >= GROUP_HIERARCHY[GROUP_LOCATION_MANAGER]:
            return qs

        # Educators: only plans for their groups
        return qs.filter(
            Q(group__members__user=user) | Q(group__leader=user) | Q(created_by=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return WeeklyPlanCreateUpdateSerializer
        if self.action == "retrieve":
            return WeeklyPlanDetailSerializer
        return WeeklyPlanListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "templates", "pdf"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsEducator()]

    def perform_destroy(self, instance):
        """Soft-delete: mark as deleted instead of removing from DB."""
        instance.is_deleted = True
        instance.save(update_fields=["is_deleted", "updated_at"])

    # ----- Custom Actions -----

    @action(detail=False, methods=["get"], url_path="templates")
    def templates(self, request):
        """List only template plans."""
        qs = self.get_queryset().filter(is_template=True)
        qs = self.filter_queryset(qs)
        serializer = WeeklyPlanListSerializer(qs, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="duplicate")
    def duplicate(self, request, pk=None):
        """
        Duplicate a weekly plan for a new week.
        Expects: { "week_start_date": "2026-04-06", "group": 5 (optional) }
        """
        source = self.get_object()
        new_date = request.data.get("week_start_date")
        new_group = request.data.get("group", source.group_id)

        if not new_date:
            return Response(
                {"detail": "week_start_date ist erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_plan = WeeklyPlan.objects.create(
            group_id=new_group,
            week_start_date=new_date,
            title=source.title,
            notes=source.notes,
            is_template=False,
            status="draft",
            created_by=request.user,
            organization=source.organization,
        )

        for entry in source.entries.all():
            WeeklyPlanEntry.objects.create(
                weekly_plan=new_plan,
                day_of_week=entry.day_of_week,
                start_time=entry.start_time,
                end_time=entry.end_time,
                activity=entry.activity,
                description=entry.description,
                color=entry.color,
                category=entry.category,
                sort_order=entry.sort_order,
            )

        serializer = WeeklyPlanDetailSerializer(new_plan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="duplicate-entry")
    def duplicate_entry(self, request, pk=None):
        """
        Duplicate a single entry within the same weekly plan to a different day.
        Expects: { "entry_id": <int>, "target_day": <int 0-4> }
        """
        plan = self.get_object()
        entry_id = request.data.get("entry_id")
        target_day = request.data.get("target_day")

        if entry_id is None or target_day is None:
            return Response(
                {"detail": "entry_id und target_day sind erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            target_day = int(target_day)
        except (ValueError, TypeError):
            return Response(
                {"detail": "target_day muss eine Zahl zwischen 0 und 4 sein."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if target_day not in range(5):
            return Response(
                {"detail": "target_day muss zwischen 0 (Montag) und 4 (Freitag) liegen."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            source_entry = plan.entries.get(id=entry_id)
        except WeeklyPlanEntry.DoesNotExist:
            return Response(
                {"detail": "Eintrag nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        new_entry = WeeklyPlanEntry.objects.create(
            weekly_plan=plan,
            day_of_week=target_day,
            start_time=source_entry.start_time,
            end_time=source_entry.end_time,
            activity=source_entry.activity,
            description=source_entry.description,
            color=source_entry.color,
            category=source_entry.category,
            sort_order=source_entry.sort_order,
        )

        serializer = WeeklyPlanDetailSerializer(plan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["post"], url_path="create-from-template")
    def create_from_template(self, request, pk=None):
        """
        Create a new plan from a template.
        Expects: { "week_start_date": "2026-04-06", "group": 5 }
        """
        template = self.get_object()
        if not template.is_template:
            return Response(
                {"detail": "Dieser Plan ist keine Vorlage."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_date = request.data.get("week_start_date")
        group_id = request.data.get("group")

        if not new_date or not group_id:
            return Response(
                {"detail": "week_start_date und group sind erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        new_plan = WeeklyPlan.objects.create(
            group_id=group_id,
            week_start_date=new_date,
            title=f"Aus Vorlage: {template.template_name}",
            is_template=False,
            status="draft",
            created_by=request.user,
            organization=template.organization,
        )

        for entry in template.entries.all():
            WeeklyPlanEntry.objects.create(
                weekly_plan=new_plan,
                day_of_week=entry.day_of_week,
                start_time=entry.start_time,
                end_time=entry.end_time,
                activity=entry.activity,
                description=entry.description,
                color=entry.color,
                category=entry.category,
                sort_order=entry.sort_order,
            )

        serializer = WeeklyPlanDetailSerializer(new_plan)
        return Response(serializer.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=["get"], url_path="pdf")
    def pdf(self, request, pk=None):
        """
        Generate a PDF of the weekly plan in landscape format.
        Returns the PDF as a downloadable file.
        """
        plan = self.get_object()
        entries = plan.entries.all().order_by("day_of_week", "start_time")

        # Build grid data: rows = time slots, columns = days
        time_slots = set()
        for entry in entries:
            time_slots.add((entry.start_time, entry.end_time))
        time_slots = sorted(time_slots, key=lambda x: x[0])

        days = [
            (0, "Montag"),
            (1, "Dienstag"),
            (2, "Mittwoch"),
            (3, "Donnerstag"),
            (4, "Freitag"),
        ]

        grid = []
        for start, end in time_slots:
            row = {
                "time": f"{start.strftime('%H:%M')} - {end.strftime('%H:%M')}",
                "cells": [],
            }
            for day_num, day_name in days:
                cell_entries = [
                    e
                    for e in entries
                    if e.day_of_week == day_num
                    and e.start_time == start
                    and e.end_time == end
                ]
                if cell_entries:
                    e = cell_entries[0]
                    row["cells"].append(
                        {
                            "activity": e.activity,
                            "description": e.description,
                            "color": e.color or "#78716C",
                            "category": e.get_category_display(),
                        }
                    )
                else:
                    row["cells"].append(None)
            grid.append(row)

        # Calculate week dates
        week_dates = []
        if plan.week_start_date:
            for i in range(5):
                d = plan.week_start_date + datetime.timedelta(days=i)
                week_dates.append(d.strftime("%d.%m."))
        else:
            week_dates = ["", "", "", "", ""]

        # Daily activities
        daily_activities = {}
        for da in plan.daily_activities.all().order_by("day_of_week"):
            daily_activities[da.day_of_week] = da.content

        # Leader name
        leader_name = ""
        if plan.group and hasattr(plan.group, "leader") and plan.group.leader:
            leader = plan.group.leader
            leader_name = f"{leader.first_name} {leader.last_name}".strip()

        # School year
        school_year_name = str(plan.school_year) if plan.school_year else "2025/2026"

        # Logo as base64
        import base64
        import os
        logo_path = os.path.join(
            os.path.dirname(__file__),
            "templates", "weeklyplans", "hilfswerk_logo.jpg"
        )
        logo_base64 = ""
        if os.path.exists(logo_path):
            with open(logo_path, "rb") as f:
                logo_base64 = base64.b64encode(f.read()).decode()

        # Week end date
        week_end_date = ""
        if plan.week_start_date:
            week_end_date = (plan.week_start_date + datetime.timedelta(days=4)).strftime("%d.%m.%Y")

        # Build ordered list for template (Mon-Fri)
        daily_activities_list = [
            daily_activities.get(i, "") for i in range(5)
        ]
        has_daily_activities = any(daily_activities_list)

        context = {
            "plan": plan,
            "grid": grid,
            "days": days,
            "week_dates": week_dates,
            "calendar_week": plan.calendar_week or "",
            "daily_activities_list": daily_activities_list if has_daily_activities else None,
            "leader_name": leader_name,
            "school_year_name": school_year_name,
            "logo_base64": logo_base64,
            "week_end_date": week_end_date,
        }

        html_string = render_to_string(
            "weeklyplans/pdf_template.html", context
        )

        try:
            from weasyprint import HTML

            pdf_bytes = HTML(string=html_string).write_pdf()
        except ImportError:
            # Fallback: return HTML
            return HttpResponse(html_string, content_type="text/html")

        group_name = plan.group.name if plan.group else "Vorlage"
        kw = plan.calendar_week or "X"
        filename = f"Wochenplan_{group_name}_KW{kw}.pdf"

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
