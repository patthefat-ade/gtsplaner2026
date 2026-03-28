"""
Dashboard statistics API view.

Returns aggregated statistics based on the user's tenant context:
- SuperAdmin: System-wide data
- Admin: Organization-scoped data (own org + sub-orgs)
- LocationManager: Location-scoped data
- Educator: Personal data only
"""

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
from core.permissions import GROUP_SUPER_ADMIN, GROUP_ADMIN, GROUP_LOCATION_MANAGER, get_user_group_name

User = get_user_model()
from finance.models import Transaction, TransactionCategory
from groups.models import Group, Student
from timetracking.models import TimeEntry, LeaveRequest
from weeklyplans.models import WeeklyPlan


class DashboardStatsView(APIView):
    """
    GET /api/v1/dashboard/stats/

    Returns dashboard statistics filtered by the user's tenant context.
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

        # Build base querysets with tenant filtering
        if group_name == GROUP_SUPER_ADMIN:
            # SuperAdmin: all data
            locations_qs = Location.objects.all()
            groups_qs = Group.objects.all()
            students_qs = Student.objects.all()
            transactions_qs = Transaction.objects.all()
            time_entries_qs = TimeEntry.objects.all()
            leave_requests_qs = LeaveRequest.objects.all()
            weeklyplans_qs = WeeklyPlan.objects.all()
            educators_count = User.objects.filter(
                role=User.Role.EDUCATOR, is_active=True
            ).count()
        elif group_name == GROUP_ADMIN:
            # Admin: own org + sub-orgs
            tenant_ids = request.tenant_ids
            locations_qs = Location.objects.filter(organization_id__in=tenant_ids)
            groups_qs = Group.objects.filter(organization_id__in=tenant_ids)
            students_qs = Student.objects.filter(organization_id__in=tenant_ids)
            transactions_qs = Transaction.objects.filter(organization_id__in=tenant_ids)
            time_entries_qs = TimeEntry.objects.filter(organization_id__in=tenant_ids)
            leave_requests_qs = LeaveRequest.objects.filter(organization_id__in=tenant_ids)
            weeklyplans_qs = WeeklyPlan.objects.filter(organization_id__in=tenant_ids)
            educators_count = User.objects.filter(
                role=User.Role.EDUCATOR,
                is_active=True,
                location__organization_id__in=tenant_ids,
            ).count()
        elif group_name == GROUP_LOCATION_MANAGER:
            # LocationManager: own location(s)
            user_location = getattr(user, "location", None)
            tenant_ids = request.tenant_ids
            if user_location:
                locations_qs = Location.objects.filter(id=user_location.id)
                groups_qs = Group.objects.filter(organization_id__in=tenant_ids)
                students_qs = Student.objects.filter(organization_id__in=tenant_ids)
                transactions_qs = Transaction.objects.filter(organization_id__in=tenant_ids)
                time_entries_qs = TimeEntry.objects.filter(organization_id__in=tenant_ids)
                leave_requests_qs = LeaveRequest.objects.filter(organization_id__in=tenant_ids)
                weeklyplans_qs = WeeklyPlan.objects.filter(organization_id__in=tenant_ids)
            else:
                locations_qs = Location.objects.none()
                groups_qs = Group.objects.none()
                students_qs = Student.objects.none()
                transactions_qs = Transaction.objects.none()
                time_entries_qs = TimeEntry.objects.none()
                leave_requests_qs = LeaveRequest.objects.none()
                weeklyplans_qs = WeeklyPlan.objects.none()
            educators_count = 0
        else:
            # Educator: personal data only
            locations_qs = Location.objects.filter(id=getattr(user, "location_id", 0))
            groups_qs = Group.objects.filter(
                organization_id__in=request.tenant_ids
            ) if request.tenant_ids else Group.objects.none()
            students_qs = Student.objects.filter(
                organization_id__in=request.tenant_ids
            ) if request.tenant_ids else Student.objects.none()
            transactions_qs = Transaction.objects.filter(created_by=user)
            time_entries_qs = TimeEntry.objects.filter(user=user)
            leave_requests_qs = LeaveRequest.objects.filter(user=user)
            weeklyplans_qs = WeeklyPlan.objects.filter(created_by=user)
            educators_count = 0

        # Calculate counts
        now = timezone.now()
        seven_days_ago = now - timezone.timedelta(days=7)

        stats = {
            "role": group_name,
            "locations_count": locations_qs.count(),
            "groups_count": groups_qs.count(),
            "students_count": students_qs.count(),
            "transactions_count": transactions_qs.count(),
            "time_entries_count": time_entries_qs.count(),
            "weeklyplans_count": weeklyplans_qs.count(),
            "educators_count": educators_count,
            "pending_leave_requests": leave_requests_qs.filter(
                status="pending"
            ).count(),
            "pending_transactions": transactions_qs.filter(
                status="pending"
            ).count(),
            # Financial summary
            "total_income": float(
                transactions_qs.filter(
                    transaction_type="income"
                ).aggregate(total=Sum("amount"))["total"] or 0
            ),
            "total_expense": float(
                transactions_qs.filter(
                    transaction_type="expense"
                ).aggregate(total=Sum("amount"))["total"] or 0
            ),
            # Recent data (last 7 days)
            "recent_time_entries": list(
                time_entries_qs.filter(
                    date__gte=seven_days_ago.date()
                ).order_by("-date")[:5].values(
                    "id", "date", "duration_minutes", "notes",
                    "start_time", "end_time",
                    "user__first_name", "user__last_name",
                    "group__name"
                )
            ),
            "recent_transactions": list(
                transactions_qs.order_by("-transaction_date")[:5].values(
                    "id", "transaction_date", "amount", "description",
                    "transaction_type", "status",
                    "created_by__first_name", "created_by__last_name",
                    "group__name"
                )
            ),
            "recent_leave_requests": list(
                leave_requests_qs.filter(
                    status="pending"
                ).order_by("-created_at")[:5].values(
                    "id", "start_date", "end_date", "status",
                    "user__first_name", "user__last_name",
                    "leave_type__name"
                )
            ),
        }

        return Response(stats, status=status.HTTP_200_OK)
