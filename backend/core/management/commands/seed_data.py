"""
Management command to seed reference data for a fresh installation.

Creates default school years, leave types, and system settings
if they don't already exist. Designed to be idempotent – safe to
run multiple times without creating duplicates.

Usage:
    python manage.py seed_data
"""

from datetime import date

from django.core.management.base import BaseCommand

from core.models import Location
from groups.models import SchoolYear
from timetracking.models import LeaveType


class Command(BaseCommand):
    help = "Erstellt Standard-Referenzdaten (Schuljahre, Abwesenheitstypen) fuer alle Standorte"

    SCHOOL_YEARS = [
        {
            "name": "2024/2025",
            "start_date": date(2024, 9, 2),
            "end_date": date(2025, 7, 4),
            "is_active": False,
        },
        {
            "name": "2025/2026",
            "start_date": date(2025, 9, 1),
            "end_date": date(2026, 7, 3),
            "is_active": True,
        },
        {
            "name": "2026/2027",
            "start_date": date(2026, 9, 1),
            "end_date": date(2027, 7, 2),
            "is_active": False,
        },
    ]

    LEAVE_TYPES = [
        {
            "name": "Urlaub",
            "description": "Bezahlter Erholungsurlaub",
            "requires_approval": True,
            "max_days_per_year": 25,
            "is_system_type": True,
        },
        {
            "name": "Krankheit",
            "description": "Krankenstand",
            "requires_approval": False,
            "max_days_per_year": None,
            "is_system_type": True,
        },
        {
            "name": "Fortbildung",
            "description": "Dienstliche Fortbildung und Weiterbildung",
            "requires_approval": True,
            "max_days_per_year": 10,
            "is_system_type": True,
        },
        {
            "name": "Sonderurlaub",
            "description": "Sonderurlaub (z.B. Hochzeit, Umzug)",
            "requires_approval": True,
            "max_days_per_year": 5,
            "is_system_type": True,
        },
        {
            "name": "Sonstiges",
            "description": "Sonstige Abwesenheit",
            "requires_approval": True,
            "max_days_per_year": None,
            "is_system_type": False,
        },
    ]

    def handle(self, *args, **options):
        locations = Location.objects.all()

        if not locations.exists():
            self.stdout.write(
                self.style.WARNING("Keine Standorte gefunden. Bitte zuerst einen Standort anlegen.")
            )
            return

        for location in locations:
            self.stdout.write(f"\nStandort: {location.name}")
            self._seed_school_years(location)
            self._seed_leave_types(location)

        self.stdout.write(self.style.SUCCESS("\nSeed-Daten erfolgreich erstellt."))

    def _seed_school_years(self, location: Location) -> None:
        """Create school years for a location if they don't exist."""
        created_count = 0
        for sy_data in self.SCHOOL_YEARS:
            _, created = SchoolYear.objects.get_or_create(
                location=location,
                name=sy_data["name"],
                defaults={
                    "start_date": sy_data["start_date"],
                    "end_date": sy_data["end_date"],
                    "is_active": sy_data["is_active"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            f"  Schuljahre: {created_count} neu erstellt, "
            f"{len(self.SCHOOL_YEARS) - created_count} bereits vorhanden"
        )

    def _seed_leave_types(self, location: Location) -> None:
        """Create leave types for a location if they don't exist."""
        created_count = 0
        for lt_data in self.LEAVE_TYPES:
            _, created = LeaveType.objects.get_or_create(
                location=location,
                name=lt_data["name"],
                defaults={
                    "description": lt_data["description"],
                    "requires_approval": lt_data["requires_approval"],
                    "max_days_per_year": lt_data["max_days_per_year"],
                    "is_system_type": lt_data["is_system_type"],
                },
            )
            if created:
                created_count += 1

        self.stdout.write(
            f"  Abwesenheitstypen: {created_count} neu erstellt, "
            f"{len(self.LEAVE_TYPES) - created_count} bereits vorhanden"
        )
