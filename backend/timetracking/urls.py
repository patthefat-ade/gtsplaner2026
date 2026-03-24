"""
Timetracking URL configuration.

Routes for TimeEntry, LeaveType, LeaveRequest, and WorkingHoursLimit endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from timetracking.views import (
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    TimeEntryViewSet,
    WorkingHoursLimitViewSet,
)

app_name = "timetracking"

router = DefaultRouter()
router.register(r"entries", TimeEntryViewSet, basename="timeentry")
router.register(r"leave-types", LeaveTypeViewSet, basename="leavetype")
router.register(r"leave-requests", LeaveRequestViewSet, basename="leaverequest")
router.register(r"working-hours-limits", WorkingHoursLimitViewSet, basename="workinghourslimit")

urlpatterns = [
    path("", include(router.urls)),
]
