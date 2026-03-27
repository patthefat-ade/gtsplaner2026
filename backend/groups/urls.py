"""
Groups URL configuration.

Routes for SchoolYear, Semester, Group, GroupMember, Student,
and Attendance endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from groups.views import (
    GroupMemberViewSet,
    GroupViewSet,
    SchoolYearViewSet,
    SemesterViewSet,
    StudentViewSet,
)
from groups.views_attendance import AttendanceViewSet

app_name = "groups"

router = DefaultRouter()
router.register(r"school-years", SchoolYearViewSet, basename="schoolyear")
router.register(r"semesters", SemesterViewSet, basename="semester")
router.register(r"groups", GroupViewSet, basename="group")
router.register(r"members", GroupMemberViewSet, basename="groupmember")
router.register(r"students", StudentViewSet, basename="student")
router.register(r"attendance", AttendanceViewSet, basename="attendance")

urlpatterns = [
    path("", include(router.urls)),
]
