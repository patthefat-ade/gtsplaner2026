"""
Management command to create a realistic multi-tenant test environment.

Creates the Hilfswerk Oesterreich hierarchy:
  - Main tenant: Hilfswerk Oesterreich (Hauptstandort Wien)
  - 9 Sub-tenants: one per Bundesland (Kaernten, Wien, NOe, Tirol, etc.)
  - Kaernten: 3 Schulstandorte (VS Annabichl, VS Woelfnitz, VS St. Ruprecht)
  - Wien: 2 Schulstandorte (VS Donaustadt, VS Favoriten)
  - Other Bundeslaender: 1 Schulstandort each
  - Each Schulstandort has a LocationManager, an Educator, a Group, and Students
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
    # Each Bundesland can have multiple schools (locations).

    BUNDESLAENDER = [
        {
            "name": "Hilfswerk Kaernten",
            "city": "Klagenfurt",
            "postal_code": "9020",
            "street": "8.-Mai-Strasse 47",
            "phone": "+43 463 55 800",
            "email": "office@kaernten.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Annabichl",
                    "city": "Klagenfurt",
                    "postal_code": "9020",
                    "street": "Annabichler Strasse 74",
                    "email": "vs.annabichl@klagenfurt.at",
                    "phone": "+43 463 537 5630",
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
                    "group_name": "Gruene Gruppe",
                    "students": [
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
                    ],
                },
                {
                    "name": "VS Woelfnitz",
                    "city": "Klagenfurt",
                    "postal_code": "9020",
                    "street": "Woelfnitzstrasse 1",
                    "email": "vs.woelfnitz@klagenfurt.at",
                    "phone": "+43 463 281 45",
                    "manager": {
                        "username": "sabine.schuster",
                        "email": "sabine.schuster@hilfswerk.at",
                        "first_name": "Sabine",
                        "last_name": "Schuster",
                    },
                    "educator": {
                        "username": "thomas.trost",
                        "email": "thomas.trost@hilfswerk.at",
                        "first_name": "Thomas",
                        "last_name": "Trost",
                    },
                    "group_name": "Blaue Gruppe",
                    "students": [
                        {"first_name": "Lisa", "last_name": "Koenig", "class": "1a"},
                        {"first_name": "Simon", "last_name": "Roth", "class": "1a"},
                        {"first_name": "Clara", "last_name": "Seidl", "class": "2a"},
                        {"first_name": "Fabian", "last_name": "Auer", "class": "2a"},
                        {"first_name": "Nora", "last_name": "Stadler", "class": "3a"},
                        {"first_name": "Philipp", "last_name": "Holzer", "class": "3a"},
                        {"first_name": "Lara", "last_name": "Binder", "class": "4a"},
                        {"first_name": "Florian", "last_name": "Karner", "class": "4a"},
                        {"first_name": "Johanna", "last_name": "Pfeifer", "class": "1b"},
                        {"first_name": "Daniel", "last_name": "Strasser", "class": "2b"},
                        {"first_name": "Eva", "last_name": "Zeller", "class": "3b"},
                        {"first_name": "Michael", "last_name": "Brandt", "class": "4b"},
                    ],
                },
                {
                    "name": "VS St. Ruprecht",
                    "city": "Klagenfurt",
                    "postal_code": "9020",
                    "street": "Kneippgasse 30",
                    "email": "vs.struprecht@klagenfurt.at",
                    "phone": "+43 463 310 60",
                    "manager": {
                        "username": "ursula.urban",
                        "email": "ursula.urban@hilfswerk.at",
                        "first_name": "Ursula",
                        "last_name": "Urban",
                    },
                    "educator": {
                        "username": "vera.vogel",
                        "email": "vera.vogel@hilfswerk.at",
                        "first_name": "Vera",
                        "last_name": "Vogel",
                    },
                    "group_name": "Rote Gruppe",
                    "students": [
                        {"first_name": "Marlene", "last_name": "Ortner", "class": "1a"},
                        {"first_name": "Sebastian", "last_name": "Frey", "class": "1a"},
                        {"first_name": "Helena", "last_name": "Novak", "class": "2a"},
                        {"first_name": "Raphael", "last_name": "Kainz", "class": "2a"},
                        {"first_name": "Theresa", "last_name": "Unger", "class": "3a"},
                        {"first_name": "Lorenz", "last_name": "Payer", "class": "3a"},
                        {"first_name": "Antonia", "last_name": "Lackner", "class": "4a"},
                        {"first_name": "Matthias", "last_name": "Kopp", "class": "4a"},
                        {"first_name": "Ida", "last_name": "Schreiber", "class": "1b"},
                        {"first_name": "Leonard", "last_name": "Lechner", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Wien",
            "city": "Wien",
            "postal_code": "1010",
            "street": "Schottenfeldgasse 29",
            "phone": "+43 1 512 36 61",
            "email": "office@wien.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Donaustadt",
                    "city": "Wien",
                    "postal_code": "1220",
                    "street": "Schuettpelzgasse 1",
                    "email": "vs.donaustadt@wien.gv.at",
                    "phone": "+43 1 203 22 41",
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
                    "group_name": "Gelbe Gruppe",
                    "students": [
                        {"first_name": "Luisa", "last_name": "Hartmann", "class": "1a"},
                        {"first_name": "Tim", "last_name": "Richter", "class": "1a"},
                        {"first_name": "Mila", "last_name": "Lehner", "class": "2a"},
                        {"first_name": "Oscar", "last_name": "Schmid", "class": "2a"},
                        {"first_name": "Ella", "last_name": "Kraus", "class": "3a"},
                        {"first_name": "Leo", "last_name": "Baumann", "class": "3a"},
                        {"first_name": "Sophia", "last_name": "Vogt", "class": "4a"},
                        {"first_name": "Finn", "last_name": "Sommer", "class": "4a"},
                        {"first_name": "Lina", "last_name": "Winter", "class": "1b"},
                        {"first_name": "Erik", "last_name": "Schober", "class": "2b"},
                        {"first_name": "Alina", "last_name": "Hahn", "class": "3b"},
                        {"first_name": "Julian", "last_name": "Keller", "class": "4b"},
                        {"first_name": "Zoe", "last_name": "Neumann", "class": "1a"},
                        {"first_name": "Nico", "last_name": "Dietrich", "class": "2a"},
                    ],
                },
                {
                    "name": "VS Favoriten",
                    "city": "Wien",
                    "postal_code": "1100",
                    "street": "Quellenstrasse 52",
                    "email": "vs.favoriten@wien.gv.at",
                    "phone": "+43 1 604 52 60",
                    "manager": {
                        "username": "walter.weiss",
                        "email": "walter.weiss@hilfswerk.at",
                        "first_name": "Walter",
                        "last_name": "Weiss",
                    },
                    "educator": {
                        "username": "xenia.xavier",
                        "email": "xenia.xavier@hilfswerk.at",
                        "first_name": "Xenia",
                        "last_name": "Xavier",
                    },
                    "group_name": "Orange Gruppe",
                    "students": [
                        {"first_name": "Hanna", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Niklas", "last_name": "Huber", "class": "1a"},
                        {"first_name": "Selina", "last_name": "Steiner", "class": "2a"},
                        {"first_name": "Dominik", "last_name": "Wagner", "class": "2a"},
                        {"first_name": "Chiara", "last_name": "Bauer", "class": "3a"},
                        {"first_name": "Kevin", "last_name": "Pichler", "class": "3a"},
                        {"first_name": "Vanessa", "last_name": "Moser", "class": "4a"},
                        {"first_name": "Patrick", "last_name": "Gruber", "class": "4a"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Niederoesterreich",
            "city": "St. Poelten",
            "postal_code": "3100",
            "street": "Ferstlergasse 4",
            "phone": "+43 2742 249",
            "email": "office@noe.hilfswerk.at",
            "schools": [
                {
                    "name": "VS St. Poelten Mitte",
                    "city": "St. Poelten",
                    "postal_code": "3100",
                    "street": "Grenzgasse 18",
                    "email": "vs.stpoelten-mitte@noeschule.at",
                    "phone": "+43 2742 352 140",
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
                    "group_name": "Lila Gruppe",
                    "students": [
                        {"first_name": "Katharina", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Stefan", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Magdalena", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "Andreas", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Verena", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Christoph", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Tirol",
            "city": "Innsbruck",
            "postal_code": "6020",
            "street": "Suedtiroler Platz 14-16",
            "phone": "+43 512 597 900",
            "email": "office@tirol.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Innsbruck West",
                    "city": "Innsbruck",
                    "postal_code": "6020",
                    "street": "Technikerstrasse 44",
                    "email": "vs.innsbruck-west@tsn.at",
                    "phone": "+43 512 584 263",
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
                    "group_name": "Silber Gruppe",
                    "students": [
                        {"first_name": "Marlene", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Florian", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Theresa", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "Markus", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Isabella", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Bernhard", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Burgenland",
            "city": "Eisenstadt",
            "postal_code": "7000",
            "street": "Ignaz-Till-Strasse 9",
            "phone": "+43 2682 651 50",
            "email": "office@bgld.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Eisenstadt",
                    "city": "Eisenstadt",
                    "postal_code": "7000",
                    "street": "Kalvarienbergplatz 8",
                    "email": "vs.eisenstadt@bildungsserver.com",
                    "phone": "+43 2682 622 57",
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
                    "group_name": "Tuerkis Gruppe",
                    "students": [
                        {"first_name": "Rosalie", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Gregor", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Celine", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "Lukas", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Amelie", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Tobias", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Steiermark",
            "city": "Graz",
            "postal_code": "8010",
            "street": "Grabenstrasse 90",
            "phone": "+43 316 813 182",
            "email": "office@stmk.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Graz Sued",
                    "city": "Graz",
                    "postal_code": "8020",
                    "street": "Triester Strasse 20",
                    "email": "vs.graz-sued@stmk.gv.at",
                    "phone": "+43 316 872 7830",
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
                    "group_name": "Weisse Gruppe",
                    "students": [
                        {"first_name": "Miriam", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Elias", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Paulina", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "Valentin", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Leni", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Samuel", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Oberoesterreich",
            "city": "Linz",
            "postal_code": "4020",
            "street": "Dametzstrasse 6",
            "phone": "+43 732 775 511",
            "email": "office@ooe.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Linz Mitte",
                    "city": "Linz",
                    "postal_code": "4020",
                    "street": "Hamerlingstrasse 3",
                    "email": "vs.linz-mitte@ooe.gv.at",
                    "phone": "+43 732 770 444",
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
                    "group_name": "Braune Gruppe",
                    "students": [
                        {"first_name": "Jasmin", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Maximilian", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Sophia", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "David", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Emily", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Fabian", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Salzburg",
            "city": "Salzburg",
            "postal_code": "5020",
            "street": "Auerspergstrasse 4",
            "phone": "+43 662 434 702",
            "email": "office@sbg.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Salzburg Stadt",
                    "city": "Salzburg",
                    "postal_code": "5020",
                    "street": "Faistauergasse 18",
                    "email": "vs.salzburg-stadt@salzburg.gv.at",
                    "phone": "+43 662 843 135",
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
                    "group_name": "Rosa Gruppe",
                    "students": [
                        {"first_name": "Lara", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Felix", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Mia", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "Jonas", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Emma", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Paul", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
        {
            "name": "Hilfswerk Vorarlberg",
            "city": "Bregenz",
            "postal_code": "6900",
            "street": "Rathausstrasse 2",
            "phone": "+43 5574 488 00",
            "email": "office@vlbg.hilfswerk.at",
            "schools": [
                {
                    "name": "VS Bregenz",
                    "city": "Bregenz",
                    "postal_code": "6900",
                    "street": "Belruptstrasse 37",
                    "email": "vs.bregenz@vobs.at",
                    "phone": "+43 5574 410 18",
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
                    "group_name": "Goldene Gruppe",
                    "students": [
                        {"first_name": "Anna", "last_name": "Berger", "class": "1a"},
                        {"first_name": "Simon", "last_name": "Huber", "class": "2a"},
                        {"first_name": "Lena", "last_name": "Steiner", "class": "3a"},
                        {"first_name": "Noah", "last_name": "Wagner", "class": "4a"},
                        {"first_name": "Sophie", "last_name": "Bauer", "class": "1b"},
                        {"first_name": "Ben", "last_name": "Pichler", "class": "2b"},
                    ],
                },
            ],
        },
    ]

    def _collect_all_usernames(self):
        """Dynamically collect all test usernames from config."""
        usernames = ["superadmin", "admin", "locationmanager", "educator"]
        for bl in self.BUNDESLAENDER:
            for school in bl["schools"]:
                usernames.append(school["manager"]["username"])
                usernames.append(school["educator"]["username"])
        return usernames

    def handle(self, *args, **options):
        self.stdout.write("\n" + "=" * 80)
        self.stdout.write("GTS Planer – Hilfswerk Oesterreich Testumgebung")
        self.stdout.write("=" * 80)

        self.ALL_TEST_USERNAMES = self._collect_all_usernames()
        errors = []

        # 0. Cleanup old test data to avoid FK conflicts
        try:
            self._cleanup_old_data()
        except Exception as e:
            errors.append(f"Cleanup: {e}")
            self.stdout.write(self.style.WARNING(f"  WARNUNG Cleanup: {e}"))

        # 1. Setup Permission Groups
        try:
            self._setup_permission_groups()
        except Exception as e:
            errors.append(f"Permissions: {e}")
            self.stdout.write(self.style.WARNING(f"  WARNUNG Permissions: {e}"))

        # 2. Create Main Tenant
        try:
            main_org = self._create_main_tenant()
        except Exception as e:
            errors.append(f"Main Tenant: {e}")
            self.stdout.write(self.style.ERROR(f"  FEHLER Main Tenant: {e}"))
            return  # Cannot continue without main org

        # 3. Create Sub-Tenants (9 Bundeslaender) with all Schools
        try:
            bundesland_data = self._create_bundeslaender(main_org)
        except Exception as e:
            errors.append(f"Bundeslaender: {e}")
            self.stdout.write(self.style.ERROR(f"  FEHLER Bundeslaender: {e}"))
            return  # Cannot continue without sub-tenants

        # 4. Create SuperAdmin and Admin
        try:
            self._create_system_users(main_org)
        except Exception as e:
            errors.append(f"System Users: {e}")
            self.stdout.write(self.style.WARNING(f"  WARNUNG System Users: {e}"))

        # 5. Create LocationManagers and Educators per School
        try:
            self._create_school_users(bundesland_data)
        except Exception as e:
            errors.append(f"School Users: {e}")
            self.stdout.write(self.style.WARNING(f"  WARNUNG School Users: {e}"))

        # 6. Create School Year, Groups, and Students for all Schools
        try:
            self._create_school_data(bundesland_data)
        except Exception as e:
            errors.append(f"School Data: {e}")
            self.stdout.write(self.style.WARNING(f"  WARNUNG School Data: {e}"))

        # 7. Update SystemSettings
        try:
            self._update_system_settings()
        except Exception as e:
            errors.append(f"Settings: {e}")
            self.stdout.write(self.style.WARNING(f"  WARNUNG Settings: {e}"))

        self.stdout.write("\n" + "=" * 80)
        if errors:
            self.stdout.write(
                self.style.WARNING(
                    f"Testumgebung mit {len(errors)} Warnungen erstellt."
                )
            )
            for err in errors:
                self.stdout.write(self.style.WARNING(f"  - {err}"))
        else:
            self.stdout.write(
                self.style.SUCCESS("Testumgebung erfolgreich erstellt/aktualisiert.")
            )
        self.stdout.write("=" * 80 + "\n")

    # ── Step 0: Cleanup ───────────────────────────────────────────────────

    def _cleanup_old_data(self):
        """Remove old test data to avoid FK constraint violations."""
        self.stdout.write("\n  [0/7] Alte Testdaten bereinigen...")

        try:
            # 1. Nullify location FK on all test users
            old_users = User.objects.filter(username__in=self.ALL_TEST_USERNAMES)
            count = old_users.count()
            if count > 0:
                old_users.update(location=None)
                self.stdout.write(f"        {count} Benutzer: location auf NULL gesetzt.")

            # 2. Nullify leader FK on all groups led by test users
            from groups.models import Group as GrpModel
            grp_count = GrpModel.objects.filter(
                leader__username__in=self.ALL_TEST_USERNAMES
            ).update(leader=None)
            if grp_count:
                self.stdout.write(f"        {grp_count} Gruppen: leader auf NULL gesetzt.")

            # 3. Nullify manager FK on all locations managed by test users
            loc_mgr_count = Location.objects.filter(
                manager__username__in=self.ALL_TEST_USERNAMES
            ).update(manager=None)
            if loc_mgr_count:
                self.stdout.write(f"        {loc_mgr_count} Standorte: manager auf NULL gesetzt.")

            # 4. Remove GroupMember entries for legacy users
            gm_count = GroupMember.objects.filter(
                user__username__in=["locationmanager", "educator"]
            ).delete()[0]
            if gm_count:
                self.stdout.write(f"        {gm_count} GroupMember-Eintraege geloescht.")

            # 5. Delete non-Hilfswerk locations (legacy)
            old_locations = Location.objects.exclude(
                organization__name__startswith="Hilfswerk"
            ).exclude(name="Hauptstandort Wien")
            loc_count = old_locations.count()
            if loc_count > 0:
                old_locations.delete()
                self.stdout.write(f"        {loc_count} alte Standorte geloescht.")

            # 6. Delete legacy users (old generic test accounts)
            legacy_users = User.objects.filter(
                username__in=["locationmanager", "educator"]
            )
            legacy_count = legacy_users.count()
            if legacy_count > 0:
                legacy_users.delete()
                self.stdout.write(f"        {legacy_count} Legacy-Benutzer geloescht.")

            if count == 0 and loc_count == 0 and legacy_count == 0:
                self.stdout.write("        Keine alten Daten gefunden.")

        except Exception as e:
            self.stdout.write(
                self.style.WARNING(f"        Cleanup-Fehler (wird fortgesetzt): {e}")
            )

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

    # ── Step 3: Sub-Tenants (Bundeslaender) with Schools ──────────────────

    def _create_bundeslaender(self, main_org):
        """Create 9 Bundesland sub-tenants with n schools each."""
        self.stdout.write("\n  [3/7] Bundeslaender und Schulen erstellen...")

        result = {}
        for bl in self.BUNDESLAENDER:
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

            locations = []
            for school_cfg in bl["schools"]:
                location, loc_created = Location.objects.update_or_create(
                    name=school_cfg["name"],
                    organization=sub_org,
                    defaults={
                        "description": f"GTS Betreuung {school_cfg['name']}",
                        "email": school_cfg["email"],
                        "phone": school_cfg["phone"],
                        "street": school_cfg["street"],
                        "city": school_cfg["city"],
                        "postal_code": school_cfg["postal_code"],
                        "is_active": True,
                        "is_deleted": False,
                    },
                )
                locations.append({
                    "location": location,
                    "config": school_cfg,
                    "created": loc_created,
                })

                status_loc = "NEU" if loc_created else "OK"
                self.stdout.write(
                    f"        {bl['name']:35s} | {school_cfg['name']:25s} ({status_loc})"
                )

            result[bl["name"]] = {
                "org": sub_org,
                "locations": locations,
            }

        return result

    # ── Step 4: System Users (SuperAdmin, Admin) ──────────────────────────

    def _create_system_users(self, main_org):
        """Create SuperAdmin and Admin users at Hauptstandort Wien."""
        self.stdout.write("\n  [4/7] System-Benutzer erstellen...")

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

    # ── Step 5: School Users (LocationManager + Educator per School) ──────

    def _create_school_users(self, bundesland_data):
        """Create LocationManager and Educator for each school."""
        self.stdout.write("\n  [5/7] Standortleitungen und Paedagog:innen erstellen...")

        created_count = 0
        error_count = 0

        for bl_name, data in bundesland_data.items():
            for loc_data in data["locations"]:
                location = loc_data["location"]
                config = loc_data["config"]

                # LocationManager
                try:
                    mgr_data = {
                        **config["manager"],
                        "role": User.Role.LOCATION_MANAGER,
                        "is_staff": False,
                        "is_superuser": False,
                        "location": location,
                        "group_name": "LocationManager",
                    }
                    manager_user = self._create_user(mgr_data)
                    created_count += 1

                    if manager_user:
                        location.manager = manager_user
                        location.save(update_fields=["manager"])
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"        FEHLER Manager {config['manager']['username']}: {e}"
                        )
                    )

                # Educator
                try:
                    edu_data = {
                        **config["educator"],
                        "role": User.Role.EDUCATOR,
                        "is_staff": False,
                        "is_superuser": False,
                        "location": location,
                        "group_name": "Educator",
                    }
                    self._create_user(edu_data)
                    created_count += 1
                except Exception as e:
                    error_count += 1
                    self.stdout.write(
                        self.style.WARNING(
                            f"        FEHLER Educator {config['educator']['username']}: {e}"
                        )
                    )

        self.stdout.write(
            f"        Gesamt: {created_count} erstellt, {error_count} Fehler."
        )

    # ── Step 6: School Data (SchoolYear, Groups, Students) ────────────────

    def _create_school_data(self, bundesland_data):
        """Create SchoolYear, Group, GroupMember, and Students for each school."""
        self.stdout.write("\n  [6/7] Schuljahre, Gruppen und Schueler:innen erstellen...")

        total_students = 0

        for bl_name, data in bundesland_data.items():
            org = data["org"]

            for loc_data in data["locations"]:
                location = loc_data["location"]
                config = loc_data["config"]

                # School Year 2025/2026
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

                # Group
                try:
                    educator = User.objects.get(username=config["educator"]["username"])
                except User.DoesNotExist:
                    educator = None

                group_name = config.get("group_name", f"Gruppe {location.name}")
                group, g_created = Group.objects.update_or_create(
                    location=location,
                    school_year=school_year,
                    name=group_name,
                    defaults={
                        "organization": org,
                        "description": f"Nachmittagsbetreuung {location.name}",
                        "leader": educator,
                        "balance": 0,
                    },
                )

                # GroupMember (Educator)
                if educator:
                    GroupMember.objects.update_or_create(
                        group=group,
                        user=educator,
                        defaults={
                            "organization": org,
                            "role": GroupMember.MemberRole.EDUCATOR,
                            "is_active": True,
                        },
                    )

                # Students: Delete existing and recreate
                students_cfg = config.get("students", [])
                existing_count = Student.objects.filter(group=group).count()
                if existing_count > 0:
                    Student.objects.filter(group=group).delete()

                for s in students_cfg:
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

                total_students += len(students_cfg)

                self.stdout.write(
                    f"        {location.name:25s} | {group_name:20s} | "
                    f"{len(students_cfg)} Schueler:innen"
                )

        self.stdout.write(f"\n        Gesamt: {total_students} Schueler:innen erstellt.")

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

        user, created = User.objects.update_or_create(
            username=username,
            defaults={
                **data,
                "is_superuser": is_superuser,
                "is_active": True,
                "has_accepted_terms": True,
            },
        )

        user.set_password(self.PASSWORD)
        user.location = location
        user.save(update_fields=["password", "location"])

        action = "ERSTELLT" if created else "AKTUALISIERT"

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
