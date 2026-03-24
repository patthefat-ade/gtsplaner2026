"""
Celery configuration for Kassenbuch App v2.

Handles asynchronous tasks such as email notifications,
report generation, and compliance checks.
"""

import os

from celery import Celery

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

app = Celery("kassenbuch")
app.config_from_object("django.conf:settings", namespace="CELERY")
app.autodiscover_tasks()


@app.task(bind=True, ignore_result=True)
def debug_task(self) -> None:
    """Debug task to verify Celery is working correctly."""
    print(f"Request: {self.request!r}")
