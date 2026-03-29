"""
Cross-Tenant Aggregation API view.

Provides the main tenant (Hauptmandant) with aggregated statistics
broken down by sub-tenant.  Only accessible by Admin users whose
organization is a main tenant (org_type='main').

Endpoint:
    GET /api/v1/dashboard/cross-tenant/

Response includes:
- Global totals across all sub-tenants
- Per-sub-tenant breakdown of key metrics
- Cached for 5 minutes (configurable)
"""

import hashlib
import json
import logging

from django.core.cache import cache
from django.db.models import Count, Sum, Q
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from django.contrib.auth import get_user_model

from core.middleware import ensure_tenant_context
from core.models import Location, Organization
from core.permissions import (
    GROUP_ADMIN,
    GROUP_SUPER_ADMIN,
    get_user_group_name,
)

User = get_user_model()
from finance.models import Transaction
from groups.models import Group, Student
from timetracking.models import TimeEntry, LeaveRequest
from weeklyplans.models import WeeklyPlan

logger = logging.getLogger(__name__)

CROSS_TENANT_CACHE_TTL = 300  # 5 minutes


class CrossTenantStatsView(APIView):
    """
    GET /api/v1/dashboard/cross-tenant/

    Returns aggregated statistics for the main tenant, broken down
    by sub-tenant.  Only accessible by Admin users of a main tenant
    or SuperAdmin.
    """

    permission_classes = [IsAuthenticated]

    @extend_schema(
        summary="Cross-Tenant-Statistiken abrufen",
        description=(
            "Liefert aggregierte Statistiken fuer den Hauptmandanten, "
            "aufgeschluesselt nach Sub-Mandanten. Nur fuer Admins des "
            "Hauptmandanten oder SuperAdmin."
        ),
        responses={
            200: inline_serializer(
                "CrossTenantStatsResponse",
                fields={
                    "main_tenant": serializers.CharField(),
                    "totals": serializers.DictField(),
                    "sub_tenants": serializers.ListField(),
                },
            )
        },
    )
    def get(self, request):
        ensure_tenant_context(request)

        user = request.user
        group_name = get_user_group_name(user)

        # Access control: only Admin of main tenant or SuperAdmin
        if group_name == GROUP_SUPER_ADMIN:
            # SuperAdmin can view all main tenants
            main_org_id = request.query_params.get("organization_id")
            if main_org_id:
                try:
                    main_org = Organization.objects.get(
                        id=main_org_id, org_type=Organization.OrgType.MAIN
                    )
                except Organization.DoesNotExist:
                    return Response(
                        {"detail": "Hauptmandant nicht gefunden."},
                        status=status.HTTP_404_NOT_FOUND,
                    )
            else:
                # Return list of all main tenants
                main_orgs = Organization.objects.filter(
                    org_type=Organization.OrgType.MAIN,
                    is_active=True,
                    is_deleted=False,
                )
                return Response(
                    {
                        "main_tenants": [
                            {"id": org.id, "name": org.name}
                            for org in main_orgs
                        ]
                    }
                )
        elif group_name == GROUP_ADMIN:
            org = getattr(request, "tenant", None)
            if not org or not org.is_main_tenant:
                return Response(
                    {
                        "detail": "Nur Admins des Hauptmandanten haben Zugriff auf Cross-Tenant-Statistiken."
                    },
                    status=status.HTTP_403_FORBIDDEN,
                )
            main_org = org
        else:
            return Response(
                {"detail": "Keine Berechtigung."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Try cache
        cache_key = f"cross_tenant:stats:{main_org.id}"
        cached = cache.get(cache_key)
        if cached is not None:
            return Response(cached, status=status.HTTP_200_OK)

        # Get all sub-tenants
        sub_orgs = main_org.children.filter(
            is_active=True, is_deleted=False
        ).order_by("name")

        all_org_ids = [main_org.id] + [o.id for o in sub_orgs]

        # Global totals
        totals = self._compute_stats(all_org_ids)

        # Per sub-tenant breakdown
        sub_tenant_stats = []
        for sub_org in sub_orgs:
            sub_ids = [sub_org.id]
            stats = self._compute_stats(sub_ids)
            stats["id"] = sub_org.id
            stats["name"] = sub_org.name
            # Add location count for this sub-tenant
            stats["locations"] = list(
                Location.objects.filter(
                    organization_id=sub_org.id
                ).values("id", "name")
            )
            sub_tenant_stats.append(stats)

        result = {
            "main_tenant": {
                "id": main_org.id,
                "name": main_org.name,
            },
            "totals": totals,
            "sub_tenants": sub_tenant_stats,
        }

        # Cache the result
        cache.set(cache_key, result, CROSS_TENANT_CACHE_TTL)

        return Response(result, status=status.HTTP_200_OK)

    def _compute_stats(self, org_ids):
        """Compute aggregate statistics for a set of organization IDs."""
        financial = Transaction.objects.filter(
            organization_id__in=org_ids
        ).aggregate(
            total_income=Sum("amount", filter=Q(transaction_type="income")),
            total_expense=Sum("amount", filter=Q(transaction_type="expense")),
            pending_count=Count("id", filter=Q(status="pending")),
            total_transactions=Count("id"),
        )

        return {
            "locations_count": Location.objects.filter(
                organization_id__in=org_ids
            ).count(),
            "groups_count": Group.objects.filter(
                organization_id__in=org_ids
            ).count(),
            "students_count": Student.objects.filter(
                organization_id__in=org_ids
            ).count(),
            "educators_count": User.objects.filter(
                role=User.Role.EDUCATOR,
                is_active=True,
                location__organization_id__in=org_ids,
            ).count(),
            "transactions_count": financial["total_transactions"] or 0,
            "pending_transactions": financial["pending_count"] or 0,
            "total_income": float(financial["total_income"] or 0),
            "total_expense": float(financial["total_expense"] or 0),
            "weeklyplans_count": WeeklyPlan.objects.filter(
                organization_id__in=org_ids,
                is_deleted=False,
                is_template=False,
            ).count(),
            "pending_leave_requests": LeaveRequest.objects.filter(
                organization_id__in=org_ids,
                status="pending",
            ).count(),
        }
