"""
Admin panel URL configuration.

Routes for AuditLog and SystemSetting endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from admin_panel.views import AuditLogViewSet, OrganizationViewSet, SystemSettingViewSet

app_name = "admin_panel"

router = DefaultRouter()
router.register(r"audit-logs", AuditLogViewSet, basename="auditlog")
router.register(r"settings", SystemSettingViewSet, basename="systemsetting")
router.register(r"organizations", OrganizationViewSet, basename="organization")

urlpatterns = [
    path("", include(router.urls)),
]
