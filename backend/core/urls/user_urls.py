"""
User management URL configuration.

Routes for UserViewSet (admin CRUD operations).
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core.views_users import UserViewSet

app_name = "users"

router = DefaultRouter()
router.register(r"", UserViewSet, basename="user")

urlpatterns = [
    path("", include(router.urls)),
]
