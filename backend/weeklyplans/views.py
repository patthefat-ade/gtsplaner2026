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
        Generate a PDF of the weekly plan in landscape format using reportlab.
        Returns the PDF as a downloadable file.
        """
        import os
        from io import BytesIO

        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm, mm
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont
        from reportlab.platypus import (
            Image,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )

        # Register DejaVu fonts for full Unicode/Umlaut support
        font_dir = os.path.join(os.path.dirname(__file__), "fonts")
        if os.path.exists(os.path.join(font_dir, "DejaVuSans.ttf")):
            if "DejaVuSans" not in pdfmetrics.getRegisteredFontNames():
                pdfmetrics.registerFont(
                    TTFont("DejaVuSans", os.path.join(font_dir, "DejaVuSans.ttf"))
                )
                pdfmetrics.registerFont(
                    TTFont("DejaVuSans-Bold", os.path.join(font_dir, "DejaVuSans-Bold.ttf"))
                )
            FONT_NAME = "DejaVuSans"
            FONT_BOLD = "DejaVuSans-Bold"
        else:
            FONT_NAME = "Helvetica"
            FONT_BOLD = "Helvetica-Bold"

        plan = self.get_object()
        entries = plan.entries.all().order_by("day_of_week", "start_time")

        # Build grid data
        time_slots = set()
        for entry in entries:
            time_slots.add((entry.start_time, entry.end_time))
        time_slots = sorted(time_slots, key=lambda x: x[0])

        day_names = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"]

        # Week dates
        week_dates = []
        if plan.week_start_date:
            for i in range(5):
                d = plan.week_start_date + datetime.timedelta(days=i)
                week_dates.append(d.strftime("%d.%m."))
        else:
            week_dates = [""] * 5

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

        # Week end date
        week_end_date = ""
        if plan.week_start_date:
            week_end_date = (
                plan.week_start_date + datetime.timedelta(days=4)
            ).strftime("%d.%m.%Y")

        # ── Build PDF ──────────────────────────────────────────────────
        buffer = BytesIO()
        doc = SimpleDocTemplate(
            buffer,
            pagesize=landscape(A4),
            leftMargin=1.2 * cm,
            rightMargin=1.2 * cm,
            topMargin=1 * cm,
            bottomMargin=1 * cm,
        )

        styles = getSampleStyleSheet()
        brand_yellow = colors.HexColor("#F5B800")
        brand_dark = colors.HexColor("#1e293b")
        brand_gray = colors.HexColor("#475569")

        style_title = ParagraphStyle(
            "PlanTitle",
            parent=styles["Heading1"],
            fontName=FONT_BOLD,
            fontSize=14,
            textColor=brand_dark,
            spaceAfter=2,
        )
        style_subtitle = ParagraphStyle(
            "PlanSubtitle",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=8,
            textColor=brand_gray,
        )
        style_meta = ParagraphStyle(
            "Meta",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=8,
            textColor=brand_gray,
        )
        style_cell = ParagraphStyle(
            "Cell",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=7,
            leading=9,
        )
        style_cell_bold = ParagraphStyle(
            "CellBold",
            parent=styles["Normal"],
            fontSize=7,
            leading=9,
            fontName=FONT_BOLD,
        )
        style_theme = ParagraphStyle(
            "Theme",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=8,
            textColor=colors.HexColor("#92400E"),
        )
        style_footer = ParagraphStyle(
            "Footer",
            parent=styles["Normal"],
            fontName=FONT_NAME,
            fontSize=6,
            textColor=colors.HexColor("#94a3b8"),
        )

        elements = []

        # ── Header ─────────────────────────────────────────────────────
        title_text = f"Wochenplan"
        if plan.title:
            title_text += f" – {plan.title}"
        subtitle_parts = ["Nachmittagsbetreuung"]
        if plan.group:
            subtitle_parts.append(plan.group.name)
        if plan.group and plan.group.location:
            subtitle_parts.append(plan.group.location.name)

        kw_text = f"KW {plan.calendar_week}" if plan.calendar_week else ""
        date_text = ""
        if plan.week_start_date:
            date_text = f"{plan.week_start_date.strftime('%d.%m.%Y')} – {week_end_date}"

        # Header as table
        header_left = [
            Paragraph(title_text, style_title),
            Paragraph(" – ".join(subtitle_parts), style_subtitle),
        ]

        header_right_parts = []
        if kw_text:
            header_right_parts.append(
                Paragraph(f"<b>{kw_text}</b>", style_meta)
            )
        if date_text:
            header_right_parts.append(Paragraph(date_text, style_meta))
        header_right_parts.append(
            Paragraph(f"Schuljahr: <b>{school_year_name}</b>", style_meta)
        )

        # Logo
        logo_path = os.path.join(
            os.path.dirname(__file__),
            "templates", "weeklyplans", "hilfswerk_logo.jpg",
        )
        if os.path.exists(logo_path):
            logo = Image(logo_path, width=45, height=45)
            header_data = [[logo] + header_left + header_right_parts]
        else:
            header_data = [header_left + header_right_parts]

        # Simple header: left content + right content
        header_data = [
            [
                Paragraph(title_text, style_title),
                Paragraph(" – ".join(subtitle_parts), style_subtitle),
                Paragraph(
                    f"{'<b>' + kw_text + '</b><br/>' if kw_text else ''}"
                    f"{date_text + '<br/>' if date_text else ''}"
                    f"Schuljahr: <b>{school_year_name}</b>",
                    style_meta,
                ),
            ]
        ]
        header_table = Table(
            header_data,
            colWidths=[12 * cm, 10 * cm, 6 * cm],
        )
        header_table.setStyle(
            TableStyle(
                [
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("ALIGN", (-1, 0), (-1, -1), "RIGHT"),
                    ("LINEBELOW", (0, 0), (-1, 0), 2, brand_yellow),
                    ("BOTTOMPADDING", (0, 0), (-1, 0), 6),
                ]
            )
        )
        elements.append(header_table)
        elements.append(Spacer(1, 4 * mm))

        # ── Meta row ───────────────────────────────────────────────────
        meta_parts = []
        if plan.group and plan.group.location:
            meta_parts.append(f"Standort: <b>{plan.group.location.name}</b>")
        if plan.group:
            meta_parts.append(f"Gruppe: <b>{plan.group.name}</b>")
        if leader_name:
            meta_parts.append(f"Gruppenleiter/in: <b>{leader_name}</b>")
        if meta_parts:
            meta_data = [[Paragraph(p, style_meta) for p in meta_parts]]
            meta_table = Table(meta_data)
            meta_table.setStyle(
                TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP")])
            )
            elements.append(meta_table)
            elements.append(Spacer(1, 3 * mm))

        # ── Weekly Theme ───────────────────────────────────────────────
        if plan.weekly_theme:
            theme_data = [
                [
                    Paragraph(
                        f"<b>Thema der Woche:</b> {plan.weekly_theme}",
                        style_theme,
                    )
                ]
            ]
            theme_table = Table(theme_data, colWidths=[26 * cm])
            theme_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#FFF9E6")),
                        ("BOX", (0, 0), (-1, -1), 0.5, brand_yellow),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                        ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ]
                )
            )
            elements.append(theme_table)
            elements.append(Spacer(1, 4 * mm))

        # ── Plan Grid Table ────────────────────────────────────────────
        # Header row
        grid_header = [Paragraph("<b>Uhrzeit</b>", style_cell_bold)]
        for i, name in enumerate(day_names):
            date_str = f"<br/>{week_dates[i]}" if week_dates[i] else ""
            grid_header.append(
                Paragraph(f"<b>{name}</b>{date_str}", style_cell_bold)
            )

        grid_data = [grid_header]

        for start, end in time_slots:
            row = [
                Paragraph(
                    f"{start.strftime('%H:%M')}<br/>{end.strftime('%H:%M')}",
                    style_cell,
                )
            ]
            for day_num in range(5):
                cell_entries = [
                    e
                    for e in entries
                    if e.day_of_week == day_num
                    and e.start_time == start
                    and e.end_time == end
                ]
                if cell_entries:
                    e = cell_entries[0]
                    cell_text = f"<b>{e.activity}</b>"
                    if e.description:
                        cell_text += f"<br/>{e.description}"
                    row.append(Paragraph(cell_text, style_cell))
                else:
                    row.append(Paragraph("", style_cell))
            grid_data.append(row)

        col_widths = [2.5 * cm] + [4.7 * cm] * 5
        grid_table = Table(grid_data, colWidths=col_widths, repeatRows=1)

        grid_style = [
            # Header
            ("BACKGROUND", (0, 0), (0, 0), colors.HexColor("#f1f5f9")),
            ("BACKGROUND", (1, 0), (-1, 0), brand_yellow),
            ("TEXTCOLOR", (1, 0), (-1, 0), colors.black),
            ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
            ("FONTSIZE", (0, 0), (-1, 0), 7),
            ("ALIGN", (0, 0), (-1, 0), "CENTER"),
            # Time column
            ("BACKGROUND", (0, 1), (0, -1), colors.HexColor("#f8fafc")),
            ("ALIGN", (0, 0), (0, -1), "CENTER"),
            ("VALIGN", (0, 0), (0, -1), "MIDDLE"),
            # Grid
            ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING", (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ]

        # Empty cells background
        for row_idx, (start, end) in enumerate(time_slots, start=1):
            for col_idx in range(5):
                cell_entries = [
                    e
                    for e in entries
                    if e.day_of_week == col_idx
                    and e.start_time == start
                    and e.end_time == end
                ]
                if not cell_entries:
                    grid_style.append(
                        (
                            "BACKGROUND",
                            (col_idx + 1, row_idx),
                            (col_idx + 1, row_idx),
                            colors.HexColor("#fafafa"),
                        )
                    )

        grid_table.setStyle(TableStyle(grid_style))
        elements.append(grid_table)
        elements.append(Spacer(1, 4 * mm))

        # ── Daily Activities ───────────────────────────────────────────
        daily_activities_list = [
            daily_activities.get(i, "") for i in range(5)
        ]
        if any(daily_activities_list):
            elements.append(
                Paragraph(
                    "<b>Tagesaktivitaeten (passend zum Thema)</b>",
                    style_theme,
                )
            )
            elements.append(Spacer(1, 2 * mm))

            da_header = [
                Paragraph(f"<b>{name}</b>", style_cell_bold)
                for name in day_names
            ]
            da_row = [
                Paragraph(da or "", style_cell)
                for da in daily_activities_list
            ]
            da_table = Table(
                [da_header, da_row],
                colWidths=[5.2 * cm] * 5,
                repeatRows=1,
            )
            da_table.setStyle(
                TableStyle(
                    [
                        ("BACKGROUND", (0, 0), (-1, 0), brand_yellow),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.black),
                        ("FONTNAME", (0, 0), (-1, 0), FONT_BOLD),
                        ("FONTSIZE", (0, 0), (-1, -1), 7),
                        ("ALIGN", (0, 0), (-1, 0), "CENTER"),
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("TOPPADDING", (0, 0), (-1, -1), 3),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                        ("LEFTPADDING", (0, 0), (-1, -1), 4),
                    ]
                )
            )
            elements.append(da_table)
            elements.append(Spacer(1, 4 * mm))

        # ── Notes ──────────────────────────────────────────────────────
        if plan.notes:
            elements.append(
                Paragraph(
                    f"<b>Anmerkungen:</b> {plan.notes}",
                    style_cell,
                )
            )
            elements.append(Spacer(1, 3 * mm))

        # ── Footer ─────────────────────────────────────────────────────
        creator = ""
        if plan.created_by:
            creator = f"{plan.created_by.first_name} {plan.created_by.last_name}"
        created_at = plan.created_at.strftime("%d.%m.%Y %H:%M") if plan.created_at else ""

        footer_data = [
            [
                Paragraph(f"Erstellt von: {creator}", style_footer),
                Paragraph(
                    "Hilfswerk Oesterreich – GTS Planer", style_footer
                ),
                Paragraph(f"Erstellt am: {created_at}", style_footer),
            ]
        ]
        footer_table = Table(
            footer_data,
            colWidths=[9 * cm, 9 * cm, 9 * cm],
        )
        footer_table.setStyle(
            TableStyle(
                [
                    ("ALIGN", (0, 0), (0, 0), "LEFT"),
                    ("ALIGN", (1, 0), (1, 0), "CENTER"),
                    ("ALIGN", (2, 0), (2, 0), "RIGHT"),
                    ("LINEABOVE", (0, 0), (-1, 0), 0.5, colors.HexColor("#e2e8f0")),
                    ("TOPPADDING", (0, 0), (-1, 0), 4),
                ]
            )
        )
        elements.append(footer_table)

        # ── Build PDF ──────────────────────────────────────────────────
        doc.build(elements)
        pdf_bytes = buffer.getvalue()
        buffer.close()

        group_name = plan.group.name if plan.group else "Vorlage"
        kw = plan.calendar_week or "X"
        filename = f"Wochenplan_{group_name}_KW{kw}.pdf"

        response = HttpResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response
