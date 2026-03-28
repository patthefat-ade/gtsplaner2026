"""
Group Transfer API views.

Provides CRUD operations and workflow actions (confirm, reject, complete)
for managing temporary student group transfers within a location.

Access control:
- Educators: Can request transfers and see transfers for their groups
- LocationManager+: Can confirm/reject/complete transfers at their location
- Admin/SuperAdmin: Full access within tenant

Tenant isolation is provided by TenantViewSetMixin.
"""

from django.db.models import Q
from django.utils import timezone
from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from core.permissions import (
    GROUP_HIERARCHY,
    GROUP_LOCATION_MANAGER,
    IsEducator,
    IsLocationManagerOrAbove,
    get_user_hierarchy_level,
)
from groups.models_transfer import GroupTransfer
from groups.serializers_transfer import (
    GroupTransferCompleteSerializer,
    GroupTransferConfirmSerializer,
    GroupTransferCreateSerializer,
    GroupTransferListSerializer,
)


class GroupTransferFilter(django_filters.FilterSet):
    """Filter for group transfer records."""

    student_id = django_filters.NumberFilter(field_name="student_id")
    source_group_id = django_filters.NumberFilter(field_name="source_group_id")
    target_group_id = django_filters.NumberFilter(field_name="target_group_id")
    status = django_filters.ChoiceFilter(choices=GroupTransfer.Status.choices)
    transfer_date = django_filters.DateFilter(field_name="transfer_date")
    start_date = django_filters.DateFilter(
        field_name="transfer_date", lookup_expr="gte"
    )
    end_date = django_filters.DateFilter(
        field_name="transfer_date", lookup_expr="lte"
    )

    class Meta:
        model = GroupTransfer
        fields = [
            "student_id",
            "source_group_id",
            "target_group_id",
            "status",
            "transfer_date",
            "start_date",
            "end_date",
        ]


