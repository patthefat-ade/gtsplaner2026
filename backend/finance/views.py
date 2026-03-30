"""
Finance API views: TransactionCategory, Transaction, Receipt ViewSets.

Includes CRUD operations, approval workflow actions, receipt upload,
and group balance endpoint.

All ViewSets use TenantViewSetMixin for automatic organization-based
data isolation and permission-based access control.
"""

import csv
import io
from decimal import Decimal

from django.db.models import Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from django_filters import rest_framework as django_filters
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response

from core.mixins import TenantViewSetMixin
from core.mixins_export import ExportMixin
from core.permissions import (
    IsEducator,
    IsLocationManagerOrAbove,
    require_permission,
)
from finance.models import Receipt, Transaction, TransactionCategory
from finance.serializers import (
    GroupBalanceSerializer,
    ReceiptSerializer,
    ReceiptUploadSerializer,
    TransactionApprovalSerializer,
    TransactionCategoryCreateSerializer,
    TransactionCategoryListSerializer,
    TransactionCreateSerializer,
    TransactionDetailSerializer,
    TransactionListSerializer,
    TransactionUpdateSerializer,
)


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class TransactionFilter(django_filters.FilterSet):
    """Filter for transactions."""

    group_id = django_filters.NumberFilter(field_name="group_id")
    category_id = django_filters.NumberFilter(field_name="category_id")
    location_id = django_filters.NumberFilter(
        field_name="group__location_id",
        label="Standort-ID",
    )
    status = django_filters.ChoiceFilter(choices=Transaction.Status.choices)
    transaction_type = django_filters.ChoiceFilter(
        choices=Transaction.TransactionType.choices
    )
    start_date = django_filters.DateFilter(
        field_name="transaction_date", lookup_expr="gte"
    )
    end_date = django_filters.DateFilter(
        field_name="transaction_date", lookup_expr="lte"
    )
    school_year_id = django_filters.NumberFilter(
        field_name="school_year_id",
        label="Schuljahr-ID",
    )

    class Meta:
        model = Transaction
        fields = [
            "group_id",
            "category_id",
            "location_id",
            "school_year_id",
            "status",
            "transaction_type",
            "start_date",
            "end_date",
        ]


class TransactionCategoryFilter(django_filters.FilterSet):
    """Filter for transaction categories."""

    category_type = django_filters.ChoiceFilter(
        choices=TransactionCategory.CategoryType.choices
    )
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = TransactionCategory
        fields = ["category_type", "is_active"]


# ---------------------------------------------------------------------------
# TransactionCategory ViewSet
# ---------------------------------------------------------------------------

class TransactionCategoryViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for transaction categories.

    - Educators: read-only access to categories of their location
    - LocationManager+: full CRUD for their location's categories
    - Tenant isolation via TenantViewSetMixin
    """

    queryset = TransactionCategory.objects.all()
    filterset_class = TransactionCategoryFilter
    search_fields = ["name", "description"]
    ordering_fields = ["name", "category_type", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return TransactionCategory.objects.none()
        qs = super().get_queryset()
        return qs.filter(is_deleted=False).select_related("location")

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return TransactionCategoryCreateSerializer
        return TransactionCategoryListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [
            permissions.IsAuthenticated(),
            require_permission("manage_categories")(),
        ]

    def perform_create(self, serializer):
        serializer.save(
            location=self.request.user.location,
            organization=self.request.tenant,
        )

    def perform_destroy(self, instance):
        if instance.is_system_category:
            return Response(
                {"detail": "Systemkategorien koennen nicht geloescht werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        instance.is_deleted = True
        instance.is_active = False
        instance.save()


# ---------------------------------------------------------------------------
# Transaction ViewSet
# ---------------------------------------------------------------------------

class TransactionViewSet(ExportMixin, TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for financial transactions with approval workflow.

    - Educators: CRUD for own transactions in their groups
    - LocationManager+: approve/reject, view all in their location
    - Admin/SuperAdmin: full access within tenant
    - Tenant isolation via TenantViewSetMixin
    """

    queryset = Transaction.objects.all()
    filterset_class = TransactionFilter
    search_fields = ["description", "internal_notes", "approval_notes"]
    ordering_fields = [
        "transaction_date",
        "amount",
        "created_at",
        "status",
    ]
    ordering = ["-transaction_date"]

    # ExportMixin configuration
    export_fields = [
        {"key": "id", "label": "ID", "width": 8},
        {"key": "transaction_date", "label": "Datum", "width": 14},
        {"key": "description", "label": "Beschreibung", "width": 30},
        {"key": "get_transaction_type_display", "label": "Typ", "width": 12},
        {"key": "amount", "label": "Betrag (EUR)", "width": 14},
        {"key": "category.name", "label": "Kategorie", "width": 18},
        {"key": "group.name", "label": "Gruppe", "width": 18},
        {"key": "get_status_display", "label": "Status", "width": 14},
        {"key": "created_by.first_name", "label": "Erstellt von", "width": 16},
    ]
    export_filename = "transaktionen"
    export_title = "Transaktionen"

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Transaction.objects.none()
        # Start with tenant-filtered queryset
        qs = super().get_queryset()
        qs = qs.filter(is_deleted=False).select_related(
            "group",
            "category",
            "created_by",
            "approved_by",
        )

        user = self.request.user
        # Within the tenant, further filter by role
        from core.permissions import get_user_hierarchy_level, GROUP_HIERARCHY, GROUP_LOCATION_MANAGER
        level = get_user_hierarchy_level(user)

        if level >= GROUP_HIERARCHY[GROUP_LOCATION_MANAGER]:
            # LocationManager+: all transactions in tenant
            return qs
        # Educators: only transactions in their groups
        return qs.filter(
            Q(created_by=user) | Q(group__members__user=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action == "create":
            return TransactionCreateSerializer
        if self.action in ["update", "partial_update"]:
            return TransactionUpdateSerializer
        if self.action in ["approve", "reject"]:
            return TransactionApprovalSerializer
        if self.action == "retrieve":
            return TransactionDetailSerializer
        return TransactionListSerializer

    def get_permissions(self):
        if self.action in ["approve", "reject"]:
            return [
                permissions.IsAuthenticated(),
                require_permission("approve_transactions")(),
            ]
        return [permissions.IsAuthenticated(), IsEducator()]

    def perform_create(self, serializer):
        serializer.save(
            created_by=self.request.user,
            organization=self.request.tenant,
        )

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        """Approve a pending transaction."""
        transaction = self.get_object()
        if transaction.status != Transaction.Status.PENDING:
            return Response(
                {"detail": "Nur ausstehende Transaktionen koennen genehmigt werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction.status = Transaction.Status.APPROVED
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.approval_notes = serializer.validated_data.get(
            "approval_notes", ""
        )
        transaction.save()

        # Update group balance
        group = transaction.group
        if transaction.transaction_type == Transaction.TransactionType.INCOME:
            group.balance += transaction.amount
        else:
            group.balance -= transaction.amount
        group.save()

        return Response(
            TransactionDetailSerializer(
                transaction, context={"request": request}
            ).data
        )

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        """Reject a pending transaction."""
        transaction = self.get_object()
        if transaction.status != Transaction.Status.PENDING:
            return Response(
                {"detail": "Nur ausstehende Transaktionen koennen abgelehnt werden."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        transaction.status = Transaction.Status.REJECTED
        transaction.approved_by = request.user
        transaction.approved_at = timezone.now()
        transaction.approval_notes = serializer.validated_data.get(
            "approval_notes", ""
        )
        transaction.save()

        return Response(
            TransactionDetailSerializer(
                transaction, context={"request": request}
            ).data
        )

    @action(
        detail=True,
        methods=["get", "post"],
        url_path="receipts",
        parser_classes=[MultiPartParser, FormParser],
    )
    def receipts(self, request, pk=None):
        """List or upload receipts for a transaction."""
        transaction = self.get_object()

        if request.method == "GET":
            receipts_qs = transaction.receipts.filter(is_deleted=False)
            serializer = ReceiptSerializer(
                receipts_qs, many=True, context={"request": request}
            )
            return Response(serializer.data)

        # POST: Upload receipt
        serializer = ReceiptUploadSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(
            transaction=transaction,
            uploaded_by=request.user,
            organization=self.request.tenant,
        )
        return Response(
            ReceiptSerializer(
                serializer.instance, context={"request": request}
            ).data,
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="balance/(?P<group_id>[^/.]+)")
    def balance(self, request, group_id=None):
        """Get balance summary for a specific group."""
        from groups.models import Group

        try:
            group = Group.objects.get(pk=group_id, is_deleted=False)
        except Group.DoesNotExist:
            return Response(
                {"detail": "Gruppe nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Verify tenant access
        if (
            not request.is_cross_tenant
            and request.tenant_ids
            and group.organization_id not in request.tenant_ids
        ):
            return Response(
                {"detail": "Zugriff verweigert."},
                status=status.HTTP_403_FORBIDDEN,
            )

        approved_txns = Transaction.objects.filter(
            group=group,
            status=Transaction.Status.APPROVED,
            is_deleted=False,
        )

        total_income = (
            approved_txns.filter(
                transaction_type=Transaction.TransactionType.INCOME
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        total_expenses = (
            approved_txns.filter(
                transaction_type=Transaction.TransactionType.EXPENSE
            ).aggregate(total=Sum("amount"))["total"]
            or Decimal("0.00")
        )
        last_txn = approved_txns.order_by("-transaction_date").first()

        data = {
            "group_id": group.id,
            "group_name": group.name,
            "balance": group.balance,
            "currency": group.currency,
            "total_income": total_income,
            "total_expenses": total_expenses,
            "last_transaction_date": (
                last_txn.transaction_date if last_txn else None
            ),
            "transaction_count": approved_txns.count(),
        }
        serializer = GroupBalanceSerializer(data)
        return Response(serializer.data)

    @action(detail=False, methods=["get"], url_path="monthly-summary")
    def monthly_summary(self, request):
        """Monatliche Buchhaltungs-Zusammenfassung: Barbestand, Einnahmen, Ausgaben."""
        year = int(request.query_params.get("year", timezone.now().year))
        group_id = request.query_params.get("group_id")
        location_id = request.query_params.get("location_id")

        qs = self.get_queryset().filter(
            status=Transaction.Status.APPROVED,
            transaction_date__year=year,
        )
        if group_id:
            qs = qs.filter(group_id=group_id)
        if location_id:
            qs = qs.filter(group__location_id=location_id)

        # Aggregate per month
        from django.db.models.functions import ExtractMonth
        monthly_income = (
            qs.filter(transaction_type=Transaction.TransactionType.INCOME)
            .annotate(month=ExtractMonth("transaction_date"))
            .values("month")
            .annotate(total=Sum("amount"))
        )
        monthly_expense = (
            qs.filter(transaction_type=Transaction.TransactionType.EXPENSE)
            .annotate(month=ExtractMonth("transaction_date"))
            .values("month")
            .annotate(total=Sum("amount"))
        )

        income_map = {r["month"]: float(r["total"]) for r in monthly_income}
        expense_map = {r["month"]: float(r["total"]) for r in monthly_expense}

        # Build monthly data with running balance
        months = []
        running_balance = Decimal("0.00")

        # Get opening balance from group if specific group
        opening_balance = Decimal("0.00")
        if group_id:
            from groups.models import Group
            try:
                group = Group.objects.get(pk=group_id)
                # Calculate opening balance: current balance minus all approved transactions in/after this year
                year_txns = Transaction.objects.filter(
                    group=group,
                    status=Transaction.Status.APPROVED,
                    is_deleted=False,
                    transaction_date__year__gte=year,
                )
                year_income = float(
                    year_txns.filter(transaction_type=Transaction.TransactionType.INCOME)
                    .aggregate(t=Sum("amount"))["t"] or 0
                )
                year_expense = float(
                    year_txns.filter(transaction_type=Transaction.TransactionType.EXPENSE)
                    .aggregate(t=Sum("amount"))["t"] or 0
                )
                opening_balance = group.balance - Decimal(str(year_income)) + Decimal(str(year_expense))
            except Group.DoesNotExist:
                pass

        running_balance = opening_balance
        month_names = [
            "Jaenner", "Februar", "Maerz", "April", "Mai", "Juni",
            "Juli", "August", "September", "Oktober", "November", "Dezember",
        ]
        for m in range(1, 13):
            income = income_map.get(m, 0.0)
            expense = expense_map.get(m, 0.0)
            month_opening = float(running_balance)
            running_balance += Decimal(str(income)) - Decimal(str(expense))
            # Count transactions for this month
            month_txn_count = qs.filter(transaction_date__month=m).count()
            months.append({
                "month": m,
                "month_name": month_names[m - 1],
                "month_label": month_names[m - 1],
                "income": round(income, 2),
                "expense": round(expense, 2),
                "expenses": round(expense, 2),
                "net": round(income - expense, 2),
                "running_balance": round(float(running_balance), 2),
                "opening_balance": round(month_opening, 2),
                "closing_balance": round(float(running_balance), 2),
                "transaction_count": month_txn_count,
            })

        # Totals
        total_income = sum(income_map.values())
        total_expense = sum(expense_map.values())

        return Response({
            "year": year,
            "opening_balance": round(float(opening_balance), 2),
            "total_income": round(total_income, 2),
            "total_expense": round(total_expense, 2),
            "total_expenses": round(total_expense, 2),
            "net_result": round(total_income - total_expense, 2),
            "closing_balance": round(float(running_balance), 2),
            "months": months,
            "transaction_count": qs.count(),
        })

    @action(
        detail=False,
        methods=["get"],
        url_path="export-csv",
        permission_classes=[permissions.IsAuthenticated, IsLocationManagerOrAbove],
    )
    def export_csv(self, request):
        """Export transactions as CSV file with tenant-filtered data."""
        qs = self.get_queryset().select_related(
            "group", "group__location", "category", "created_by"
        ).order_by("-transaction_date")

        # Apply same filters as list
        filterset = TransactionFilter(request.query_params, queryset=qs)
        if filterset.is_valid():
            qs = filterset.qs

        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="transaktionen.csv"'
        # BOM for Excel UTF-8 compatibility
        response.write("\ufeff")

        writer = csv.writer(response, delimiter=";")
        writer.writerow([
            "ID",
            "Datum",
            "Beschreibung",
            "Typ",
            "Betrag",
            "Kategorie",
            "Gruppe",
            "Standort",
            "Status",
            "Erstellt von",
            "Erstellt am",
        ])

        type_labels = {
            "income": "Einnahme",
            "expense": "Ausgabe",
        }
        status_labels = {
            "pending": "Ausstehend",
            "approved": "Genehmigt",
            "rejected": "Abgelehnt",
        }

        for tx in qs:
            writer.writerow([
                tx.id,
                tx.transaction_date.strftime("%d.%m.%Y") if tx.transaction_date else "",
                tx.description or "",
                type_labels.get(tx.transaction_type, tx.transaction_type),
                str(tx.amount).replace(".", ","),
                tx.category.name if tx.category else "",
                tx.group.name if tx.group else "",
                tx.group.location.name if tx.group and tx.group.location else "",
                status_labels.get(tx.status, tx.status),
                f"{tx.created_by.first_name} {tx.created_by.last_name}" if tx.created_by else "",
                tx.created_at.strftime("%d.%m.%Y %H:%M") if tx.created_at else "",
            ])

        return response


# ---------------------------------------------------------------------------
# Receipt ViewSet (standalone for delete)
# ---------------------------------------------------------------------------

class ReceiptViewSet(TenantViewSetMixin, viewsets.GenericViewSet):
    """
    Standalone receipt operations (retrieve, delete).

    Receipts are primarily managed through the Transaction receipts action.
    """

    queryset = Receipt.objects.all()
    serializer_class = ReceiptSerializer
    permission_classes = [permissions.IsAuthenticated, IsEducator]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Receipt.objects.none()
        qs = super().get_queryset()
        return qs.filter(is_deleted=False).select_related(
            "transaction", "uploaded_by"
        )

    def retrieve(self, request, pk=None):
        receipt = self.get_object()
        serializer = self.get_serializer(receipt)
        return Response(serializer.data)

    def destroy(self, request, pk=None):
        receipt = self.get_object()
        receipt.is_deleted = True
        receipt.save()
        return Response(status=status.HTTP_204_NO_CONTENT)
