"""
Events views for managing excursions and events.

Provides CRUD for events, participant management, consent tracking,
and transaction linking. All endpoints are tenant-scoped.
"""

from django.db.models import Count, Q
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.middleware import ensure_tenant_context
from core.mixins import TenantViewSetMixin
from core.mixins_export import ExportMixin
from core.permissions import IsEducator, require_permission

from .models import Event, EventParticipant
from .serializers import (
    EventCreateUpdateSerializer,
    EventDetailSerializer,
    EventListSerializer,
    EventParticipantCreateUpdateSerializer,
    EventParticipantListSerializer,
)


class EventViewSet(ExportMixin, TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for events/excursions with participant and consent management.

    - Educators: CRUD for events in their groups
    - LocationManager: full access within location
    - Admin/SuperAdmin: full access within tenant
    """

    queryset = Event.objects.all()
    search_fields = ["title", "description", "venue"]
    ordering_fields = ["start_date", "created_at", "title", "status"]
    ordering = ["-start_date"]
    filterset_fields = {
        "event_type": ["exact"],
        "status": ["exact"],
        "start_date": ["gte", "lte"],
        "location": ["exact"],
        "school_year": ["exact"],
    }

    # ExportMixin configuration
    export_fields = [
        {"key": "id", "label": "ID", "width": 8},
        {"key": "title", "label": "Titel", "width": 30},
        {"key": "get_event_type_display", "label": "Typ", "width": 16},
        {"key": "get_status_display", "label": "Status", "width": 14},
        {"key": "start_date", "label": "Startdatum", "width": 14},
        {"key": "end_date", "label": "Enddatum", "width": 14},
        {"key": "venue", "label": "Veranstaltungsort", "width": 22},
        {"key": "estimated_cost", "label": "Gesch. Kosten", "width": 14},
        {"key": "location.name", "label": "Standort", "width": 18},
    ]
    export_filename = "veranstaltungen"
    export_title = "Veranstaltungen"

    def get_serializer_class(self):
        if self.action == "list":
            return EventListSerializer
        if self.action in ("create", "update", "partial_update"):
            return EventCreateUpdateSerializer
        return EventDetailSerializer

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Event.objects.none()
        qs = super().get_queryset()
        qs = qs.filter(is_deleted=False).select_related(
            "location", "school_year", "created_by"
        ).prefetch_related("groups", "transactions")
        # Annotate participant and consent counts
        qs = qs.annotate(
            participant_count=Count(
                "participants",
                filter=Q(participants__is_deleted=False),
                distinct=True,
            ),
            consent_count=Count(
                "participants",
                filter=Q(
                    participants__is_deleted=False,
                    participants__consent_status="granted",
                ),
                distinct=True,
            ),
        )
        return qs

    def perform_create(self, serializer):
        ensure_tenant_context(self.request)
        serializer.save(
            created_by=self.request.user,
            organization=self.request.tenant,
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()

    def create(self, request, *args, **kwargs):
        """Override to return detail serializer after create."""
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        # Re-fetch from annotated queryset for correct serialization
        instance = self.get_queryset().get(pk=serializer.instance.pk)
        detail_serializer = EventDetailSerializer(instance)
        return Response(detail_serializer.data, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        """Override to return detail serializer after update."""
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        # Re-fetch from annotated queryset for correct serialization
        instance = self.get_queryset().get(pk=instance.pk)
        detail_serializer = EventDetailSerializer(instance)
        return Response(detail_serializer.data)

    # ── Participant Management ──────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="participants")
    def list_participants(self, request, pk=None):
        """List all participants for an event."""
        event = self.get_object()
        participants = event.participants.filter(
            is_deleted=False
        ).select_related("student", "student__group")
        serializer = EventParticipantListSerializer(participants, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="participants/add")
    def add_participants(self, request, pk=None):
        """
        Add students as participants to an event.
        Expects: {"student_ids": [1, 2, 3]}
        """
        event = self.get_object()
        student_ids = request.data.get("student_ids", [])
        if not student_ids:
            return Response(
                {"detail": "student_ids ist erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from groups.models import Student

        created = []
        for sid in student_ids:
            try:
                student = Student.objects.get(pk=sid, is_deleted=False)
            except Student.DoesNotExist:
                continue
            participant, was_created = EventParticipant.objects.get_or_create(
                event=event,
                student=student,
                defaults={
                    "organization": event.organization,
                    "consent_status": (
                        EventParticipant.ConsentStatus.PENDING
                        if event.requires_consent
                        else EventParticipant.ConsentStatus.NOT_REQUIRED
                    ),
                },
            )
            if was_created:
                created.append(participant.id)
            elif participant.is_deleted:
                participant.is_deleted = False
                participant.save()
                created.append(participant.id)

        return Response(
            {"added": len(created), "participant_ids": created},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=True, methods=["post"], url_path="participants/remove")
    def remove_participants(self, request, pk=None):
        """
        Remove students from an event (soft delete).
        Expects: {"student_ids": [1, 2, 3]}
        """
        event = self.get_object()
        student_ids = request.data.get("student_ids", [])
        removed = EventParticipant.objects.filter(
            event=event,
            student_id__in=student_ids,
            is_deleted=False,
        ).update(is_deleted=True)
        return Response({"removed": removed})

    # ── Consent Management ──────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="participants/consent")
    def update_consent(self, request, pk=None):
        """
        Update consent status for participants.
        Expects: {"participants": [{"id": 1, "consent_status": "granted", "consent_given_by": "Frau Mueller"}]}
        """
        event = self.get_object()
        updates = request.data.get("participants", [])
        updated = 0
        for item in updates:
            try:
                participant = EventParticipant.objects.get(
                    pk=item["id"],
                    event=event,
                    is_deleted=False,
                )
            except (EventParticipant.DoesNotExist, KeyError):
                continue

            consent_status = item.get("consent_status")
            if consent_status in dict(EventParticipant.ConsentStatus.choices):
                participant.consent_status = consent_status
                if consent_status == "granted":
                    participant.consent_date = timezone.now()
                participant.consent_given_by = item.get(
                    "consent_given_by", participant.consent_given_by
                )
                participant.consent_notes = item.get(
                    "consent_notes", participant.consent_notes
                )
                participant.save()
                updated += 1

        return Response({"updated": updated})

    # ── Transaction Linking ─────────────────────────────────────────────

    @action(detail=True, methods=["post"], url_path="transactions/link")
    def link_transactions(self, request, pk=None):
        """
        Link financial transactions to an event.
        Expects: {"transaction_ids": [1, 2, 3]}
        """
        event = self.get_object()
        transaction_ids = request.data.get("transaction_ids", [])

        from finance.models import Transaction

        linked = 0
        for tid in transaction_ids:
            try:
                tx = Transaction.objects.get(pk=tid, is_deleted=False)
                event.transactions.add(tx)
                linked += 1
            except Transaction.DoesNotExist:
                continue

        return Response({"linked": linked})

    @action(detail=True, methods=["post"], url_path="transactions/unlink")
    def unlink_transactions(self, request, pk=None):
        """
        Unlink financial transactions from an event.
        Expects: {"transaction_ids": [1, 2, 3]}
        """
        event = self.get_object()
        transaction_ids = request.data.get("transaction_ids", [])
        event.transactions.remove(*transaction_ids)
        return Response({"unlinked": len(transaction_ids)})

    # ── Statistics ──────────────────────────────────────────────────────

    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        """Get statistics for an event."""
        event = self.get_object()
        participants = event.participants.filter(is_deleted=False)
        total = participants.count()
        consent_granted = participants.filter(consent_status="granted").count()
        consent_denied = participants.filter(consent_status="denied").count()
        consent_pending = participants.filter(consent_status="pending").count()
        attended = participants.filter(attendance_status="attended").count()

        return Response({
            "total_participants": total,
            "consent_granted": consent_granted,
            "consent_denied": consent_denied,
            "consent_pending": consent_pending,
            "attended": attended,
            "consent_rate": round(consent_granted / total * 100, 1) if total else 0,
            "attendance_rate": round(attended / total * 100, 1) if total else 0,
            "total_cost": event.total_cost,
        })
