"""
Events URL configuration.
Routes for Event endpoints.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from events.views import EventViewSet

app_name = "events"

router = DefaultRouter()
router.register(r"", EventViewSet, basename="event")

urlpatterns = [
    path("", include(router.urls)),
]
