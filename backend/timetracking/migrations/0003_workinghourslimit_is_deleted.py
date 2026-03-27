"""Add is_deleted field to WorkingHoursLimit for soft-delete support."""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("timetracking", "0002_leaverequest_organization_leavetype_organization_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="workinghourslimit",
            name="is_deleted",
            field=models.BooleanField(
                default=False,
                help_text="Soft-Delete: Markiert den Eintrag als gelöscht.",
                verbose_name="Gelöscht",
            ),
        ),
    ]
