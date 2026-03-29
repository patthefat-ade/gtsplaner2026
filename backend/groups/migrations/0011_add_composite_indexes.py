"""
Add composite indexes for performance-critical queries.

These indexes optimise the most common query patterns:
- Tenant-scoped list queries (organization + date)
- Bulk operations (student + date lookups)
- Dashboard aggregations (organization + status)
"""

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("groups", "0010_dailyprotocol"),
    ]

    operations = [
        # Attendance: organization + date (tenant-scoped list queries)
        migrations.AddIndex(
            model_name="attendance",
            index=models.Index(
                fields=["organization", "date"],
                name="att_org_date_idx",
            ),
        ),
        # Attendance: organization + group + date (bulk endpoint)
        migrations.AddIndex(
            model_name="attendance",
            index=models.Index(
                fields=["organization", "group", "date"],
                name="att_org_grp_date_idx",
            ),
        ),
        # DailyProtocol: organization + date (tenant-scoped list queries)
        migrations.AddIndex(
            model_name="dailyprotocol",
            index=models.Index(
                fields=["organization", "date"],
                name="proto_org_date_idx",
            ),
        ),
        # DailyProtocol: organization + group + date (bulk endpoint)
        migrations.AddIndex(
            model_name="dailyprotocol",
            index=models.Index(
                fields=["organization", "group", "date"],
                name="proto_org_grp_date_idx",
            ),
        ),
        # Student: organization + group (tenant-scoped student list)
        migrations.AddIndex(
            model_name="student",
            index=models.Index(
                fields=["organization", "group"],
                name="student_org_grp_idx",
            ),
        ),
    ]
