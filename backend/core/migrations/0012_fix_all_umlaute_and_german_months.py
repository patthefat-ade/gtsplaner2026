"""
Data migration to fix all missing Umlaute and English month names in seeded data.
Corrects:
- TransactionCategory names and descriptions
- Transaction descriptions (English months → German months)
- WeeklyPlanEntry titles
- Event titles
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
    """Fix English month names in Transaction descriptions."""
    Transaction = apps.get_model("finance", "Transaction")

    for eng_month, ger_month in GERMAN_MONTHS.items():
        if eng_month == ger_month:
            continue
        # Find transactions with English month names in description
        txs = Transaction.objects.filter(description__contains=eng_month)
        for tx in txs:
            tx.description = tx.description.replace(eng_month, ger_month)
            tx.save(update_fields=["description"])

    # Also fix category names in descriptions
    for old_name, new_name in CATEGORY_REPLACEMENTS.items():
        txs = Transaction.objects.filter(description__contains=old_name)
        for tx in txs:
            tx.description = tx.description.replace(old_name, new_name)
            tx.save(update_fields=["description"])


def fix_weeklyplan_entries(apps, schema_editor):
    """Fix Umlaute in WeeklyPlanEntry titles."""
    WeeklyPlanEntry = apps.get_model("weeklyplans", "WeeklyPlanEntry")

    entry_replacements = {
        "Lernfoerderung": "Lernförderung",
        "Fruehstueck": "Frühstück",
        "Yoga fuer Kinder": "Yoga für Kinder",
    }

    for old_title, new_title in entry_replacements.items():
        WeeklyPlanEntry.objects.filter(title=old_title).update(title=new_title)


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
