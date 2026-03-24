"""Kassenbuch App v2 – Django Configuration Package."""

from .celery import app as celery_app

__all__ = ("celery_app",)
