"""
Dashboard statistics API view.

Returns aggregated statistics based on the user's tenant context:
- SuperAdmin: System-wide data
- Admin: Organization-scoped data (own org + sub-orgs)
- LocationManager: Location-scoped data
- Educator: Personal data only

Caching strategy:
- Aggregate counts are cached for 2 minutes per user/role combination
- Recent items (last 7 days) are always fetched fresh
- Cache is invalidated on relevant write operations via cache_utils
"""

import hashlib
import json

from django.core.cache import cache
from django.db.models import Count, Sum, Q
from django.utils import timezone
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from core.middleware import ensure_tenant_context
from core.models import Location, Organization
from core.permissions import (
    GROUP_SUPER_ADMIN,
    GROUP_ADMIN,
    GROUP_LOCATION_MANAGER,
    get_user_group_name,
)

User = get_user_model()
from finance.models import Transaction, TransactionCategory
from groups.models import Group, Student
from timetracking.models import TimeEntry, LeaveRequest
from weeklyplans.models import WeeklyPlan
from tasks.models import Task

# Cache TTL in seconds
DASHBOARD_CACHE_TTL = 120  # 2 minutes for aggregate counts


def _build_cache_key(user, group_name, tenant_ids):
    """Build a deterministic cache key for the dashboard stats."""
    tenant_hash = hashlib.md5(
        json.dumps(sorted(tenant_ids or []), default=str).encode()
    ).hexdigest()[:8]
    return f"dashboard:stats:{user.id}:{group_name}:{tenant_hash}"


