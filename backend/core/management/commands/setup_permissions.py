"""
Management command to create Django Permission Groups and custom permissions.

Creates the four role-based groups (Educator, LocationManager, Admin, SuperAdmin)
and assigns the appropriate custom permissions to each group.

Usage:
    python manage.py setup_permissions
    python manage.py setup_permissions --reset  # Remove and recreate all groups
"""

from django.contrib.auth.models import Group, Permission
from django.contrib.contenttypes.models import ContentType
from django.core.management.base import BaseCommand

from core.models import User


# Permission definitions: (codename, name)
# These codenames are referenced by both the backend (views) and frontend
# (use-permissions.ts, sidebar.tsx, route-guard.tsx).
CUSTOM_PERMISSIONS = [
    # Dashboard
    ("view_dashboard", "Dashboard anzeigen"),
    # Groups
    ("view_own_groups", "Eigene Gruppen anzeigen"),
    ("manage_groups", "Gruppen erstellen und bearbeiten"),
    # Finance
    ("view_own_transactions", "Eigene Transaktionen anzeigen"),
    ("create_transactions", "Transaktionen erstellen"),
    ("manage_transactions", "Alle Transaktionen verwalten"),
    ("approve_transactions", "Transaktionen genehmigen"),
    ("manage_categories", "Kategorien verwalten"),
    ("view_reports", "Berichte einsehen"),
    # Students
    ("view_students", "Schueler anzeigen"),
    ("manage_students", "Schueler verwalten"),
    # Timetracking
    ("view_own_timeentries", "Eigene Zeiteintraege anzeigen"),
    ("manage_timeentries", "Alle Zeiteintraege verwalten"),
    ("approve_leave", "Abwesenheiten genehmigen"),
    # Admin
    ("manage_users", "Benutzer verwalten"),
    ("view_audit_log", "Audit-Log einsehen"),
    ("manage_settings", "Systemeinstellungen verwalten"),
    ("manage_organizations", "Organisationen verwalten"),
    # Locations
    ("view_locations", "Standorte anzeigen"),
    ("manage_locations", "Standorte verwalten"),
    # Weekly Plans
    ("view_weeklyplans", "Wochenplaene anzeigen"),
    ("manage_weeklyplans", "Wochenplaene erstellen und bearbeiten"),
    # Tasks
    ("view_tasks", "Aufgaben anzeigen"),
    ("manage_tasks", "Aufgaben erstellen und verwalten"),
    # Multi-Tenant
    ("cross_tenant_access", "Mandantenuebergreifender Zugriff"),
]

# Group -> Permission mapping
# Each role inherits all permissions of the roles below it, plus its own.
GROUP_PERMISSIONS = {
    "Educator": [
        # Dashboard
        "view_dashboard",
        # Groups: can view own groups and manage students in own groups
        "view_own_groups",
        "view_students",
        "manage_students",
        # Locations: can view own location (read-only)
        "view_locations",
        # Finance: can view and create own transactions
        "view_own_transactions",
        "create_transactions",
        # Timetracking: can view and create own time entries
        "view_own_timeentries",
        "manage_timeentries",
        # Weekly Plans: can view and manage own group plans
        "view_weeklyplans",
        "manage_weeklyplans",
        # Tasks: can view own assigned tasks
        "view_tasks",
    ],
    "LocationManager": [
        # Dashboard
        "view_dashboard",
        # Groups: full management
        "view_own_groups",
        "manage_groups",
        "view_students",
        "manage_students",
        # Locations: can view and manage own location
        "view_locations",
        "manage_locations",
        # Finance: full management
        "view_own_transactions",
        "create_transactions",
        "manage_transactions",
        "approve_transactions",
        "manage_categories",
        "view_reports",
        # Timetracking: full management
        "view_own_timeentries",
        "manage_timeentries",
        "approve_leave",
        # Weekly Plans: full management
        "view_weeklyplans",
        "manage_weeklyplans",
        # Tasks: full management
        "view_tasks",
        "manage_tasks",
    ],
    "Admin": [
        # Dashboard
        "view_dashboard",
        # Groups: full management
        "view_own_groups",
        "manage_groups",
        "view_students",
        "manage_students",
        # Locations: full management
        "view_locations",
        "manage_locations",
        # Finance: full management
        "view_own_transactions",
        "create_transactions",
        "manage_transactions",
        "approve_transactions",
        "manage_categories",
        "view_reports",
        # Timetracking: full management
        "view_own_timeentries",
        "manage_timeentries",
        "approve_leave",
        # Weekly Plans: full management
        "view_weeklyplans",
        "manage_weeklyplans",
        # Tasks: full management
        "view_tasks",
        "manage_tasks",
        # Admin: user and settings management
        "manage_users",
        "view_audit_log",
        "manage_settings",
        # Organizations: read access (write is SuperAdmin only)
        "manage_organizations",
    ],
    "SuperAdmin": [
        # Dashboard
        "view_dashboard",
        # Groups: full management
        "view_own_groups",
        "manage_groups",
        "view_students",
        "manage_students",
        # Locations: full management
        "view_locations",
        "manage_locations",
        # Finance: full management
        "view_own_transactions",
        "create_transactions",
        "manage_transactions",
        "approve_transactions",
        "manage_categories",
        "view_reports",
        # Timetracking: full management
        "view_own_timeentries",
        "manage_timeentries",
        "approve_leave",
        # Admin: full management
        "manage_users",
        "view_audit_log",
        "manage_settings",
        "manage_organizations",
        # Weekly Plans: full management
        "view_weeklyplans",
        "manage_weeklyplans",
        # Tasks: full management
        "view_tasks",
        "manage_tasks",
        # Multi-Tenant: cross-tenant access
        "cross_tenant_access",
    ],
}

