"""
Management command to create test users, organizations, and permission groups.

Creates a multi-tenant test environment with:
  - A main tenant (Bundesland: Kaernten)
  - Two sub-tenants (schools with locations)
  - Test users for each role assigned to proper Django Groups
  - Group memberships for educators

Usage:
    python manage.py create_test_users
"""

from django.contrib.auth.models import Group as AuthGroup
from django.core.management.base import BaseCommand

from core.models import Location, Organization, User
from groups.models import Group, GroupMember


class Command(BaseCommand):
    help = (
        "Erstellt Multi-Tenant-Testumgebung mit Organisationen, "
        "Standorten, Benutzern und Django Permission Groups."
    )

    PASSWORD = "Test123!"

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 70)
        self.stdout.write("GTS Planer – Multi-Tenant Testumgebung")
        self.stdout.write("=" * 70)

        # 1. Setup Permission Groups (idempotent)
        self._setup_permission_groups()

        # 2. Create Organization Hierarchy
        main_org, sub_org_1, sub_org_2 = self._create_organizations()

        # 3. Create Locations
        location_1, location_2 = self._create_locations(sub_org_1, sub_org_2)

        # 4. Create Test Users
        self._create_test_users(main_org, sub_org_1, sub_org_2, location_1, location_2)

        # 5. Assign Educators to Groups
        self._assign_educator_to_groups(location_1)

        self.stdout.write("=" * 70)
        self.stdout.write(
            self.style.SUCCESS("\nTestumgebung erfolgreich erstellt/aktualisiert.")
        )
        self.stdout.write("")

    def _setup_permission_groups(self):
        """Ensure Django Permission Groups exist by running setup_permissions."""
        from django.core.management import call_command

        self.stdout.write("\n  [1/5] Permission Groups einrichten...")
        try:
            call_command("setup_permissions", verbosity=0)
            self.stdout.write("        Django Permission Groups erstellt/aktualisiert.")
        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f"        setup_permissions uebersprungen: {e}")
            )

    def _create_organizations(self):
        """Create the organization hierarchy: main tenant + sub-tenants."""
        self.stdout.write("\n  [2/5] Organisationen erstellen...")

        # Main Tenant (Bundesland)
        main_org, created = Organization.objects.get_or_create(
            name="GTS Kaernten",
            defaults={
                "description": "Ganztagesschulen Kaernten – Hauptmandant",
                "org_type": Organization.OrgType.MAIN_TENANT,
                "parent": None,
                "email": "office@gts-kaernten.at",
                "phone": "+43 463 12345",
                "street": "Arnulfplatz 1",
                "city": "Klagenfurt",
                "postal_code": "9020",
                "country": "AT",
            },
        )
        if not created:
            main_org.org_type = Organization.OrgType.MAIN_TENANT
            main_org.parent = None
            main_org.save(update_fields=["org_type", "parent"])
        self.stdout.write(
            f"        Hauptmandant: {main_org.name} ({'NEU' if created else 'VORHANDEN'})"
        )

        # Sub-Tenant 1 (Schule)
        sub_org_1, created = Organization.objects.get_or_create(
            name="VS Klagenfurt Mitte",
            defaults={
                "description": "Volksschule Klagenfurt Mitte – GTS Standort",
                "org_type": Organization.OrgType.SUB_TENANT,
                "parent": main_org,
                "email": "direktion@vs-klagenfurt-mitte.at",
                "phone": "+43 463 23456",
                "street": "Schulstrasse 5",
                "city": "Klagenfurt",
                "postal_code": "9020",
                "country": "AT",
            },
        )
        if not created:
            sub_org_1.org_type = Organization.OrgType.SUB_TENANT
            sub_org_1.parent = main_org
            sub_org_1.save(update_fields=["org_type", "parent"])
        self.stdout.write(
            f"        Sub-Tenant 1: {sub_org_1.name} ({'NEU' if created else 'VORHANDEN'})"
        )

        # Sub-Tenant 2 (Schule)
        sub_org_2, created = Organization.objects.get_or_create(
            name="VS Villach Sued",
            defaults={
                "description": "Volksschule Villach Sued – GTS Standort",
                "org_type": Organization.OrgType.SUB_TENANT,
                "parent": main_org,
                "email": "direktion@vs-villach-sued.at",
                "phone": "+43 4242 34567",
                "street": "Hauptplatz 10",
                "city": "Villach",
                "postal_code": "9500",
                "country": "AT",
            },
        )
        if not created:
            sub_org_2.org_type = Organization.OrgType.SUB_TENANT
            sub_org_2.parent = main_org
            sub_org_2.save(update_fields=["org_type", "parent"])
        self.stdout.write(
            f"        Sub-Tenant 2: {sub_org_2.name} ({'NEU' if created else 'VORHANDEN'})"
        )

        return main_org, sub_org_1, sub_org_2

    def _create_locations(self, sub_org_1, sub_org_2):
        """Create locations for each sub-tenant."""
        self.stdout.write("\n  [3/5] Standorte erstellen...")

        location_1, created = Location.objects.get_or_create(
            name="GTS Klagenfurt Mitte",
            organization=sub_org_1,
            defaults={
                "description": "Ganztagesbetreuung VS Klagenfurt Mitte",
                "email": "gts@vs-klagenfurt-mitte.at",
                "phone": "+43 463 23456",
                "street": "Schulstrasse 5",
                "city": "Klagenfurt",
                "postal_code": "9020",
            },
        )
        self.stdout.write(
            f"        Standort 1: {location_1.name} ({'NEU' if created else 'VORHANDEN'})"
        )

        location_2, created = Location.objects.get_or_create(
            name="GTS Villach Sued",
            organization=sub_org_2,
            defaults={
                "description": "Ganztagesbetreuung VS Villach Sued",
                "email": "gts@vs-villach-sued.at",
                "phone": "+43 4242 34567",
                "street": "Hauptplatz 10",
                "city": "Villach",
                "postal_code": "9500",
            },
        )
        self.stdout.write(
            f"        Standort 2: {location_2.name} ({'NEU' if created else 'VORHANDEN'})"
        )

        return location_1, location_2

    def _create_test_users(self, main_org, sub_org_1, sub_org_2, location_1, location_2):
        """Create test users for each role and assign to Django Groups."""
        self.stdout.write("\n  [4/5] Test-Benutzer erstellen...")

        test_users = [
            # Educator at Location 1 (sub-tenant 1)
            {
                "username": "educator",
                "email": "educator@gtsplaner.app",
                "first_name": "Eva",
                "last_name": "Paedagogin",
                "role": User.Role.EDUCATOR,
                "is_staff": False,
                "location": location_1,
                "group_name": "Educator",
            },
            # Second Educator at Location 2 (sub-tenant 2)
            {
                "username": "educator2",
                "email": "educator2@gtsplaner.app",
                "first_name": "Maria",
                "last_name": "Betreuerin",
                "role": User.Role.EDUCATOR,
                "is_staff": False,
                "location": location_2,
                "group_name": "Educator",
            },
            # Location Manager at Location 1 (sub-tenant 1)
            {
                "username": "locationmanager",
                "email": "locationmanager@gtsplaner.app",
                "first_name": "Lisa",
                "last_name": "Standortleitung",
                "role": User.Role.LOCATION_MANAGER,
                "is_staff": False,
                "location": location_1,
                "group_name": "LocationManager",
            },
            # Location Manager at Location 2 (sub-tenant 2)
            {
                "username": "locationmanager2",
                "email": "locationmanager2@gtsplaner.app",
                "first_name": "Claudia",
                "last_name": "Standortleitung",
                "role": User.Role.LOCATION_MANAGER,
                "is_staff": False,
                "location": location_2,
                "group_name": "LocationManager",
            },
            # Admin for main tenant (sees all sub-tenants)
            {
                "username": "admin",
                "email": "admin@gtsplaner.app",
                "first_name": "Anna",
                "last_name": "Administratorin",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "location": location_1,
                "group_name": "Admin",
            },
            # Super Admin (cross-tenant access)
            {
                "username": "superadmin",
                "email": "superadmin@gtsplaner.app",
                "first_name": "Sarah",
                "last_name": "Superadmin",
                "role": User.Role.SUPER_ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "location": location_1,
                "group_name": "SuperAdmin",
            },
        ]

        for user_data in test_users:
            is_superuser = user_data.pop("is_superuser", False)
            location = user_data.pop("location")
            group_name = user_data.pop("group_name")
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
                for key, value in user_data.items():
                    setattr(user, key, value)
                user.is_superuser = is_superuser
                user.location = location
                user.set_password(self.PASSWORD)
                user.has_accepted_terms = True
                user.save()
                action = "AKTUALISIERT"

            # Assign to Django Permission Group
            try:
                auth_group = AuthGroup.objects.get(name=group_name)
                user.groups.clear()
                user.groups.add(auth_group)
                group_status = f"Gruppe: {group_name}"
            except AuthGroup.DoesNotExist:
                group_status = f"Gruppe '{group_name}' nicht gefunden"

            role_display = user.get_role_display()
            self.stdout.write(
                f"        [{action}] {role_display:20s} | {email:35s} | "
                f"{group_status} | Standort: {location.name}"
            )

    def _assign_educator_to_groups(self, location: Location) -> None:
        """Assign the educator test user to all groups at the location."""
        self.stdout.write("\n  [5/5] Gruppenmitgliedschaften zuweisen...")

        try:
            educator = User.objects.get(username="educator")
        except User.DoesNotExist:
            return

        groups = Group.objects.filter(location=location, is_active=True)
        if not groups.exists():
            self.stdout.write(
                self.style.WARNING(
                    "        Keine Gruppen gefunden. Bitte zuerst Gruppen anlegen "
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
            f"        Gruppenmitgliedschaften (Educator): {assigned_count} neu, "
            f"{groups.count() - assigned_count} bereits vorhanden"
        )
