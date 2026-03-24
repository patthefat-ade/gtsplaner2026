"""
API tests for Finance endpoints: TransactionCategory, Transaction, Receipt.

Tests CRUD operations, approval workflow, receipt upload, balance endpoint,
and RBAC-based access control.
"""

import io
from decimal import Decimal

from django.test import TestCase
from django.urls import reverse
from PIL import Image
from rest_framework import status
from rest_framework.test import APIClient

from core.models import Location, Organization, User
from finance.models import Receipt, Transaction, TransactionCategory
from groups.models import Group, GroupMember, SchoolYear


class FinanceAPITestBase(TestCase):
    """Base class with shared setup for finance API tests."""

    def setUp(self):
        self.client = APIClient()
        self.org = Organization.objects.create(name="Test Org")
        self.location = Location.objects.create(
            name="Test Standort",
            organization=self.org,
            city="Wien",
            postal_code="1010",
            street="Teststr 1",
        )
        # Users
        self.educator = User.objects.create_user(
            username="educator",
            password="TestPass123!",
            role="educator",
            location=self.location,
            first_name="Test",
            last_name="Educator",
        )
        self.manager = User.objects.create_user(
            username="manager",
            password="TestPass123!",
            role="location_manager",
            location=self.location,
            first_name="Test",
            last_name="Manager",
        )
        self.admin = User.objects.create_user(
            username="admin",
            password="TestPass123!",
            role="admin",
            location=self.location,
            first_name="Test",
            last_name="Admin",
        )
        # School Year & Group
        self.school_year = SchoolYear.objects.create(
            name="2025/2026",
            location=self.location,
            start_date="2025-09-01",
            end_date="2026-06-30",
        )
        self.group = Group.objects.create(
            name="Testgruppe",
            location=self.location,
            school_year=self.school_year,
            leader=self.educator,
            balance=Decimal("100.00"),
        )
        GroupMember.objects.create(
            group=self.group, user=self.educator, role="leader"
        )
        # Category
        self.category = TransactionCategory.objects.create(
            name="Material",
            location=self.location,
            category_type="expense",
        )


