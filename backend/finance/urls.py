"""
Finance URL configuration.

Routes for TransactionCategory, Transaction, and Receipt endpoints.
"""

from django.urls import include, path
from rest_framework.routers import DefaultRouter

from finance.views import ReceiptViewSet, TransactionCategoryViewSet, TransactionViewSet

app_name = "finance"

router = DefaultRouter()
router.register(r"categories", TransactionCategoryViewSet, basename="category")
router.register(r"transactions", TransactionViewSet, basename="transaction")
router.register(r"receipts", ReceiptViewSet, basename="receipt")

urlpatterns = [
    path("", include(router.urls)),
]
