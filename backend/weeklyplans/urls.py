"""
WeeklyPlans URL configuration.

Routes are registered directly under /api/v1/weeklyplans/ so that
the frontend can access them at /api/v1/weeklyplans/ (list) and
/api/v1/weeklyplans/<id>/ (detail).
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from weeklyplans.views import WeeklyPlanViewSet

app_name = "weeklyplans"

router = DefaultRouter()
router.register(r"", WeeklyPlanViewSet, basename="weeklyplan")

urlpatterns = [
    path("", include(router.urls)),
]
