"""
Management command to create a realistic multi-tenant test environment.

Creates the Hilfswerk Oesterreich hierarchy:
  - Main tenant: Hilfswerk Oesterreich
  - 9 Sub-tenants: one per Bundesland (Kaernten, Wien, NÖ, Tirol, etc.)
  - Each sub-tenant has one school (Location) with a LocationManager and Educator
  - Kaernten: VS Annabichl with Anita Anic (LocationManager), Amalia Bogdan (Educator)
  - Gruene Gruppe with 26 Schueler:innen from various classes
  - Django Permission Groups assigned to all users

Designed to be fully idempotent – safe to run multiple times without
creating duplicates or leaving stale data.

Usage:
    python manage.py create_test_users
"""

import datetime

from django.contrib.auth.models import Group as AuthGroup
from django.core.management.base import BaseCommand

from core.models import Location, Organization, User
from groups.models import Group, GroupMember, SchoolYear, Student


class Command(BaseCommand):
    help = (
        "Erstellt realistische Multi-Tenant-Testumgebung: "
        "Hilfswerk Oesterreich mit 9 Bundeslaendern, Schulen, Benutzern und Gruppen."
    )

    PASSWORD = "Test123!"

    # ── Bundesland-Konfiguration ──────────────────────────────────────────

    BUNDESLAENDER = [
        {
            "name": "Hilfswerk Kaernten",
            "city": "Klagenfurt",
            "postal_code": "9020",
            "street": "8.-Mai-Strasse 47",
            "phone": "+43 463 55 800",
            "email": "office@kaernten.hilfswerk.at",
            "school": {
                "name": "VS Annabichl",
                "city": "Klagenfurt",
                "postal_code": "9020",
                "street": "Annabichler Strasse 74",
                "email": "vs.annabichl@klagenfurt.at",
                "phone": "+43 463 537 5630",
            },
            "manager": {
                "username": "anita.anic",
                "email": "anita.anic@hilfswerk.at",
                "first_name": "Anita",
                "last_name": "Anic",
            },
            "educator": {
                "username": "amalia.bogdan",
                "email": "amalia.bogdan@hilfswerk.at",
                "first_name": "Amalia",
                "last_name": "Bogdan",
            },
        },
        {
            "name": "Hilfswerk Wien",
            "city": "Wien",
            "postal_code": "1010",
            "street": "Schottenfeldgasse 29",
            "phone": "+43 1 512 36 61",
            "email": "office@wien.hilfswerk.at",
            "school": {
                "name": "VS Donaustadt",
                "city": "Wien",
                "postal_code": "1220",
                "street": "Schuettpelzgasse 1",
                "email": "vs.donaustadt@wien.gv.at",
                "phone": "+43 1 203 22 41",
            },
            "manager": {
                "username": "brigitte.berger",
                "email": "brigitte.berger@hilfswerk.at",
                "first_name": "Brigitte",
                "last_name": "Berger",
            },
            "educator": {
                "username": "clara.czermak",
                "email": "clara.czermak@hilfswerk.at",
                "first_name": "Clara",
                "last_name": "Czermak",
            },
        },
        {
            "name": "Hilfswerk Niederoesterreich",
            "city": "St. Poelten",
            "postal_code": "3100",
            "street": "Ferstlergasse 4",
            "phone": "+43 2742 249",
            "email": "office@noe.hilfswerk.at",
            "school": {
                "name": "VS St. Poelten Mitte",
                "city": "St. Poelten",
                "postal_code": "3100",
                "street": "Grenzgasse 18",
                "email": "vs.stpoelten-mitte@noeschule.at",
                "phone": "+43 2742 352 140",
            },
            "manager": {
                "username": "doris.decker",
                "email": "doris.decker@hilfswerk.at",
                "first_name": "Doris",
                "last_name": "Decker",
            },
            "educator": {
                "username": "elena.ernst",
                "email": "elena.ernst@hilfswerk.at",
                "first_name": "Elena",
                "last_name": "Ernst",
            },
        },
        {
            "name": "Hilfswerk Tirol",
            "city": "Innsbruck",
            "postal_code": "6020",
            "street": "Suedtiroler Platz 14-16",
            "phone": "+43 512 597 900",
            "email": "office@tirol.hilfswerk.at",
            "school": {
                "name": "VS Innsbruck West",
                "city": "Innsbruck",
                "postal_code": "6020",
                "street": "Technikerstrasse 44",
                "email": "vs.innsbruck-west@tsn.at",
                "phone": "+43 512 584 263",
            },
            "manager": {
                "username": "franziska.fink",
                "email": "franziska.fink@hilfswerk.at",
                "first_name": "Franziska",
                "last_name": "Fink",
            },
            "educator": {
                "username": "greta.gruber",
                "email": "greta.gruber@hilfswerk.at",
                "first_name": "Greta",
                "last_name": "Gruber",
            },
        },
        {
            "name": "Hilfswerk Burgenland",
            "city": "Eisenstadt",
            "postal_code": "7000",
            "street": "Ignaz-Till-Strasse 9",
            "phone": "+43 2682 651 50",
            "email": "office@bgld.hilfswerk.at",
            "school": {
                "name": "VS Eisenstadt",
                "city": "Eisenstadt",
                "postal_code": "7000",
                "street": "Kalvarienbergplatz 8",
                "email": "vs.eisenstadt@bildungsserver.com",
                "phone": "+43 2682 622 57",
            },
            "manager": {
                "username": "hanna.hofer",
                "email": "hanna.hofer@hilfswerk.at",
                "first_name": "Hanna",
                "last_name": "Hofer",
            },
            "educator": {
                "username": "irene.illing",
                "email": "irene.illing@hilfswerk.at",
                "first_name": "Irene",
                "last_name": "Illing",
            },
        },
        {
            "name": "Hilfswerk Steiermark",
            "city": "Graz",
            "postal_code": "8010",
            "street": "Grabenstrasse 90",
            "phone": "+43 316 813 182",
            "email": "office@stmk.hilfswerk.at",
            "school": {
                "name": "VS Graz Sued",
                "city": "Graz",
                "postal_code": "8020",
                "street": "Triester Strasse 20",
                "email": "vs.graz-sued@stmk.gv.at",
                "phone": "+43 316 872 7830",
            },
            "manager": {
                "username": "julia.jandl",
                "email": "julia.jandl@hilfswerk.at",
                "first_name": "Julia",
                "last_name": "Jandl",
            },
            "educator": {
                "username": "katharina.kern",
                "email": "katharina.kern@hilfswerk.at",
                "first_name": "Katharina",
                "last_name": "Kern",
            },
        },
        {
            "name": "Hilfswerk Oberoesterreich",
            "city": "Linz",
            "postal_code": "4020",
            "street": "Dametzstrasse 6",
            "phone": "+43 732 775 511",
            "email": "office@ooe.hilfswerk.at",
            "school": {
                "name": "VS Linz Mitte",
                "city": "Linz",
                "postal_code": "4020",
                "street": "Hamerlingstrasse 3",
                "email": "vs.linz-mitte@ooe.gv.at",
                "phone": "+43 732 770 444",
            },
            "manager": {
                "username": "laura.lang",
                "email": "laura.lang@hilfswerk.at",
                "first_name": "Laura",
                "last_name": "Lang",
            },
            "educator": {
                "username": "maria.maier",
                "email": "maria.maier@hilfswerk.at",
                "first_name": "Maria",
                "last_name": "Maier",
            },
        },
        {
            "name": "Hilfswerk Salzburg",
            "city": "Salzburg",
            "postal_code": "5020",
            "street": "Auerspergstrasse 4",
            "phone": "+43 662 434 702",
            "email": "office@sbg.hilfswerk.at",
            "school": {
                "name": "VS Salzburg Stadt",
                "city": "Salzburg",
                "postal_code": "5020",
                "street": "Faistauergasse 18",
                "email": "vs.salzburg-stadt@salzburg.gv.at",
                "phone": "+43 662 843 135",
            },
            "manager": {
                "username": "nina.neuner",
                "email": "nina.neuner@hilfswerk.at",
                "first_name": "Nina",
                "last_name": "Neuner",
            },
            "educator": {
                "username": "olivia.ortner",
                "email": "olivia.ortner@hilfswerk.at",
                "first_name": "Olivia",
                "last_name": "Ortner",
            },
        },
        {
            "name": "Hilfswerk Vorarlberg",
            "city": "Bregenz",
            "postal_code": "6900",
            "street": "Rathausstrasse 2",
            "phone": "+43 5574 488 00",
            "email": "office@vlbg.hilfswerk.at",
            "school": {
                "name": "VS Bregenz",
                "city": "Bregenz",
                "postal_code": "6900",
                "street": "Belruptstrasse 37",
                "email": "vs.bregenz@vobs.at",
                "phone": "+43 5574 410 18",
            },
            "manager": {
                "username": "petra.pichler",
                "email": "petra.pichler@hilfswerk.at",
                "first_name": "Petra",
                "last_name": "Pichler",
            },
            "educator": {
                "username": "rosa.riedl",
                "email": "rosa.riedl@hilfswerk.at",
                "first_name": "Rosa",
                "last_name": "Riedl",
            },
        },
    ]

    # ── 26 Schueler:innen fuer Gruene Gruppe (VS Annabichl) ──────────────

    STUDENTS = [
        {"first_name": "Lena", "last_name": "Koller", "class": "1a"},
        {"first_name": "Maximilian", "last_name": "Steiner", "class": "1a"},
        {"first_name": "Sophie", "last_name": "Huber", "class": "1b"},
        {"first_name": "Felix", "last_name": "Wagner", "class": "1b"},
        {"first_name": "Emma", "last_name": "Berger", "class": "2a"},
        {"first_name": "Paul", "last_name": "Bauer", "class": "2a"},
        {"first_name": "Mia", "last_name": "Pichler", "class": "2a"},
        {"first_name": "Jonas", "last_name": "Moser", "class": "2b"},
        {"first_name": "Hannah", "last_name": "Gruber", "class": "2b"},
        {"first_name": "David", "last_name": "Hofer", "class": "3a"},
        {"first_name": "Anna", "last_name": "Leitner", "class": "3a"},
        {"first_name": "Lukas", "last_name": "Eder", "class": "3a"},
        {"first_name": "Laura", "last_name": "Fischer", "class": "3b"},
        {"first_name": "Elias", "last_name": "Schwarz", "class": "3b"},
        {"first_name": "Sarah", "last_name": "Winkler", "class": "3b"},
        {"first_name": "Noah", "last_name": "Reiter", "class": "4a"},
        {"first_name": "Leonie", "last_name": "Mayr", "class": "4a"},
        {"first_name": "Ben", "last_name": "Brunner", "class": "4a"},
        {"first_name": "Marie", "last_name": "Wimmer", "class": "4b"},
        {"first_name": "Alexander", "last_name": "Egger", "class": "4b"},
        {"first_name": "Valentina", "last_name": "Haas", "class": "1a"},
        {"first_name": "Tobias", "last_name": "Fuchs", "class": "1b"},
        {"first_name": "Emilia", "last_name": "Wolf", "class": "2a"},
        {"first_name": "Moritz", "last_name": "Lang", "class": "2b"},
        {"first_name": "Amelie", "last_name": "Wallner", "class": "3a"},
        {"first_name": "Jakob", "last_name": "Aigner", "class": "4b"},
    ]

    # All test usernames managed by this command
    ALL_TEST_USERNAMES = [
        "superadmin", "admin",
        # Legacy usernames from previous sprints
        "locationmanager", "educator",
        # New Hilfswerk usernames
        "anita.anic", "amalia.bogdan",
        "brigitte.berger", "clara.czermak",
        "doris.decker", "elena.ernst",
        "franziska.fink", "greta.gruber",
        "hanna.hofer", "irene.illing",
        "julia.jandl", "katharina.kern",
        "laura.lang", "maria.maier",
        "nina.neuner", "olivia.ortner",
        "petra.pichler", "rosa.riedl",
    ]

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("GTS Planer – Hilfswerk Oesterreich Testumgebung")
        self.stdout.write("=" * 80)

        # 0. Cleanup old test data to avoid FK conflicts
        self._cleanup_old_data()

        # 1. Setup Permission Groups
        self._setup_permission_groups()

        # 2. Create Main Tenant
        main_org = self._create_main_tenant()

        # 3. Create Sub-Tenants (9 Bundeslaender)
        bundesland_data = self._create_bundeslaender(main_org)

        # 4. Create SuperAdmin and Admin
        self._create_system_users(main_org, bundesland_data)

        # 5. Create LocationManagers and Educators per Bundesland
        self._create_bundesland_users(bundesland_data)

        # 6. Create School Year, Group, and Students for Kaernten
        self._create_kaernten_data(bundesland_data)

        # 7. Update SystemSettings
        self._update_system_settings()

        self.stdout.write("\n" + "=" * 80)
        self.stdout.write(
            self.style.SUCCESS("Testumgebung erfolgreich erstellt/aktualisiert.")
        )
        self.stdout.write("=" * 80 + "\n")

    # ── Step 0: Cleanup ───────────────────────────────────────────────────

    def _cleanup_old_data(self):
        """Remove old test data to avoid FK constraint violations."""
        self.stdout.write("\n  [0/7] Alte Testdaten bereinigen...")

        # Remove location FK from old test users to avoid FK violations
        old_users = User.objects.filter(username__in=self.ALL_TEST_USERNAMES)
        count = old_users.count()
        if count > 0:
            # Unset location to avoid FK issues when locations are recreated
            old_users.update(location=None)
            self.stdout.write(f"        {count} Benutzer: location auf NULL gesetzt.")

        # Delete old locations that are not linked to any Hilfswerk organization
        old_locations = Location.objects.exclude(
            organization__name__startswith="Hilfswerk"
        )
        loc_count = old_locations.count()
        if loc_count > 0:
            old_locations.delete()
            self.stdout.write(f"        {loc_count} alte Standorte geloescht.")

        # Delete legacy test users (locationmanager, educator)
        legacy_users = User.objects.filter(
            username__in=["locationmanager", "educator"]
        )
        legacy_count = legacy_users.count()
        if legacy_count > 0:
            legacy_users.delete()
            self.stdout.write(f"        {legacy_count} Legacy-Benutzer geloescht.")

        if count == 0 and loc_count == 0 and legacy_count == 0:
            self.stdout.write("        Keine alten Daten gefunden.")

    # ── Step 1: Permission Groups ─────────────────────────────────────────

    def _setup_permission_groups(self):
        """Ensure Django Permission Groups exist."""
        from django.core.management import call_command

        self.stdout.write("\n  [1/7] Permission Groups einrichten...")
        try:
            call_command("setup_permissions", "--reset", "--migrate-users", verbosity=0)
            self.stdout.write("        Erstellt/aktualisiert.")
        except Exception as e:
            self.stdout.write(self.style.WARNING(f"        Uebersprungen: {e}"))

    # ── Step 2: Main Tenant ───────────────────────────────────────────────

    def _create_main_tenant(self):
        """Create Hilfswerk Oesterreich as main tenant."""
        self.stdout.write("\n  [2/7] Hauptmandant erstellen...")

        main_org, created = Organization.objects.update_or_create(
            name="Hilfswerk Oesterreich",
            defaults={
                "description": "Hilfswerk Oesterreich – Dachverband",
                "org_type": Organization.OrgType.MAIN,
                "parent": None,
                "email": "office@hilfswerk.at",
                "phone": "+43 1 40 57 500",
                "street": "Grashofgasse 4",
                "city": "Wien",
                "postal_code": "1010",
                "country": "Oesterreich",
                "is_active": True,
                "is_deleted": False,
            },
        )

        status = "NEU" if created else "AKTUALISIERT"
        self.stdout.write(f"        {main_org.name} ({status})")
        return main_org

    # ── Step 3: Sub-Tenants (Bundeslaender) ───────────────────────────────

    def _create_bundeslaender(self, main_org):
        """Create 9 Bundesland sub-tenants with locations."""
        self.stdout.write("\n  [3/7] Bundeslaender und Schulen erstellen...")

        result = {}
        for bl in self.BUNDESLAENDER:
            # Sub-Tenant (Bundesland) – use update_or_create for idempotency
            sub_org, created = Organization.objects.update_or_create(
                name=bl["name"],
                defaults={
                    "description": f"{bl['name']} – Landesverband",
                    "org_type": Organization.OrgType.SUB,
                    "parent": main_org,
                    "email": bl["email"],
                    "phone": bl["phone"],
                    "street": bl["street"],
                    "city": bl["city"],
                    "postal_code": bl["postal_code"],
                    "country": "Oesterreich",
                    "is_active": True,
                    "is_deleted": False,
                },
            )

            # Location (Schule) – use update_or_create for idempotency
            school = bl["school"]
            location, loc_created = Location.objects.update_or_create(
                name=school["name"],
                organization=sub_org,
                defaults={
                    "description": f"GTS Betreuung {school['name']}",
                    "email": school["email"],
                    "phone": school["phone"],
                    "street": school["street"],
                    "city": school["city"],
                    "postal_code": school["postal_code"],
                    "is_active": True,
                    "is_deleted": False,
                },
            )

            status_org = "NEU" if created else "OK"
            status_loc = "NEU" if loc_created else "OK"
            self.stdout.write(
                f"        {bl['name']:35s} ({status_org}) | "
                f"{school['name']:25s} ({status_loc})"
            )

            result[bl["name"]] = {
                "org": sub_org,
                "location": location,
                "config": bl,
            }

        return result

    # ── Step 4: System Users (SuperAdmin, Admin) ──────────────────────────

    def _create_system_users(self, main_org, bundesland_data):
        """Create SuperAdmin and Admin users.

        Both are assigned to a Hauptstandort location under the main
        tenant (Hilfswerk Oesterreich) so that the TenantMiddleware
        correctly resolves their organization to the main tenant and
        grants cross-tenant access (Admin sees all sub-tenants).
        """
        self.stdout.write("\n  [4/7] System-Benutzer erstellen...")

        # Create a Hauptstandort location under the main tenant
        hauptstandort, hs_created = Location.objects.update_or_create(
            name="Hauptstandort Wien",
            organization=main_org,
            defaults={
                "description": "Zentrale des Hilfswerk Oesterreich",
                "email": "office@hilfswerk.at",
                "phone": "+43 1 40 57 500",
                "street": "Grashofgasse 4",
                "city": "Wien",
                "postal_code": "1010",
                "is_active": True,
                "is_deleted": False,
            },
        )
        self.stdout.write(
            f"        Hauptstandort: {hauptstandort.name} "
            f"({'NEU' if hs_created else 'AKTUALISIERT'})"
        )

        system_users = [
            {
                "username": "superadmin",
                "email": "superadmin@hilfswerk.at",
                "first_name": "Sarah",
                "last_name": "Superadmin",
                "role": User.Role.SUPER_ADMIN,
                "is_staff": True,
                "is_superuser": True,
                "location": hauptstandort,
                "group_name": "SuperAdmin",
            },
            {
                "username": "admin",
                "email": "admin@hilfswerk.at",
                "first_name": "Anna",
                "last_name": "Administratorin",
                "role": User.Role.ADMIN,
                "is_staff": True,
                "is_superuser": False,
                "location": hauptstandort,
                "group_name": "Admin",
            },
        ]

        for user_data in system_users:
            self._create_user(user_data)

    # ── Step 5: Bundesland Users ──────────────────────────────────────────

    def _create_bundesland_users(self, bundesland_data):
        """Create LocationManager and Educator for each Bundesland."""
        self.stdout.write("\n  [5/7] Standortleitungen und Paedagog:innen erstellen...")

        for bl_name, data in bundesland_data.items():
            config = data["config"]
            location = data["location"]

            # LocationManager
            mgr_data = {
                **config["manager"],
                "role": User.Role.LOCATION_MANAGER,
                "is_staff": False,
                "is_superuser": False,
                "location": location,
                "group_name": "LocationManager",
            }
            manager_user = self._create_user(mgr_data)

            # Always set as location manager (idempotent)
            if manager_user:
                location.manager = manager_user
                location.save(update_fields=["manager"])

            # Educator
            edu_data = {
                **config["educator"],
                "role": User.Role.EDUCATOR,
                "is_staff": False,
                "is_superuser": False,
                "location": location,
                "group_name": "Educator",
            }
            self._create_user(edu_data)

    # ── Step 6: Kaernten-spezifische Daten ────────────────────────────────

    def _create_kaernten_data(self, bundesland_data):
        """Create SchoolYear, Group, GroupMember, and Students for Kaernten."""
        self.stdout.write("\n  [6/7] Kaernten: Schuljahr, Gruppe und Schueler:innen...")

        kaernten = bundesland_data["Hilfswerk Kaernten"]
        location = kaernten["location"]
        org = kaernten["org"]

        # School Year 2025/2026 – use update_or_create
        school_year, sy_created = SchoolYear.objects.update_or_create(
            location=location,
            name="2025/2026",
            defaults={
                "organization": org,
                "start_date": datetime.date(2025, 9, 1),
                "end_date": datetime.date(2026, 7, 4),
                "is_active": True,
            },
        )
        self.stdout.write(
            f"        Schuljahr: {school_year.name} "
            f"({'NEU' if sy_created else 'AKTUALISIERT'})"
        )

        # Gruene Gruppe – use update_or_create to fix leader and organization
        try:
            educator = User.objects.get(username="amalia.bogdan")
        except User.DoesNotExist:
            educator = None

        group, g_created = Group.objects.update_or_create(
            location=location,
            school_year=school_year,
            name="Gruene Gruppe",
            defaults={
                "organization": org,
                "description": "Nachmittagsbetreuung fuer Schueler:innen der Klassen 1a-4b",
                "leader": educator,
                "balance": 0,
            },
        )
        self.stdout.write(
            f"        Gruppe: {group.name} ({'NEU' if g_created else 'AKTUALISIERT'})"
        )

        # Assign Amalia Bogdan as GroupMember – use update_or_create
        if educator:
            _, gm_created = GroupMember.objects.update_or_create(
                group=group,
                user=educator,
                defaults={
                    "organization": org,
                    "role": GroupMember.MemberRole.EDUCATOR,
                    "is_active": True,
                },
            )
            self.stdout.write(
                f"        Gruppenmitglied: {educator.get_full_name()} "
                f"({'NEU' if gm_created else 'AKTUALISIERT'})"
            )

        # Students: Delete ALL existing students for this group first,
        # then recreate exactly 26 to avoid duplicates.
        existing_count = Student.objects.filter(group=group).count()
        if existing_count > 0:
            Student.objects.filter(group=group).delete()
            self.stdout.write(
                f"        {existing_count} alte Schueler:innen geloescht (Neuanlage)."
            )

        student_count_new = 0
        for s in self.STUDENTS:
            Student.objects.create(
                group=group,
                organization=org,
                first_name=s["first_name"],
                last_name=s["last_name"],
                date_of_birth=datetime.date(
                    2018 if s["class"].startswith("1") else
                    2017 if s["class"].startswith("2") else
                    2016 if s["class"].startswith("3") else 2015,
                    3, 15,
                ),
            )
            student_count_new += 1

        self.stdout.write(
            f"        Schueler:innen: {student_count_new} erstellt (Gesamt: {len(self.STUDENTS)})"
        )

    # ── Step 7: System Settings ───────────────────────────────────────────

    def _update_system_settings(self):
        """Ensure system settings have correct values."""
        self.stdout.write("\n  [7/7] Systemeinstellungen aktualisieren...")

        from system.models import SystemSetting

        settings_to_update = {
            "organization_name": "Hilfswerk Oesterreich",
            "organization_email": "office@hilfswerk.at",
        }

        for key, value in settings_to_update.items():
            setting, created = SystemSetting.objects.update_or_create(
                key=key,
                defaults={"value": value},
            )
            status = "NEU" if created else "AKTUALISIERT"
            self.stdout.write(f"        {key} = {value} ({status})")

    # ── Helper: Create User ───────────────────────────────────────────────

    def _create_user(self, data: dict) -> User | None:
        """Create or update a single user and assign to Django Group."""
        is_superuser = data.pop("is_superuser", False)
        location = data.pop("location")
        group_name = data.pop("group_name")
        username = data["username"]
        email = data["email"]

        # Always use update_or_create for full idempotency
        user, created = User.objects.update_or_create(
            username=username,
            defaults={
                **data,
                "is_superuser": is_superuser,
                "is_active": True,
                "has_accepted_terms": True,
            },
        )

        # Always set password and location
        user.set_password(self.PASSWORD)
        user.location = location
        user.save(update_fields=["password", "location"])

        action = "ERSTELLT" if created else "AKTUALISIERT"

        # Assign to Django Permission Group
        try:
            auth_group = AuthGroup.objects.get(name=group_name)
            user.groups.clear()
            user.groups.add(auth_group)
            group_status = group_name
        except AuthGroup.DoesNotExist:
            group_status = f"'{group_name}' NICHT GEFUNDEN"

        self.stdout.write(
            f"        [{action:12s}] {data.get('first_name', '')} {data.get('last_name', ''):20s} "
            f"| {email:35s} | {group_status:15s} | {location.name}"
        )

        return user
