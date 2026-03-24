"""Health check URL patterns."""

from django.urls import path

from . import views

urlpatterns = [
    path("", views.health_check, name="health-check"),
]