class DashboardStatsView(APIView):
    """
    GET /api/v1/dashboard/stats/

    Returns dashboard statistics filtered by the user's tenant context.
    Aggregate counts are cached for 2 minutes to reduce DB load.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        responses={
            200: inline_serializer(
                "DashboardStatsResponse",
                fields={
                    "role": serializers.CharField(),
                    "locations_count": serializers.IntegerField(),
                    "groups_count": serializers.IntegerField(),
                    "students_count": serializers.IntegerField(),
                    "transactions_count": serializers.IntegerField(),
                    "time_entries_count": serializers.IntegerField(),
                    "weeklyplans_count": serializers.IntegerField(),
                    "educators_count": serializers.IntegerField(),
                    "pending_leave_requests": serializers.IntegerField(),
                    "pending_transactions": serializers.IntegerField(),
                    "total_income": serializers.FloatField(),
                    "total_expense": serializers.FloatField(),
                },
            )
        },
        summary="Dashboard-Statistiken abrufen",
        description="Liefert aggregierte Statistiken basierend auf dem Tenant-Kontext des Benutzers.",
    )
    def get(self, request):
        ensure_tenant_context(request)

        user = request.user
        group_name = get_user_group_name(user)
        tenant_ids = getattr(request, "tenant_ids", [])

        # Try to serve aggregate counts from cache
        cache_key = _build_cache_key(user, group_name, tenant_ids)
        cached_stats = cache.get(cache_key)

        if cached_stats is not None:
            # Merge cached aggregates with fresh recent data
            recent = self._get_recent_data(user, group_name, tenant_ids)
            cached_stats.update(recent)
            return Response(cached_stats, status=status.HTTP_200_OK)

        # Build base querysets with tenant filtering
        querysets = self._build_querysets(user, group_name, tenant_ids, request)

        # Calculate aggregate counts (cacheable)
        aggregate_stats = self._compute_aggregates(
            user, group_name, querysets
        )

        # Cache aggregate stats
        cache.set(cache_key, aggregate_stats, DASHBOARD_CACHE_TTL)

        # Add fresh recent data (not cached)
        recent = self._get_recent_data(user, group_name, tenant_ids)
        aggregate_stats.update(recent)

        return Response(aggregate_stats, status=status.HTTP_200_OK)

    def _build_querysets(self, user, group_name, tenant_ids, request):
        """Build role-specific base querysets."""
        if group_name == GROUP_SUPER_ADMIN:
            return {
                "locations": Location.objects.all(),
                "groups": Group.objects.all(),
                "students": Student.objects.all(),
                "transactions": Transaction.objects.all(),
                "time_entries": TimeEntry.objects.all(),
                "leave_requests": LeaveRequest.objects.all(),
                "weeklyplans": WeeklyPlan.objects.filter(
                    is_deleted=False, is_template=False
                ),
                "tasks": Task.objects.all(),
                "educators_count": User.objects.filter(
                    role=User.Role.EDUCATOR, is_active=True
                ).count(),
            }
        elif group_name == GROUP_ADMIN:
            return {
                "locations": Location.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "groups": Group.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "students": Student.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "transactions": Transaction.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "time_entries": TimeEntry.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "leave_requests": LeaveRequest.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "weeklyplans": WeeklyPlan.objects.filter(
                    organization_id__in=tenant_ids,
                    is_deleted=False,
                    is_template=False,
                ),
                "tasks": Task.objects.filter(
                    organization_id__in=tenant_ids
                ),
                "educators_count": User.objects.filter(
                    role=User.Role.EDUCATOR,
                    is_active=True,
                    location__organization_id__in=tenant_ids,
                ).count(),
            }
        elif group_name == GROUP_LOCATION_MANAGER:
            user_location = getattr(user, "location", None)
            if user_location:
                return {
                    "locations": Location.objects.filter(id=user_location.id),
                    "groups": Group.objects.filter(
                        organization_id__in=tenant_ids
                    ),
                    "students": Student.objects.filter(
                        organization_id__in=tenant_ids
                    ),
                    "transactions": Transaction.objects.filter(
                        organization_id__in=tenant_ids
                    ),
                    "time_entries": TimeEntry.objects.filter(
                        organization_id__in=tenant_ids
                    ),
                    "leave_requests": LeaveRequest.objects.filter(
                        organization_id__in=tenant_ids
                    ),
                    "weeklyplans": WeeklyPlan.objects.filter(
                        organization_id__in=tenant_ids,
                        is_deleted=False,
                        is_template=False,
                    ),
                    "tasks": Task.objects.filter(
                        organization_id__in=tenant_ids
                    ),
                    "educators_count": 0,
                }
            else:
                return {
                    "locations": Location.objects.none(),
                    "groups": Group.objects.none(),
                    "students": Student.objects.none(),
                    "transactions": Transaction.objects.none(),
                    "time_entries": TimeEntry.objects.none(),
                    "leave_requests": LeaveRequest.objects.none(),
                    "weeklyplans": WeeklyPlan.objects.none(),
                    "tasks": Task.objects.none(),
                    "educators_count": 0,
                }
        else:
            # Educator
            groups_qs = (
                Group.objects.filter(
                    Q(members__user=user) | Q(leader=user)
                ).distinct()
                if tenant_ids
                else Group.objects.none()
            )
            educator_group_ids = list(
                groups_qs.values_list("id", flat=True)
            )
            return {
                "locations": Location.objects.filter(
                    id=getattr(user, "location_id", 0)
                ),
                "groups": groups_qs,
                "students": (
                    Student.objects.filter(group_id__in=educator_group_ids)
                    if educator_group_ids
                    else Student.objects.none()
                ),
                "transactions": Transaction.objects.filter(created_by=user),
                "time_entries": TimeEntry.objects.filter(user=user),
                "leave_requests": LeaveRequest.objects.filter(user=user),
                "weeklyplans": WeeklyPlan.objects.filter(
                    created_by=user, is_deleted=False, is_template=False
                ),
                "tasks": Task.objects.filter(assigned_to=user),
                "educators_count": 0,
            }

    def _compute_aggregates(self, user, group_name, qs):
        """Compute aggregate counts from querysets."""
        transactions_qs = qs["transactions"]

        # Use a single aggregate call for financial totals
        financial = transactions_qs.aggregate(
            total_income=Sum(
                "amount", filter=Q(transaction_type="income")
            ),
            total_expense=Sum(
                "amount", filter=Q(transaction_type="expense")
            ),
            pending_count=Count(
                "id", filter=Q(status="pending")
            ),
        )

        # Task aggregates
        tasks_qs = qs["tasks"]
        task_stats = tasks_qs.aggregate(
            open_tasks=Count("id", filter=Q(status="open")),
            in_progress_tasks=Count("id", filter=Q(status="in_progress")),
            done_tasks=Count("id", filter=Q(status="done")),
            overdue_tasks=Count(
                "id",
                filter=Q(
                    due_date__lt=timezone.now().date(),
                    status__in=["open", "in_progress"],
                ),
            ),
        )

        return {
            "role": group_name,
            "locations_count": qs["locations"].count(),
            "groups_count": qs["groups"].count(),
            "students_count": qs["students"].count(),
            "transactions_count": transactions_qs.count(),
            "time_entries_count": qs["time_entries"].count(),
            "weeklyplans_count": qs["weeklyplans"].count(),
            "educators_count": qs["educators_count"],
            "pending_leave_requests": qs["leave_requests"]
            .filter(status="pending")
            .count(),
            "pending_transactions": financial["pending_count"] or 0,
            "total_income": float(financial["total_income"] or 0),
            "total_expense": float(financial["total_expense"] or 0),
            "open_tasks": task_stats["open_tasks"] or 0,
            "in_progress_tasks": task_stats["in_progress_tasks"] or 0,
            "done_tasks": task_stats["done_tasks"] or 0,
            "overdue_tasks": task_stats["overdue_tasks"] or 0,
        }

    def _get_recent_data(self, user, group_name, tenant_ids):
        """Fetch fresh recent data (not cached)."""
        now = timezone.now()
        seven_days_ago = now - timezone.timedelta(days=7)

        # Build role-specific querysets for recent data
        if group_name == GROUP_SUPER_ADMIN:
            time_entries_qs = TimeEntry.objects.all()
            transactions_qs = Transaction.objects.all()
            leave_requests_qs = LeaveRequest.objects.all()
        elif group_name in (GROUP_ADMIN, GROUP_LOCATION_MANAGER):
            time_entries_qs = TimeEntry.objects.filter(
                organization_id__in=tenant_ids
            )
            transactions_qs = Transaction.objects.filter(
                organization_id__in=tenant_ids
            )
            leave_requests_qs = LeaveRequest.objects.filter(
                organization_id__in=tenant_ids
            )
        else:
            time_entries_qs = TimeEntry.objects.filter(user=user)
            transactions_qs = Transaction.objects.filter(created_by=user)
            leave_requests_qs = LeaveRequest.objects.filter(user=user)

        # Build task querysets based on role
        if group_name == GROUP_SUPER_ADMIN:
            tasks_qs = Task.objects.all()
        elif group_name in (GROUP_ADMIN, GROUP_LOCATION_MANAGER):
            tasks_qs = Task.objects.filter(
                organization_id__in=tenant_ids
            )
        else:
            # Educator: only assigned tasks
            tasks_qs = Task.objects.filter(assigned_to=user)

        # For LocationManager: build per-educator task summary
        educator_task_summary = []
        if group_name == GROUP_LOCATION_MANAGER:
            educator_task_summary = list(
                tasks_qs.filter(
                    status__in=["open", "in_progress"]
                ).values(
                    "assigned_to__id",
                    "assigned_to__first_name",
                    "assigned_to__last_name",
                ).annotate(
                    open_count=Count("id", filter=Q(status="open")),
                    in_progress_count=Count("id", filter=Q(status="in_progress")),
                    overdue_count=Count(
                        "id",
                        filter=Q(
                            due_date__lt=timezone.now().date(),
                            status__in=["open", "in_progress"],
                        ),
                    ),
                ).order_by("assigned_to__last_name")
            )

        return {
            "recent_time_entries": list(
                time_entries_qs.filter(date__gte=seven_days_ago.date())
                .order_by("-date")[:5]
                .values(
                    "id",
                    "date",
                    "duration_minutes",
                    "notes",
                    "start_time",
                    "end_time",
                    "user__first_name",
                    "user__last_name",
                    "group__name",
                )
            ),
            "recent_transactions": list(
                transactions_qs.order_by("-transaction_date")[:5].values(
                    "id",
                    "transaction_date",
                    "amount",
                    "description",
                    "transaction_type",
                    "status",
                    "created_by__first_name",
                    "created_by__last_name",
                    "group__name",
                )
            ),
            "recent_leave_requests": list(
                leave_requests_qs.filter(status="pending")
                .order_by("-created_at")[:5]
                .values(
                    "id",
                    "start_date",
                    "end_date",
                    "status",
                    "user__first_name",
                    "user__last_name",
                    "leave_type__name",
                )
            ),
            "recent_tasks": list(
                tasks_qs.filter(
                    status__in=["open", "in_progress"]
                ).order_by("due_date")[:5].values(
                    "id",
                    "title",
                    "status",
                    "priority",
                    "due_date",
                    "assigned_to__first_name",
                    "assigned_to__last_name",
                    "created_by__first_name",
                    "created_by__last_name",
                )
            ),
            "educator_task_summary": educator_task_summary,
        }