@extend_schema_view(
    list=extend_schema(tags=["Gruppenwechsel"]),
    retrieve=extend_schema(tags=["Gruppenwechsel"]),
    create=extend_schema(tags=["Gruppenwechsel"]),
    update=extend_schema(tags=["Gruppenwechsel"]),
    partial_update=extend_schema(tags=["Gruppenwechsel"]),
    destroy=extend_schema(tags=["Gruppenwechsel"]),
)
class GroupTransferViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for temporary group transfers with confirmation workflow.

    Standard CRUD endpoints plus:
    - POST /transfers/{id}/confirm/ - Confirm a pending transfer
    - POST /transfers/{id}/reject/ - Reject a pending transfer
    - POST /transfers/{id}/complete/ - Mark a confirmed transfer as completed

    Permissions:
    - Educators: Create requests, view transfers for their groups
    - LocationManager+: Confirm/reject/complete, view all at location
    - Admin/SuperAdmin: Full access within tenant
    """

    queryset = GroupTransfer.objects.all()
    filterset_class = GroupTransferFilter
    ordering_fields = ["transfer_date", "created_at", "status"]
    ordering = ["-transfer_date", "-created_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return GroupTransfer.objects.none()

        qs = super().get_queryset()
        qs = qs.filter(is_deleted=False).select_related(
            "student",
            "source_group",
            "source_group__location",
            "target_group",
            "requested_by",
            "confirmed_by",
        )

        user = self.request.user
        level = get_user_hierarchy_level(user)

        if level >= GROUP_HIERARCHY[GROUP_LOCATION_MANAGER]:
            return qs

        # Educators see transfers for groups they belong to
        return qs.filter(
            Q(source_group__members__user=user)
            | Q(source_group__leader=user)
            | Q(target_group__members__user=user)
            | Q(target_group__leader=user)
            | Q(requested_by=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ["create"]:
            return GroupTransferCreateSerializer
        if self.action in ["confirm", "reject"]:
            return GroupTransferConfirmSerializer
        if self.action == "complete":
            return GroupTransferCompleteSerializer
        return GroupTransferListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        if self.action in ["create"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        if self.action in ["confirm", "reject", "complete"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        if self.action in ["update", "partial_update"]:
            return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]
        if self.action == "destroy":
            return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]
        return [permissions.IsAuthenticated(), IsEducator()]

    def perform_destroy(self, instance):
        """Soft delete."""
        instance.is_deleted = True
        instance.save()

    @extend_schema(
        tags=["Gruppenwechsel"],
        request=GroupTransferConfirmSerializer,
        responses={200: GroupTransferListSerializer},
    )
    @action(detail=True, methods=["post"])
    def confirm(self, request, pk=None):
        """Confirm a pending group transfer."""
        transfer = self.get_object()

        if transfer.status != GroupTransfer.Status.PENDING:
            return Response(
                {"detail": "Nur ausstehende Wechsel koennen bestaetigt werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Check: confirmer must be educator/leader of target group or LocationManager+
        user = request.user
        level = get_user_hierarchy_level(user)
        is_target_member = (
            transfer.target_group.members.filter(user=user).exists()
            or transfer.target_group.leader == user
        )

        if level < GROUP_HIERARCHY[GROUP_LOCATION_MANAGER] and not is_target_member:
            return Response(
                {"detail": "Nur Paedagog:innen der Zielgruppe oder Standortleitung koennen bestaetigen."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GroupTransferConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transfer.status = GroupTransfer.Status.CONFIRMED
        transfer.confirmed_by = user
        transfer.confirmed_at = timezone.now()
        if serializer.validated_data.get("notes"):
            transfer.notes = serializer.validated_data["notes"]
        transfer.save()

        return Response(
            GroupTransferListSerializer(transfer).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Gruppenwechsel"],
        request=GroupTransferConfirmSerializer,
        responses={200: GroupTransferListSerializer},
    )
    @action(detail=True, methods=["post"])
    def reject(self, request, pk=None):
        """Reject a pending group transfer."""
        transfer = self.get_object()

        if transfer.status != GroupTransfer.Status.PENDING:
            return Response(
                {"detail": "Nur ausstehende Wechsel koennen abgelehnt werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        user = request.user
        level = get_user_hierarchy_level(user)
        is_target_member = (
            transfer.target_group.members.filter(user=user).exists()
            or transfer.target_group.leader == user
        )

        if level < GROUP_HIERARCHY[GROUP_LOCATION_MANAGER] and not is_target_member:
            return Response(
                {"detail": "Nur Paedagog:innen der Zielgruppe oder Standortleitung koennen ablehnen."},
                status=status.HTTP_403_FORBIDDEN,
            )

        serializer = GroupTransferConfirmSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transfer.status = GroupTransfer.Status.REJECTED
        transfer.confirmed_by = user
        transfer.confirmed_at = timezone.now()
        if serializer.validated_data.get("notes"):
            transfer.notes = serializer.validated_data["notes"]
        transfer.save()

        return Response(
            GroupTransferListSerializer(transfer).data,
            status=status.HTTP_200_OK,
        )

    @extend_schema(
        tags=["Gruppenwechsel"],
        request=GroupTransferCompleteSerializer,
        responses={200: GroupTransferListSerializer},
    )
    @action(detail=True, methods=["post"])
    def complete(self, request, pk=None):
        """Mark a confirmed transfer as completed."""
        transfer = self.get_object()

        if transfer.status != GroupTransfer.Status.CONFIRMED:
            return Response(
                {"detail": "Nur bestaetigte Wechsel koennen abgeschlossen werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = GroupTransferCompleteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transfer.status = GroupTransfer.Status.COMPLETED
        transfer.completed_at = timezone.now()
        if serializer.validated_data.get("notes"):
            transfer.notes = serializer.validated_data["notes"]
        transfer.save()

        return Response(
            GroupTransferListSerializer(transfer).data,
            status=status.HTTP_200_OK,
        )
