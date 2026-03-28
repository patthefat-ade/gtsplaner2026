"""
Benutzerdefinierte Pagination-Klassen fuer das GTS Planer Backend.

Stellt eine erweiterte PageNumberPagination bereit, die zusaetzliche
Metadaten wie total_pages, current_page und page_size in der
API-Antwort zurueckgibt. Das Frontend kann diese Metadaten nutzen,
um eine vollstaendige Pagination-Komponente darzustellen.
"""

from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response


class StandardPagination(PageNumberPagination):
    """
    Standard-Pagination fuer alle List-Endpunkte.

    Unterstuetzt:
        - ?page=1 (Seitennummer)
        - ?page_size=25 (Eintraege pro Seite, max 100)

    Response-Format:
        {
            "count": 150,
            "total_pages": 6,
            "current_page": 1,
            "page_size": 25,
            "next": "http://api.example.com/items/?page=2",
            "previous": null,
            "results": [...]
        }
    """

    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response(
            {
                "count": self.page.paginator.count,
                "total_pages": self.page.paginator.num_pages,
                "current_page": self.page.number,
                "page_size": self.get_page_size(self.request),
                "next": self.get_next_link(),
                "previous": self.get_previous_link(),
                "results": data,
            }
        )

    def get_paginated_response_schema(self, schema):
        """OpenAPI schema fuer die paginierte Antwort."""
        return {
            "type": "object",
            "required": [
                "count",
                "total_pages",
                "current_page",
                "page_size",
                "results",
            ],
            "properties": {
                "count": {
                    "type": "integer",
                    "example": 150,
                    "description": "Gesamtanzahl der Eintraege",
                },
                "total_pages": {
                    "type": "integer",
                    "example": 6,
                    "description": "Gesamtanzahl der Seiten",
                },
                "current_page": {
                    "type": "integer",
                    "example": 1,
                    "description": "Aktuelle Seitennummer",
                },
                "page_size": {
                    "type": "integer",
                    "example": 25,
                    "description": "Eintraege pro Seite",
                },
                "next": {
                    "type": "string",
                    "nullable": True,
                    "format": "uri",
                    "example": "http://api.example.com/items/?page=2",
                    "description": "URL zur naechsten Seite",
                },
                "previous": {
                    "type": "string",
                    "nullable": True,
                    "format": "uri",
                    "example": None,
                    "description": "URL zur vorherigen Seite",
                },
                "results": schema,
            },
        }
