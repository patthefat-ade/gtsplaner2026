"""
Serializers for Finance models: TransactionCategory, Transaction, Receipt.

Includes list/detail serializers, create/update serializers,
and approval action serializers.
"""

from rest_framework import serializers

from finance.models import Receipt, Transaction, TransactionCategory


# ---------------------------------------------------------------------------
# Nested / Compact Serializers (for embedding in other responses)
# ---------------------------------------------------------------------------

class FinanceUserCompactSerializer(serializers.Serializer):
    """Compact user representation for nested display."""

    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)


# ---------------------------------------------------------------------------
# TransactionCategory Serializers
# ---------------------------------------------------------------------------

class TransactionCategoryListSerializer(serializers.ModelSerializer):
    """Serializer for listing transaction categories."""

    class Meta:
        model = TransactionCategory
        fields = [
            "id",
            "name",
            "description",
            "category_type",
            "color",
            "icon",
            "is_system_category",
            "is_active",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]


class TransactionCategoryCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating transaction categories."""

    class Meta:
        model = TransactionCategory
        fields = [
            "id",
            "name",
            "description",
            "category_type",
            "color",
            "icon",
            "is_active",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs):
        """Ensure unique (location, name, category_type)."""
        request = self.context.get("request")
        if request and request.user and request.user.location:
            location = request.user.location
            name = attrs.get("name", getattr(self.instance, "name", None))
            cat_type = attrs.get(
                "category_type",
                getattr(self.instance, "category_type", None),
            )
            qs = TransactionCategory.objects.filter(
                location=location,
                name=name,
                category_type=cat_type,
                is_deleted=False,
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "Eine Kategorie mit diesem Namen und Typ existiert bereits."
                )
        return attrs


# ---------------------------------------------------------------------------
# Receipt Serializers
# ---------------------------------------------------------------------------

class ReceiptSerializer(serializers.ModelSerializer):
    """Serializer for receipt display."""

    uploaded_by = FinanceUserCompactSerializer(read_only=True)
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = Receipt
        fields = [
            "id",
            "file_url",
            "file_name",
            "file_size",
            "file_type",
            "uploaded_by",
            "description",
            "created_at",
        ]
        read_only_fields = ["id", "file_url", "file_name", "file_size", "file_type", "created_at"]

    def get_file_url(self, obj) -> str | None:
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class ReceiptUploadSerializer(serializers.ModelSerializer):
    """Serializer for uploading a receipt file."""

    class Meta:
        model = Receipt
        fields = ["file", "description"]

    def create(self, validated_data):
        file_obj = validated_data["file"]
        validated_data["file_name"] = file_obj.name
        validated_data["file_size"] = file_obj.size
        validated_data["file_type"] = file_obj.content_type or "application/octet-stream"
        return super().create(validated_data)


# ---------------------------------------------------------------------------
# Transaction Serializers
# ---------------------------------------------------------------------------

class TransactionListSerializer(serializers.ModelSerializer):
    """Serializer for listing transactions (compact)."""

    group_name = serializers.CharField(source="group.name", read_only=True)
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )
    created_by = FinanceUserCompactSerializer(read_only=True)
    approved_by = FinanceUserCompactSerializer(read_only=True)
    receipt_count = serializers.IntegerField(
        source="receipts.count", read_only=True
    )

    class Meta:
        model = Transaction
        fields = [
            "id",
            "group",
            "group_name",
            "category",
            "category_name",
            "description",
            "amount",
            "transaction_type",
            "transaction_date",
            "transaction_time",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "receipt_count",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "created_at",
        ]


class TransactionDetailSerializer(serializers.ModelSerializer):
    """Serializer for transaction detail view (includes receipts)."""

    group_name = serializers.CharField(source="group.name", read_only=True)
    category_name = serializers.CharField(
        source="category.name", read_only=True, default=None
    )
    created_by = FinanceUserCompactSerializer(read_only=True)
    approved_by = FinanceUserCompactSerializer(read_only=True)
    receipts = ReceiptSerializer(many=True, read_only=True)

    class Meta:
        model = Transaction
        fields = [
            "id",
            "group",
            "group_name",
            "category",
            "category_name",
            "description",
            "amount",
            "transaction_type",
            "transaction_date",
            "transaction_time",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "approval_notes",
            "internal_notes",
            "receipts",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "status",
            "created_by",
            "approved_by",
            "approved_at",
            "created_at",
            "updated_at",
        ]


class TransactionCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating a new transaction."""

    class Meta:
        model = Transaction
        fields = [
            "id",
            "group",
            "category",
            "description",
            "amount",
            "transaction_type",
            "transaction_date",
            "transaction_time",
            "internal_notes",
        ]
        read_only_fields = ["id"]

    def validate_amount(self, value):
        if value <= 0:
            raise serializers.ValidationError("Betrag muss groesser als 0 sein.")
        return value


class TransactionUpdateSerializer(serializers.ModelSerializer):
    """Serializer for updating an existing transaction."""

    class Meta:
        model = Transaction
        fields = [
            "category",
            "description",
            "amount",
            "transaction_type",
            "transaction_date",
            "transaction_time",
            "internal_notes",
        ]

    def validate(self, attrs):
        if self.instance and self.instance.status == Transaction.Status.APPROVED:
            raise serializers.ValidationError(
                "Genehmigte Transaktionen koennen nicht mehr bearbeitet werden."
            )
        return attrs

    def validate_amount(self, value):
        if value is not None and value <= 0:
            raise serializers.ValidationError("Betrag muss groesser als 0 sein.")
        return value


class TransactionApprovalSerializer(serializers.Serializer):
    """Serializer for approve/reject actions."""

    approval_notes = serializers.CharField(required=False, allow_blank=True, default="")


class GroupBalanceSerializer(serializers.Serializer):
    """Serializer for group balance summary."""

    group_id = serializers.IntegerField()
    group_name = serializers.CharField()
    balance = serializers.DecimalField(max_digits=10, decimal_places=2)
    currency = serializers.CharField()
    total_income = serializers.DecimalField(max_digits=12, decimal_places=2)
    total_expenses = serializers.DecimalField(max_digits=12, decimal_places=2)
    last_transaction_date = serializers.DateField(allow_null=True)
    transaction_count = serializers.IntegerField()
