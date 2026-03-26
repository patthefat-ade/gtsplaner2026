"""
Management command to create test users for each role.

Creates one test user per role with @gtsplaner.app email addresses
and the password Test123! for development and testing purposes.

Usage:
    python manage.py create_test_users
"""

from django.core.management.base import BaseCommand

from core.models import Location, Organization, User
from groups.models import Group, GroupMember


class Command(BaseCommand):
    help = "Erstellt Test-Benutzer für jede Rolle mit @gtsplaner.app E-Mail-Adressen"

    TEST_USERS = [
        {
            "username": "educator",
            "email": "educator@gtsplaner.app",
            "first_name": "Eva",
            "last_name": "Pädagogin",
            "role": User.Role.EDUCATOR,
            "is_staff": False,
        },
        {
            "username": "locationmanager",
            "email": "locationmanager@gtsplaner.app",
            "first_name": "Lisa",
            "last_name": "Standortleitung",
            "role": User.Role.LOCATION_MANAGER,
            "is_staff": False,
        },
        {
            "username": "admin",
            "email": "admin@gtsplaner.app",
            "first_name": "Anna",
            "last_name": "Administratorin",
            "role": User.Role.ADMIN,
            "is_staff": True,
        },
        {
            "username": "superadmin",
            "email": "superadmin@gtsplaner.app",
            "first_name": "Sarah",
            "last_name": "Superadmin",
            "role": User.Role.SUPER_ADMIN,
            "is_staff": True,
            "is_superuser": True,
        },
    ]

    PASSWORD = "Test123!"

    def handle(self, *args, **options):
        # Ensure Organization and Location exist
        org, _ = Organization.objects.get_or_create(
            name="Hilfswerk Testorganisation",
            defaults={
                "description": "Testorganisation für Entwicklung",
                "email": "test@hilfswerk.at",
            },
        )
        location, _ = Location.objects.get_or_create(
            name="Teststandort Wien",
            organization=org,
            defaults={
                "description": "Teststandort für Entwicklung",
            },
        )

        self.stdout.write("\n" + "=" * 70)
        self.stdout.write("GTS Planer – Test-Benutzer")
        self.stdout.write("=" * 70)

        for user_data in self.TEST_USERS:
            is_superuser = user_data.pop("is_superuser", False)
            username = user_data["username"]
            email = user_data["email"]

            user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    **user_data,
                    "is_superuser": is_superuser,
                },
            )

            if created:
                user.set_password(self.PASSWORD)
                user.location = location
                user.has_accepted_terms = True
                user.save()
                action = "ERSTELLT"
            else:
                # Update existing user
                for key, value in user_data.items():
                    setattr(user, key, value)
                user.is_superuser = is_superuser
                user.location = location
                user.set_password(self.PASSWORD)
                user.has_accepted_terms = True
                user.save()
                action = "AKTUALISIERT"

            role_display = user.get_role_display()
            self.stdout.write(
                f"  [{action}] {role_display:20s} | {email:35s} | Passwort: {self.PASSWORD}"
            )

        self.stdout.write("=" * 70)
        self.stdout.write(
            self.style.SUCCESS(
                f"\n\u2713 {len(self.TEST_USERS)} Test-Benutzer erstellt/aktualisiert."
            )
        )
        self.stdout.write(f"  Organisation: {org.name}")
        self.stdout.write(f"  Standort:     {location.name}")

        # Assign educator to existing groups as group member
        self._assign_educator_to_groups(location)

        self.stdout.write("")

    def _assign_educator_to_groups(self, location: Location) -> None:
        """Assign the educator test user to all groups at the location."""
        try:
            educator = User.objects.get(username="educator")
        except User.DoesNotExist:
            return

        groups = Group.objects.filter(location=location, is_active=True)
        if not groups.exists():
            self.stdout.write(
                self.style.WARNING(
                    "  Keine Gruppen gefunden. Bitte zuerst Gruppen anlegen "
                    "und dann erneut ausfuehren."
                )
            )
            return

        assigned_count = 0
        for group in groups:
            _, created = GroupMember.objects.get_or_create(
                group=group,
                user=educator,
                defaults={"role": GroupMember.MemberRole.EDUCATOR},
            )
            if created:
                assigned_count += 1

        self.stdout.write(
            f"  Gruppenmitgliedschaften (Educator): {assigned_count} neu, "
            f"{groups.count() - assigned_count} bereits vorhanden"
        )
