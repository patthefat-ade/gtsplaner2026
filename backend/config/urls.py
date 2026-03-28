"""
URL configuration for Kassenbuch App v2.

Includes all API routes under /api/v1/ and the OpenAPI/Swagger documentation.
API documentation is restricted to authenticated staff users (is_staff=True).
"""

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.contrib.auth import views as auth_views
from django.http import JsonResponse
from django.urls import include, path
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularRedocView,
    SpectacularSwaggerView,
)
from rest_framework.permissions import IsAdminUser

from core.views_dashboard import DashboardStatsView


def health_check(request):
    """Simple health check endpoint for DigitalOcean App Platform."""
    return JsonResponse({"status": "ok", "service": "gtsplaner-backend"})


def debug_events(request):
    """Temporary debug endpoint for events 500 error."""
    import traceback
    try:
        from events.models import Event
        # Test basic query
        count = Event.objects.count()
        # Test annotated query
        from django.db.models import Count, Q
        qs = Event.objects.annotate(
            participant_count=Count(
                "participants",
                filter=Q(participants__is_deleted=False),
                distinct=True,
            ),
        )
        annotated_count = qs.count()
        first = None
        if annotated_count > 0:
            first = str(qs.first().title)
        return JsonResponse({
            "status": "ok",
            "count": count,
            "annotated_count": annotated_count,
            "first": first,
        })
    except Exception as e:
        return JsonResponse({
            "status": "error",
            "error": str(e),
            "traceback": traceback.format_exc(),
        }, status=500)


def root_view(request):
    """Root endpoint – confirms the API is running."""
    return JsonResponse({
        "service": "GTS Planer API",
        "version": "2.0.0",
        "health": "/api/health-check/",
    })


# Secured API documentation views – only accessible by staff users
class SecuredSchemaView(SpectacularAPIView):
    permission_classes = [IsAdminUser]


class SecuredSwaggerView(SpectacularSwaggerView):
    permission_classes = [IsAdminUser]


class SecuredRedocView(SpectacularRedocView):
    permission_classes = [IsAdminUser]


urlpatterns = [
    # Root
    path("", root_view, name="root"),
    # Health Check (used by DigitalOcean)
    path("api/health-check/", health_check, name="health-check"),
    path("api/debug-events/", debug_events, name="debug-events"),
    # Django Admin Password Reset (must be before admin/ to be resolved)
    path(
        "admin/password_reset/",
        auth_views.PasswordResetView.as_view(
            template_name="registration/password_reset_form.html",
            email_template_name="registration/password_reset_email.html",
            subject_template_name="registration/password_reset_subject.txt",
            success_url="/admin/password_reset/done/",
        ),
        name="admin_password_reset",
    ),
    path(
        "admin/password_reset/done/",
        auth_views.PasswordResetDoneView.as_view(
            template_name="registration/password_reset_done.html",
        ),
        name="password_reset_done",
    ),
    path(
        "admin/reset/<uidb64>/<token>/",
        auth_views.PasswordResetConfirmView.as_view(
            template_name="registration/password_reset_confirm.html",
            success_url="/admin/reset/done/",
        ),
        name="password_reset_confirm",
    ),
    path(
        "admin/reset/done/",
        auth_views.PasswordResetCompleteView.as_view(
            template_name="registration/password_reset_complete.html",
        ),
        name="password_reset_complete",
    ),
    # Django Admin (Unfold)
    path("admin/", admin.site.urls),
    # API v1
    path("api/v1/auth/", include("core.urls.auth_urls")),
    path("api/v1/users/", include("core.urls.user_urls")),
    path("api/v1/finance/", include("finance.urls")),
    path("api/v1/timetracking/", include("timetracking.urls")),
    path("api/v1/groups/", include("groups.urls")),
    path("api/v1/weeklyplans/", include("weeklyplans.urls")),
    path("api/v1/events/", include("events.urls")),
    path("api/v1/locations/", include("core.urls.location_urls")),
    path("api/v1/dashboard/stats/", DashboardStatsView.as_view(), name="dashboard-stats"),
    path("api/v1/admin/", include("admin_panel.urls")),
    path("api/v1/system/", include("system.urls")),
    path("api/v1/export/", include("system.urls_export")),
    path("api/v1/admin/gdpr/", include("system.urls_gdpr")),
    # OpenAPI Schema (secured – staff only)
    path("api/schema/", SecuredSchemaView.as_view(), name="schema"),
    # Swagger UI (secured – staff only)
    path(
        "api/docs/",
        SecuredSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    # ReDoc (secured – staff only)
    path(
        "api/redoc/",
        SecuredRedocView.as_view(url_name="schema"),
        name="redoc",
    ),
    # Health Check (system module)
    path("api/health/", include("system.urls_health")),
]

# Serve media files in development
if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
