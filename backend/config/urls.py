"""
URL configuration for Kassenbuch App v2.

Includes all API routes under /api/v1/ and the OpenAPI/Swagger documentation.
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)


def health_check(request):
    """Simple health check endpoint for DigitalOcean App Platform."""
    return JsonResponse({"status": "ok", "service": "gtsplaner-backend"})


def root_view(request):
    """Root endpoint – confirms the API is running."""
    return JsonResponse({
        "service": "GTS Planer API",
        "version": "2.0.0",
        "docs": "/api/docs/",
        "health": "/api/health-check/",
    })


urlpatterns = [
    # Root
    path("", root_view, name="root"),
    # Health Check (used by DigitalOcean)
    path("api/health-check/", health_check, name="health-check"),
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
    # Health Check (system module)
    path("api/health/", include("system.urls_health")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
