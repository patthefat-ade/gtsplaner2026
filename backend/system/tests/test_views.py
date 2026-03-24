"""Tests for System views – Health check endpoint."""

import pytest
from rest_framework.test import APIClient


@pytest.mark.django_db
class TestHealthCheck:
    """Tests for the health check endpoint."""

    def test_health_check_returns_200(self, api_client: APIClient) -> None:
        """Test that the health check endpoint returns 200."""
        response = api_client.get("/api/health/")
        assert response.status_code == 200

    def test_health_check_response_body(self, api_client: APIClient) -> None:
        """Test that the health check returns the expected body."""
        response = api_client.get("/api/health/")
        data = response.json()
        assert data["status"] == "healthy"
        assert data["version"] == "2.0.0"
        assert data["service"] == "kassenbuch-api"
