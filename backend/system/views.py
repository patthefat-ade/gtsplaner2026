"""Views for System app – Health check and system endpoints."""

from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


@extend_schema(
    responses={
        200: inline_serializer(
            "HealthCheckResponse",
            fields={
                "status": serializers.CharField(),
                "version": serializers.CharField(),
                "service": serializers.CharField(),
            },
        )
    },
    summary="Health Check",
    description="Prueft ob die API erreichbar und funktionsfaehig ist.",
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request: Request) -> Response:
    """Health check endpoint to verify the API is running."""
    return Response(
        {
            "status": "healthy",
            "version": "2.0.0",
            "service": "kassenbuch-api",
        },
        status=status.HTTP_200_OK,
    )
