"""
URL configuration for Kassenbuch App v2.

Includes all API routes under /api/v1/ and the OpenAPI/Swagger documentation.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)

urlpatterns = [
    # Django Admin (Unfold)
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/auth/", include("core.urls.auth_urls")),
    path("api/v1/users/", include("core.urls.user_urls")),
    path("api/v1/finance/", include("finance.urls")),
    path("api/v1/timetracking/", include("timetracking.urls")),
    path("api/v1/groups/", include("groups.urls")),
    path("api/v1/admin/", include("admin_panel.urls")),
    path("api/v1/system/", include("system.urls")),
    path("api/v1/export/", include("system.urls_export")),
    # OpenAPI Schema
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    # Swagger UI
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # ReDoc
    path(
        "api/redoc/",
        SpectacularRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    # Health Check
    path("api/health/", include("system.urls_health")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

from django.http import HttpResponse

urlpatterns.append(path("api/health-check/", lambda request: HttpResponse("OK")))
