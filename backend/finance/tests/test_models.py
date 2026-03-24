"""
Tests for Finance models: TransactionCategory, Transaction, Receipt.
"""

import pytest
from datetime import date, time
from decimal import Decimal

from django.core.exceptions import ValidationError
from django.db import IntegrityError

from core.models import Organization, Location, User
from groups.models import SchoolYear, Group
from finance.models import TransactionCategory, Transaction, Receipt


@pytest.fixture
def organization(db):
    """Create a test organization."""
    return Organization.objects.create(
        name="Test Organisation",
        email="org@test.at",
        street="Teststr. 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def location(organization):
    """Create a test location."""
    return Location.objects.create(
        organization=organization,
        name="Test Standort",
        email="standort@test.at",
        street="Standortstr. 1",
        city="Wien",
        postal_code="1010",
    )


@pytest.fixture
def educator(location):
    """Create a test educator user."""
    return User.objects.create_user(
        username="educator_finance",
        email="educator_finance@test.at",
        password="testpass123",
        first_name="Test",
        last_name="Educator",
        role=User.Role.EDUCATOR,
        location=location,
    )


@pytest.fixture
def school_year(location):
    """Create a test school year."""
    return SchoolYear.objects.create(
        location=location,
        name="2025/2026",
        start_date=date(2025, 9, 1),
        end_date=date(2026, 7, 31),
        is_active=True,
    )


@pytest.fixture
def group(location, school_year, educator):
    """Create a test group."""
    return Group.objects.create(
        location=location,
        school_year=school_year,
        name="Testgruppe",
        leader=educator,
    )


@pytest.fixture
def income_category(location):
    """Create an income category."""
    return TransactionCategory.objects.create(
        location=location,
        name="Elternbeitraege",
        category_type=TransactionCategory.CategoryType.INCOME,
        color="#00FF00",
    )


@pytest.fixture
def expense_category(location):
    """Create an expense category."""
    return TransactionCategory.objects.create(
        location=location,
        name="Bastelmaterial",
        category_type=TransactionCategory.CategoryType.EXPENSE,
        color="#FF0000",
    )


class TestTransactionCategoryModel:
    """Tests for TransactionCategory model."""

    def test_create_income_category(self, income_category):
        assert income_category.name == "Elternbeitraege"
        assert income_category.category_type == "income"
        assert income_category.color == "#00FF00"
        assert income_category.is_active is True
        assert income_category.is_system_category is False

    def test_create_expense_category(self, expense_category):
        assert expense_category.name == "Bastelmaterial"
        assert expense_category.category_type == "expense"

    def test_category_str(self, income_category):
        assert "Elternbeitraege" in str(income_category)
        assert "Einnahme" in str(income_category)

    def test_unique_together(self, location, income_category):
        """Same name + type + location should fail."""
        with pytest.raises(IntegrityError):
            TransactionCategory.objects.create(
                location=location,
                name="Elternbeitraege",
                category_type=TransactionCategory.CategoryType.INCOME,
            )

    def test_same_name_different_type(self, location):
        """Same name but different type should work."""
        TransactionCategory.objects.create(
            location=location,
            name="Sonstiges",
            category_type=TransactionCategory.CategoryType.INCOME,
        )
        TransactionCategory.objects.create(
            location=location,
            name="Sonstiges",
            category_type=TransactionCategory.CategoryType.EXPENSE,
        )
        assert TransactionCategory.objects.filter(name="Sonstiges").count() == 2


class TestTransactionModel:
    """Tests for Transaction model."""

    def test_create_income_transaction(self, group, income_category, educator):
        txn = Transaction.objects.create(
            group=group,
            category=income_category,
            description="Elternbeitrag Maerz",
            amount=Decimal("50.00"),
            transaction_type=Transaction.TransactionType.INCOME,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        assert txn.amount == Decimal("50.00")
        assert txn.status == "pending"
        assert txn.transaction_type == "income"

    def test_create_expense_transaction(self, group, expense_category, educator):
        txn = Transaction.objects.create(
            group=group,
            category=expense_category,
            description="Bastelmaterial Einkauf",
            amount=Decimal("25.50"),
            transaction_type=Transaction.TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        assert txn.amount == Decimal("25.50")
        assert txn.transaction_type == "expense"

    def test_transaction_str(self, group, income_category, educator):
        txn = Transaction.objects.create(
            group=group,
            category=income_category,
            description="Test",
            amount=Decimal("10.00"),
            transaction_type=Transaction.TransactionType.INCOME,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        assert "+" in str(txn)
        assert "10.00" in str(txn)

    def test_transaction_default_status(self, group, educator):
        txn = Transaction.objects.create(
            group=group,
            description="Test",
            amount=Decimal("10.00"),
            transaction_type=Transaction.TransactionType.INCOME,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        assert txn.status == Transaction.Status.PENDING

    def test_transaction_approval(self, group, educator, location):
        manager = User.objects.create_user(
            username="manager_finance",
            email="manager_finance@test.at",
            password="testpass123",
            role=User.Role.LOCATION_MANAGER,
            location=location,
        )
        txn = Transaction.objects.create(
            group=group,
            description="Genehmigungstest",
            amount=Decimal("100.00"),
            transaction_type=Transaction.TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        from django.utils import timezone

        txn.status = Transaction.Status.APPROVED
        txn.approved_by = manager
        txn.approved_at = timezone.now()
        txn.save()
        txn.refresh_from_db()
        assert txn.status == "approved"
        assert txn.approved_by == manager

    def test_transaction_with_time(self, group, educator):
        txn = Transaction.objects.create(
            group=group,
            description="Mit Zeit",
            amount=Decimal("10.00"),
            transaction_type=Transaction.TransactionType.INCOME,
            transaction_date=date(2026, 3, 1),
            transaction_time=time(14, 30),
            created_by=educator,
        )
        assert txn.transaction_time == time(14, 30)


class TestReceiptModel:
    """Tests for Receipt model."""

    def test_create_receipt(self, group, educator):
        txn = Transaction.objects.create(
            group=group,
            description="Beleg-Test",
            amount=Decimal("20.00"),
            transaction_type=Transaction.TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        receipt = Receipt.objects.create(
            transaction=txn,
            file="receipts/2026/03/test.pdf",
            file_name="test.pdf",
            file_size=1024,
            file_type="application/pdf",
            uploaded_by=educator,
        )
        assert receipt.file_name == "test.pdf"
        assert receipt.file_size == 1024
        assert receipt.file_type == "application/pdf"

    def test_receipt_str(self, group, educator):
        txn = Transaction.objects.create(
            group=group,
            description="Str-Test",
            amount=Decimal("10.00"),
            transaction_type=Transaction.TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        receipt = Receipt.objects.create(
            transaction=txn,
            file="receipts/2026/03/rechnung.pdf",
            file_name="rechnung.pdf",
            file_size=2048,
            file_type="application/pdf",
            uploaded_by=educator,
        )
        assert "rechnung.pdf" in str(receipt)

    def test_multiple_receipts_per_transaction(self, group, educator):
        txn = Transaction.objects.create(
            group=group,
            description="Multi-Beleg",
            amount=Decimal("50.00"),
            transaction_type=Transaction.TransactionType.EXPENSE,
            transaction_date=date(2026, 3, 1),
            created_by=educator,
        )
        for i in range(3):
            Receipt.objects.create(
                transaction=txn,
                file=f"receipts/2026/03/beleg_{i}.jpg",
                file_name=f"beleg_{i}.jpg",
                file_size=512 * (i + 1),
                file_type="image/jpeg",
                uploaded_by=educator,
            )
        assert txn.receipts.count() == 3
