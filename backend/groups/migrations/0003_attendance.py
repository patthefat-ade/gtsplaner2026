"""
Migration for Attendance model.
"""

from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("core", "0001_initial"),
        ("groups", "0002_alter_group_options_alter_groupmember_options_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="Attendance",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "date",
                    models.DateField(db_index=True, verbose_name="Datum"),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("present", "Anwesend"),
                            ("absent", "Abwesend"),
                            ("sick", "Krank"),
                            ("excused", "Beurlaubt"),
                        ],
                        default="present",
                        max_length=20,
                        verbose_name="Status",
                    ),
                ),
                (
                    "notes",
                    models.TextField(
                        blank=True, default="", verbose_name="Notizen"
                    ),
                ),
                (
                    "is_deleted",
                    models.BooleanField(
                        default=False, verbose_name="Gelöscht"
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "group",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendances",
                        to="groups.group",
                        verbose_name="Gruppe",
                    ),
                ),
                (
                    "organization",
                    models.ForeignKey(
                        blank=True,
                        db_index=True,
                        null=True,
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(app_label)s_%(class)s_set",
                        to="core.organization",
                        verbose_name="Organisation",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="recorded_attendances",
                        to=settings.AUTH_USER_MODEL,
                        verbose_name="Erfasst von",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="attendances",
                        to="groups.student",
                        verbose_name="Schüler:in",
                    ),
                ),
            ],
            options={
                "verbose_name": "Anwesenheit",
                "verbose_name_plural": "Anwesenheiten",
                "ordering": ["-date", "student__first_name"],
                "indexes": [
                    models.Index(
                        fields=["organization"],
                        name="groups_atte_organiz_idx",
                    ),
                    models.Index(
                        fields=["group", "date"],
                        name="groups_atte_group_date_idx",
                    ),
                    models.Index(
                        fields=["student", "date"],
                        name="groups_atte_student_date_idx",
                    ),
                    models.Index(
                        fields=["date", "status"],
                        name="groups_atte_date_status_idx",
                    ),
                ],
                "unique_together": {("student", "date")},
            },
        ),
    ]
