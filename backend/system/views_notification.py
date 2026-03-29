"""Views for in-app notifications."""

from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from core.pagination import StandardPagination
from system.models import InAppNotification
from system.serializers_notification import InAppNotificationSerializer


class InAppNotificationViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for in-app notifications.

    Users can only see their own notifications.
    Provides endpoints to mark notifications as read.
    """

    serializer_class = InAppNotificationSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = StandardPagination

    def get_queryset(self):
        return (
            InAppNotification.objects.filter(recipient=self.request.user)
            .select_related("related_task")
        )

    @action(detail=True, methods=["patch"], url_path="read")
    def mark_read(self, request, pk=None):
        """Mark a single notification as read."""
        notification = self.get_object()
        notification.is_read = True
        notification.save(update_fields=["is_read", "updated_at"])
        serializer = self.get_serializer(notification)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="mark-all-read")
    def mark_all_read(self, request):
        """Mark all unread notifications as read."""
        count = self.get_queryset().filter(is_read=False).update(is_read=True)
        return Response({"marked_read": count})

    @action(detail=False, methods=["get"], url_path="unread-count")
    def unread_count(self, request):
        """Return count of unread notifications."""
        count = self.get_queryset().filter(is_read=False).count()
        return Response({"unread_count": count})