# Mapping from User.Role to Django Group name
ROLE_TO_GROUP = {
    User.Role.EDUCATOR: "Educator",
    User.Role.LOCATION_MANAGER: "LocationManager",
    User.Role.ADMIN: "Admin",
    User.Role.SUPER_ADMIN: "SuperAdmin",
}


class Command(BaseCommand):
    help = "Create Django Permission Groups and assign custom permissions."

    def add_arguments(self, parser):
        parser.add_argument(
            "--reset",
            action="store_true",
            help="Remove and recreate all groups and permissions.",
        )
        parser.add_argument(
            "--migrate-users",
            action="store_true",
            help="Assign existing users to groups based on their role field.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING("Setting up permissions..."))

        if options["reset"]:
            self._reset_groups()

        self._create_permissions()
        self._create_groups()

        if options["migrate_users"]:
            self._migrate_users()

        self.stdout.write(self.style.SUCCESS("Permissions setup complete."))

    def _reset_groups(self):
        """Remove all custom groups."""
        for group_name in GROUP_PERMISSIONS:
            Group.objects.filter(name=group_name).delete()
            self.stdout.write(f"  Deleted group: {group_name}")

    def _create_permissions(self):
        """Create custom permissions on the User content type."""
        content_type = ContentType.objects.get_for_model(User)

        for codename, name in CUSTOM_PERMISSIONS:
            perm, created = Permission.objects.get_or_create(
                codename=codename,
                content_type=content_type,
                defaults={"name": name},
            )
            if created:
                self.stdout.write(f"  Created permission: {codename}")
            else:
                self.stdout.write(f"  Permission exists: {codename}")

    def _create_groups(self):
        """Create groups and assign permissions."""
        content_type = ContentType.objects.get_for_model(User)

        for group_name, perm_codenames in GROUP_PERMISSIONS.items():
            group, created = Group.objects.get_or_create(name=group_name)
            action = "Created" if created else "Updated"

            permissions = Permission.objects.filter(
                codename__in=perm_codenames,
                content_type=content_type,
            )
            group.permissions.set(permissions)

            self.stdout.write(
                f"  {action} group: {group_name} "
                f"({permissions.count()} permissions)"
            )

    def _migrate_users(self):
        """Assign existing users to groups based on their role field."""
        migrated = 0
        for user in User.objects.all():
            group_name = ROLE_TO_GROUP.get(user.role)
            if group_name:
                group = Group.objects.get(name=group_name)
                user.groups.add(group)
                migrated += 1
                self.stdout.write(
                    f"  Assigned {user.email} -> {group_name}"
                )

        self.stdout.write(
            self.style.SUCCESS(f"  Migrated {migrated} users to groups.")
        )
