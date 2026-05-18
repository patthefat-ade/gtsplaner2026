"""
Data migration to fix all missing Umlaute and English month names in seeded data.
Corrects:
- TransactionCategory names and descriptions
- Transaction descriptions (English months → German months)
- WeeklyPlanEntry activity names

IMPORTANT: Uses QuerySet.update() and raw SQL instead of .save() to avoid
triggering post_save signals (AuditLog) which fail during migrations because
the signal handler cannot determine organization_id from the migration context.
"""

from django.db import migrations


GERMAN_MONTHS = {
    "January": "Jänner",
    "February": "Februar",
    "March": "März",
    "April": "April",
    "May": "Mai",
    "June": "Juni",
    "July": "Juli",
    "August": "August",
    "September": "September",
    "October": "Oktober",
    "November": "November",
    "December": "Dezember",
}

# Category name replacements (old ASCII → new with Umlaute)
CATEGORY_REPLACEMENTS = {
    "Sportgeraete": "Sportgeräte",
    "Bueromaterial": "Büromaterial",
    "Elternbeitraege": "Elternbeiträge",
    "Foerderungen": "Förderungen",
}

CATEGORY_DESC_REPLACEMENTS = {
    "Snacks und Getraenke": "Snacks und Getränke",
    "Sportgeraete und Zubehoer": "Sportgeräte und Zubehör",
    "Buerobedarf und Druckmaterial": "Bürobedarf und Druckmaterial",
    "Monatliche Elternbeitraege": "Monatliche Elternbeiträge",
    "Oeffentliche Foerderungen": "Öffentliche Förderungen",
}


def fix_transaction_categories(apps, schema_editor):
    """Fix Umlaute in TransactionCategory names and descriptions."""
    TransactionCategory = apps.get_model("finance", "TransactionCategory")

    for old_name, new_name in CATEGORY_REPLACEMENTS.items():
        TransactionCategory.objects.filter(name=old_name).update(name=new_name)

    for old_desc, new_desc in CATEGORY_DESC_REPLACEMENTS.items():
        TransactionCategory.objects.filter(description=old_desc).update(
            description=new_desc
        )


def fix_transaction_descriptions(apps, schema_editor):
    """
    Fix English month names in Transaction descriptions.

    Uses raw SQL REPLACE() to avoid triggering post_save signals.
    The AuditLog signal handler fails during migrations because it cannot
    determine organization_id without a request context.
    """
    db_alias = schema_editor.connection.alias

    # Replace English month names with German equivalents using SQL REPLACE
    for eng_month, ger_month in GERMAN_MONTHS.items():
        if eng_month == ger_month:
            continue
        # Use raw SQL to avoid triggering Django signals
        schema_editor.execute(
            "UPDATE finance_transaction SET description = REPLACE(description, %s, %s) "
            "WHERE description LIKE %s",
            [eng_month, ger_month, f"%{eng_month}%"],
        )

    # Also fix category names in descriptions
    for old_name, new_name in CATEGORY_REPLACEMENTS.items():
        schema_editor.execute(
            "UPDATE finance_transaction SET description = REPLACE(description, %s, %s) "
            "WHERE description LIKE %s",
            [old_name, new_name, f"%{old_name}%"],
        )


def fix_weeklyplan_entries(apps, schema_editor):
    """Fix Umlaute in WeeklyPlanEntry activity names."""
    WeeklyPlanEntry = apps.get_model("weeklyplans", "WeeklyPlanEntry")

    # WeeklyPlanEntry uses 'activity' field, not 'title'
    entry_replacements = {
        "Lernfoerderung": "Lernförderung",
        "Fruehstueck": "Frühstück",
        "Yoga fuer Kinder": "Yoga für Kinder",
    }

    for old_activity, new_activity in entry_replacements.items():
        WeeklyPlanEntry.objects.filter(activity=old_activity).update(
            activity=new_activity
        )


def noop(apps, schema_editor):
    """No-op reverse migration."""
    pass


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_fix_umlaute_in_seed_data"),
        ("finance", "0005_alter_receipt_file"),
        ("weeklyplans", "0003_weeklyplan_school_year_weeklyplan_weekly_theme_and_more"),
    ]

    operations = [
        migrations.RunPython(fix_transaction_categories, noop),
        migrations.RunPython(fix_transaction_descriptions, noop),
        migrations.RunPython(fix_weeklyplan_entries, noop),
    ]
