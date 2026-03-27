"""
URL configuration for Location API endpoints.

Routes:
    GET    /api/v1/locations/              – List locations
    POST   /api/v1/locations/              – Create location
    GET    /api/v1/locations/{id}/          – Retrieve location
    PUT    /api/v1/locations/{id}/          – Update location
    PATCH  /api/v1/locations/{id}/          – Partial update location
    DELETE /api/v1/locations/{id}/          – Delete location (soft)
    GET    /api/v1/locations/{id}/groups/   – List groups at location
    GET    /api/v1/locations/{id}/stats/    – Location statistics
    GET    /api/v1/locations/{id}/educators/ – List educators at location
"""

from rest_framework.routers import DefaultRouter

from core.views_locations import LocationViewSet

router = DefaultRouter()
router.register("", LocationViewSet, basename="location")

urlpatterns = router.urls
