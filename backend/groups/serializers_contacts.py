"""
Serializers for the StudentContact (contact persons / authorized pickups) feature.
"""

from rest_framework import serializers

from groups.models_contacts import StudentContact


class StudentContactListSerializer(serializers.ModelSerializer):
    """Serializer for listing student contacts."""

    relationship_display: str = serializers.CharField(
        source="get_relationship_display", read_only=True
    )
    student_name: str = serializers.SerializerMethodField()

    class Meta:
        model = StudentContact
        fields = [
            "id",
            "student",
            "student_name",
            "is_primary",
            "relationship",
            "relationship_display",
            "first_name",
            "last_name",
            "phone",
            "email",
            "whatsapp_available",
            "notes",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def get_student_name(self, obj: StudentContact) -> str:
        return f"{obj.student.first_name} {obj.student.last_name}"


class StudentContactCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating a student contact."""

    class Meta:
        model = StudentContact
        fields = [
            "id",
            "student",
            "is_primary",
            "relationship",
            "first_name",
            "last_name",
            "phone",
            "email",
            "whatsapp_available",
            "notes",
        ]
        read_only_fields = ["id"]

    def validate(self, attrs: dict) -> dict:
        student = attrs.get("student") or (
            self.instance.student if self.instance else None
        )
        is_primary = attrs.get(
            "is_primary",
            self.instance.is_primary if self.instance else False,
        )

        if not student:
            return attrs

        # Check max 4 contacts
        qs = StudentContact.objects.filter(
            student=student,
            is_deleted=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)

        if not self.instance and qs.count() >= 4:
            raise serializers.ValidationError(
                "Ein Schueler kann maximal 4 Kontaktpersonen haben."
            )

        # Check only 1 primary
        if is_primary and qs.filter(is_primary=True).exists():
            raise serializers.ValidationError(
                "Es gibt bereits eine Hauptansprechperson fuer diesen Schueler. "
                "Bitte aendern Sie zuerst die bestehende Hauptansprechperson."
            )

        return attrs
