"""
GDPR/DSGVO API Views.

Provides endpoints for:
- User anonymization (pseudoanonymization)
- Student anonymization
- User data export (ZIP)
- Student data export (ZIP)
- Data retention statistics
- Data retention configuration
"""

import logging

from django.http import HttpResponse
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core.models import User
from core.permissions import IsSuperAdmin
from groups.models import Student
from system.gdpr_service import GDPRService

logger = logging.getLogger("kassenbuch.gdpr")


class AnonymizeUserView(APIView):
    """
    POST /api/v1/admin/gdpr/anonymize-user/{user_id}/

    Pseudoanonymize a user's personal data.
    Only accessible by SuperAdmins.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        request=None,
        responses={
            200: inline_serializer(
                "AnonymizeUserResponse",
                fields={
                    "status": serializers.CharField(),
                    "anonymized_fields": serializers.ListField(child=serializers.CharField()),
                },
            )
        },
        summary="Benutzer anonymisieren",
        description="Pseudoanonymisiert die personenbezogenen Daten eines Benutzers (DSGVO Art. 17).",
    )
    def post(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "Benutzer nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        if user == request.user:
            return Response(
                {"error": "Sie können sich nicht selbst anonymisieren."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        result = GDPRService.anonymize_user(user)
        return Response(result, status=status.HTTP_200_OK)


class AnonymizeStudentView(APIView):
    """
    POST /api/v1/admin/gdpr/anonymize-student/{student_id}/

    Pseudoanonymize a student's personal data.
    Only accessible by SuperAdmins.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        request=None,
        responses={
            200: inline_serializer(
                "AnonymizeStudentResponse",
                fields={
                    "status": serializers.CharField(),
                    "anonymized_fields": serializers.ListField(child=serializers.CharField()),
                },
            )
        },
        summary="Schueler:in anonymisieren",
        description="Pseudoanonymisiert die personenbezogenen Daten eines Schuelers/einer Schuelerin (DSGVO Art. 17).",
    )
    def post(self, request, student_id):
        try:
            student = Student.objects.get(pk=student_id)
        except Student.DoesNotExist:
            return Response(
                {"error": "Schüler:in nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        result = GDPRService.anonymize_student(student)
        return Response(result, status=status.HTTP_200_OK)


class ExportUserDataView(APIView):
    """
    GET /api/v1/admin/gdpr/export-user/{user_id}/

    Export all data for a user as a ZIP file (DSGVO Art. 15).
    Only accessible by SuperAdmins.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        responses={
            (200, "application/zip"): bytes,
        },
        summary="Benutzerdaten exportieren",
        description="Exportiert alle Daten eines Benutzers als ZIP-Datei (DSGVO Art. 15 Auskunftsrecht).",
    )
    def get(self, request, user_id):
        try:
            user = User.objects.get(pk=user_id)
        except User.DoesNotExist:
            return Response(
                {"error": "Benutzer nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        zip_buffer = GDPRService.export_user_data(user)

        filename = f"dsgvo_export_benutzer_{user.pk}_{user.last_name}.zip"
        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        logger.info(
            f"GDPR: Data export for user #{user.pk} requested by {request.user}"
        )

        return response


class ExportStudentDataView(APIView):
    """
    GET /api/v1/admin/gdpr/export-student/{student_id}/

    Export all data for a student as a ZIP file (DSGVO Art. 15).
    Only accessible by SuperAdmins.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        responses={
            (200, "application/zip"): bytes,
        },
        summary="Schuelerdaten exportieren",
        description="Exportiert alle Daten eines Schuelers/einer Schuelerin als ZIP-Datei (DSGVO Art. 15 Auskunftsrecht).",
    )
    def get(self, request, student_id):
        try:
            student = Student.objects.select_related("group").get(pk=student_id)
        except Student.DoesNotExist:
            return Response(
                {"error": "Schüler:in nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )

        zip_buffer = GDPRService.export_student_data(student)

        filename = f"dsgvo_export_schueler_{student.pk}_{student.last_name}.zip"
        response = HttpResponse(zip_buffer.getvalue(), content_type="application/zip")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'

        logger.info(
            f"GDPR: Data export for student #{student.pk} requested by {request.user}"
        )

        return response


class GDPRRetentionStatsView(APIView):
    """
    GET /api/v1/admin/gdpr/stats/

    Get data retention and anonymization statistics.
    Only accessible by SuperAdmins.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        responses={
            200: inline_serializer(
                "GDPRRetentionStatsResponse",
                fields={
                    "total_users": serializers.IntegerField(),
                    "anonymized_users": serializers.IntegerField(),
                    "total_students": serializers.IntegerField(),
                    "anonymized_students": serializers.IntegerField(),
                    "retention_years": serializers.IntegerField(),
                },
            )
        },
        summary="DSGVO-Statistiken abrufen",
        description="Liefert Statistiken zu Datenaufbewahrung und Anonymisierung.",
    )
    def get(self, request):
        stats = GDPRService.get_retention_stats()
        return Response(stats, status=status.HTTP_200_OK)


class GDPRRetentionConfigView(APIView):
    """
    GET/PUT /api/v1/admin/gdpr/retention-config/

    View or update the data retention period configuration.
    Only accessible by SuperAdmins.
    """

    permission_classes = [IsAuthenticated, IsSuperAdmin]

    @extend_schema(
        responses={
            200: inline_serializer(
                "GDPRRetentionConfigResponse",
                fields={
                    "data_retention_years": serializers.IntegerField(),
                    "description": serializers.CharField(),
                },
            )
        },
        summary="Aufbewahrungskonfiguration abrufen",
        description="Liefert die aktuelle DSGVO-Aufbewahrungsfrist-Konfiguration.",
    )
    def get(self, request):
        from system.models import SystemSetting

        try:
            setting = SystemSetting.objects.get(key="data_retention_years")
            return Response({
                "data_retention_years": int(setting.value),
                "description": setting.description,
            })
        except SystemSetting.DoesNotExist:
            return Response({
                "data_retention_years": 7,
                "description": "Standard-Aufbewahrungsfrist (nicht konfiguriert)",
            })

    @extend_schema(
        request=inline_serializer(
            "GDPRRetentionConfigUpdateRequest",
            fields={
                "data_retention_years": serializers.IntegerField(min_value=1, max_value=30),
            },
        ),
        responses={
            200: inline_serializer(
                "GDPRRetentionConfigUpdateResponse",
                fields={
                    "data_retention_years": serializers.IntegerField(),
                    "description": serializers.CharField(),
                    "status": serializers.CharField(),
                },
            )
        },
        summary="Aufbewahrungskonfiguration aktualisieren",
        description="Aktualisiert die DSGVO-Aufbewahrungsfrist in Jahren (1-30).",
    )
    def put(self, request):
        from system.models import AuditLog, SystemSetting

        years = request.data.get("data_retention_years")
        if years is None:
            return Response(
                {"error": "data_retention_years ist erforderlich."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            years = int(years)
            if years < 1 or years > 30:
                raise ValueError
        except (ValueError, TypeError):
            return Response(
                {"error": "data_retention_years muss eine Zahl zwischen 1 und 30 sein."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        setting, created = SystemSetting.objects.update_or_create(
            key="data_retention_years",
            defaults={
                "value": str(years),
                "description": (
                    f"DSGVO-Aufbewahrungsfrist in Jahren. "
                    f"Anonymisierte Daten werden nach {years} Jahren automatisch gelöscht."
                ),
            },
        )

        # Audit log
        AuditLog.objects.create(
            user=request.user,
            action=AuditLog.Action.UPDATE,
            model_name="SystemSetting",
            object_id=str(setting.pk),
            changes={
                "action": "gdpr_retention_config_update",
                "data_retention_years": years,
            },
        )

        return Response({
            "data_retention_years": years,
            "description": setting.description,
            "status": "updated",
        })
