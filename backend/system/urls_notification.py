"""URL configuration for in-app notifications."""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from system.views_notification import InAppNotificationViewSet

router = DefaultRouter()
router.register("", InAppNotificationViewSet, basename="notification")

urlpatterns = [
    path("", include(router.urls)),
]
