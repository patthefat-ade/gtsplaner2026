"""
Management command to initialize default email notification configurations.

Usage:
    python manage.py init_notification_configs
"""

from django.core.management.base import BaseCommand

from system.models import EmailNotificationConfig


class Command(BaseCommand):
    help = "Initialize default email notification configurations for all event types."

    def handle(self, *args, **options):
        self.stdout.write(self.style.MIGRATE_HEADING(
            "=" * 70 + "\n"
            "GTS Planer – E-Mail-Benachrichtigungen initialisieren\n"
            "=" * 70
        ))

        created_count = 0
        for event_type, label in EmailNotificationConfig.EventType.choices:
            _, created = EmailNotificationConfig.objects.get_or_create(
                event_type=event_type,
                defaults={
                    "is_enabled": True,
                    "notify_super_admins": True,
                    "notify_user": True,
                },
            )
            status = "ERSTELLT" if created else "EXISTIERT"
            if created:
                created_count += 1
            self.stdout.write(f"  [{status}] {label} ({event_type})")

        self.stdout.write(self.style.MIGRATE_HEADING("=" * 70))
        self.stdout.write(self.style.SUCCESS(
            f"\n✓ {created_count} neue Konfigurationen erstellt, "
            f"{len(EmailNotificationConfig.EventType.choices) - created_count} bereits vorhanden."
        ))