class TransactionCategoryAPITest(FinanceAPITestBase):
    """Tests for TransactionCategory CRUD."""

    def test_list_categories_as_educator(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/finance/categories/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_create_category_as_educator_forbidden(self):
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/finance/categories/",
            {"name": "Neue Kategorie", "category_type": "income"},
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_category_as_manager(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            "/api/v1/finance/categories/",
            {"name": "Spenden", "category_type": "income"},
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(resp.data["name"], "Spenden")

    def test_update_category(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.patch(
            f"/api/v1/finance/categories/{self.category.id}/",
            {"name": "Material (aktualisiert)"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.category.refresh_from_db()
        self.assertEqual(self.category.name, "Material (aktualisiert)")

    def test_delete_category_soft_delete(self):
        self.client.force_authenticate(user=self.manager)
        resp = self.client.delete(
            f"/api/v1/finance/categories/{self.category.id}/"
        )
        self.assertEqual(resp.status_code, status.HTTP_204_NO_CONTENT)
        self.category.refresh_from_db()
        self.assertTrue(self.category.is_deleted)

    def test_filter_categories_by_type(self):
        TransactionCategory.objects.create(
            name="Spenden", location=self.location, category_type="income"
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            "/api/v1/finance/categories/", {"category_type": "income"}
        )
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["name"], "Spenden")

    def test_unauthenticated_access_denied(self):
        resp = self.client.get("/api/v1/finance/categories/")
        self.assertEqual(resp.status_code, status.HTTP_401_UNAUTHORIZED)


class TransactionAPITest(FinanceAPITestBase):
    """Tests for Transaction CRUD and approval workflow."""

    def test_create_transaction(self):
        """Transaction default status is 'pending' (from model default)."""
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            "/api/v1/finance/transactions/",
            {
                "group": self.group.id,
                "category": self.category.id,
                "transaction_type": "expense",
                "amount": "25.50",
                "description": "Bastelmaterial",
                "transaction_date": "2026-03-01",
            },
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        # The create serializer doesn't return status, so check the DB
        txn = Transaction.objects.first()
        self.assertEqual(txn.status, "pending")
        self.assertEqual(txn.created_by, self.educator)

    def test_list_transactions(self):
        Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("10.00"),
            description="Test",
            transaction_date="2026-03-01",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get("/api/v1/finance/transactions/")
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(resp.data["count"], 1)

    def test_approve_transaction(self):
        txn = Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="income",
            amount=Decimal("50.00"),
            description="Elternbeitrag",
            transaction_date="2026-03-01",
            status="pending",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/v1/finance/transactions/{txn.id}/approve/",
            {"approval_notes": "Genehmigt"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        self.assertEqual(txn.status, "approved")
        self.assertEqual(txn.approved_by, self.manager)
        # Balance should be updated
        self.group.refresh_from_db()
        self.assertEqual(self.group.balance, Decimal("150.00"))

    def test_reject_transaction(self):
        txn = Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("30.00"),
            description="Abgelehnt",
            transaction_date="2026-03-01",
            status="pending",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/v1/finance/transactions/{txn.id}/reject/",
            {"approval_notes": "Nicht genehmigt"},
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        txn.refresh_from_db()
        self.assertEqual(txn.status, "rejected")

    def test_approve_non_pending_fails(self):
        txn = Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("10.00"),
            description="Approved already",
            transaction_date="2026-03-01",
            status="approved",
        )
        self.client.force_authenticate(user=self.manager)
        resp = self.client.post(
            f"/api/v1/finance/transactions/{txn.id}/approve/", {}
        )
        self.assertEqual(resp.status_code, status.HTTP_400_BAD_REQUEST)

    def test_educator_cannot_approve(self):
        txn = Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("10.00"),
            description="Test",
            transaction_date="2026-03-01",
            status="pending",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            f"/api/v1/finance/transactions/{txn.id}/approve/", {}
        )
        self.assertEqual(resp.status_code, status.HTTP_403_FORBIDDEN)

    def test_filter_transactions_by_status(self):
        Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("10.00"),
            description="Pending",
            transaction_date="2026-03-01",
            status="pending",
        )
        Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("20.00"),
            description="Approved",
            transaction_date="2026-03-01",
            status="approved",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            "/api/v1/finance/transactions/", {"status": "pending"}
        )
        self.assertEqual(resp.data["count"], 1)
        self.assertEqual(resp.data["results"][0]["description"], "Pending")

    def test_balance_endpoint(self):
        Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="income",
            amount=Decimal("100.00"),
            description="Einnahme",
            transaction_date="2026-03-01",
            status="approved",
        )
        Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("30.00"),
            description="Ausgabe",
            transaction_date="2026-03-01",
            status="approved",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            f"/api/v1/finance/transactions/balance/{self.group.id}/"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(Decimal(resp.data["total_income"]), Decimal("100.00"))
        self.assertEqual(Decimal(resp.data["total_expenses"]), Decimal("30.00"))
        self.assertEqual(resp.data["transaction_count"], 2)

    def test_receipt_upload(self):
        txn = Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("10.00"),
            description="Mit Beleg",
            transaction_date="2026-03-01",
        )
        # Create a test image
        image = Image.new("RGB", (100, 100), color="red")
        buf = io.BytesIO()
        image.save(buf, format="JPEG")
        buf.seek(0)
        buf.name = "beleg.jpg"

        self.client.force_authenticate(user=self.educator)
        resp = self.client.post(
            f"/api/v1/finance/transactions/{txn.id}/receipts/",
            {"file": buf, "description": "Kassenbon"},
            format="multipart",
        )
        self.assertEqual(resp.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Receipt.objects.count(), 1)

    def test_list_receipts(self):
        txn = Transaction.objects.create(
            group=self.group,
            category=self.category,
            created_by=self.educator,
            transaction_type="expense",
            amount=Decimal("10.00"),
            description="Test",
            transaction_date="2026-03-01",
        )
        Receipt.objects.create(
            transaction=txn,
            uploaded_by=self.educator,
            file="receipts/test.jpg",
            file_name="test.jpg",
            file_size=1024,
            file_type="image/jpeg",
            description="Beleg 1",
        )
        self.client.force_authenticate(user=self.educator)
        resp = self.client.get(
            f"/api/v1/finance/transactions/{txn.id}/receipts/"
        )
        self.assertEqual(resp.status_code, status.HTTP_200_OK)
        self.assertEqual(len(resp.data), 1)
