"""Export URL patterns."""

from django.urls import path

from system.export_views import (
    LeaveRequestExportView,
    TimeEntryExportView,
    TransactionExportView,
)

urlpatterns = [
    path("transactions/", TransactionExportView.as_view(), name="export-transactions"),
    path("time-entries/", TimeEntryExportView.as_view(), name="export-time-entries"),
    path("leave-requests/", LeaveRequestExportView.as_view(), name="export-leave-requests"),
]
