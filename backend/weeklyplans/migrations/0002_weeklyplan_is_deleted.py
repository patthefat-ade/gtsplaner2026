"""Add is_deleted field to WeeklyPlan for soft-delete support."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("weeklyplans", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="weeklyplan",
            name="is_deleted",
            field=models.BooleanField(
                default=False,
                help_text="Soft-Delete: Markiert den Plan als gelöscht, ohne ihn aus der DB zu entfernen.",
                verbose_name="Gelöscht",
            ),
        ),
    ]
