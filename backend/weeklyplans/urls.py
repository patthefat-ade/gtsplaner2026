"""
WeeklyPlans URL configuration.
"""
from django.urls import include, path
from rest_framework.routers import DefaultRouter

from weeklyplans.views import WeeklyPlanViewSet

app_name = "weeklyplans"

router = DefaultRouter()
router.register(r"plans", WeeklyPlanViewSet, basename="weeklyplan")

urlpatterns = [
    path("", include(router.urls)),
]
