"""
GDPR/DSGVO API URL configuration.

All endpoints require SuperAdmin permissions.
"""

from django.urls import path

from system.views_gdpr import (
    AnonymizeStudentView,
    AnonymizeUserView,
    ExportStudentDataView,
    ExportUserDataView,
    GDPRRetentionConfigView,
    GDPRRetentionStatsView,
)

urlpatterns = [
    # Anonymization
    path(
        "anonymize-user/<int:user_id>/",
        AnonymizeUserView.as_view(),
        name="gdpr-anonymize-user",
    ),
    path(
        "anonymize-student/<int:student_id>/",
        AnonymizeStudentView.as_view(),
        name="gdpr-anonymize-student",
    ),
    # Data Export (Auskunftsanfrage)
    path(
        "export-user/<int:user_id>/",
        ExportUserDataView.as_view(),
        name="gdpr-export-user",
    ),
    path(
        "export-student/<int:student_id>/",
        ExportStudentDataView.as_view(),
        name="gdpr-export-student",
    ),
    # Statistics & Configuration
    path("stats/", GDPRRetentionStatsView.as_view(), name="gdpr-stats"),
    path(
        "retention-config/",
        GDPRRetentionConfigView.as_view(),
        name="gdpr-retention-config",
    ),
]
