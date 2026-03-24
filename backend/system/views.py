"""Views for System app – Health check and system endpoints."""

from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny
from rest_framework.request import Request
from rest_framework.response import Response


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
