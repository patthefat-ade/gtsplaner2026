"""
Data migration to fix missing Umlaute in seeded Organization and Location names.
"""

from django.db import migrations


def fix_umlaute(apps, schema_editor):
    """Fix ASCII transliterations with correct German Umlaute."""
    Organization = apps.get_model("core", "Organization")
    Location = apps.get_model("core", "Location")

    # Fix Organization names
    org_replacements = {
        "Hilfswerk Kaernten": "Hilfswerk Kärnten",
    }
    for old_name, new_name in org_replacements.items():
        Organization.objects.filter(name=old_name).update(name=new_name)

    # Fix Location names and addresses
    location_replacements = {
        "VS Woelfnitz": "VS Wölfnitz",
    }
    for old_name, new_name in location_replacements.items():
        Location.objects.filter(name=old_name).update(name=new_name)

    # Fix street addresses
    Location.objects.filter(street__contains="Woelfnitzstrasse").update(
        street="Wölfnitzstraße 29"
    )


def fix_group_umlaute(apps, schema_editor):
    """Fix ASCII transliterations in Group names."""
    Group = apps.get_model("groups", "Group")

    group_replacements = {
        "Gruene Gruppe": "Grüne Gruppe",
    }
    for old_name, new_name in group_replacements.items():
        Group.objects.filter(name=old_name).update(name=new_name)


def noop(apps, schema_editor):
    """No-op reverse migration."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_alter_organization_logo_alter_user_profile_picture_and_more"),
        ("groups", "0014_alter_student_data_consent_guardian_name"),
    ]

    operations = [
        migrations.RunPython(fix_umlaute, noop),
        migrations.RunPython(fix_group_umlaute, noop),
    ]
