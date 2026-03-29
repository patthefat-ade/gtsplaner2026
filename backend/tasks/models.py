"""
Task management models.

Provides a task assignment system where LocationManagers can create
and assign tasks to Educators. Tasks follow a simple workflow:
open → in_progress → done.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone

from core.models import TenantModel


class Task(TenantModel):
    """
    A task that can be assigned by a LocationManager to an Educator.

    Tasks have a title, description, due date, priority, and status.
    Status changes trigger in-app notifications to the task creator.
    """

    class Status(models.TextChoices):
        OPEN = "open", "Offen"
        IN_PROGRESS = "in_progress", "In Arbeit"
        DONE = "done", "Erledigt"

    class Priority(models.TextChoices):
        LOW = "low", "Niedrig"
        MEDIUM = "medium", "Mittel"
        HIGH = "high", "Hoch"

    title = models.CharField("Titel", max_length=200)
    description = models.TextField("Beschreibung", blank=True, default="")
    status = models.CharField(
        "Status",
        max_length=20,
        choices=Status.choices,
        default=Status.OPEN,
        db_index=True,
    )
    priority = models.CharField(
        "Priorität",
        max_length=10,
        choices=Priority.choices,
        default=Priority.MEDIUM,
    )
    due_date = models.DateField("Stichtag")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="created_tasks",
        verbose_name="Erstellt von",
    )
    assigned_to = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="assigned_tasks",
        verbose_name="Zugewiesen an",
    )
    location = models.ForeignKey(
        "core.Location",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        verbose_name="Standort",
    )
    group = models.ForeignKey(
        "groups.Group",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="tasks",
        verbose_name="Gruppe",
    )
    completed_at = models.DateTimeField("Erledigt am", null=True, blank=True)
    created_at = models.DateTimeField("Erstellt am", auto_now_add=True)
    updated_at = models.DateTimeField("Aktualisiert am", auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["organization", "status"],
                name="task_org_status_idx",
            ),
            models.Index(
                fields=["organization", "assigned_to"],
                name="task_org_assigned_idx",
            ),
            models.Index(
                fields=["organization", "due_date"],
                name="task_org_due_idx",
            ),
            models.Index(
                fields=["organization", "created_by"],
                name="task_org_creator_idx",
            ),
        ]
        verbose_name = "Aufgabe"
        verbose_name_plural = "Aufgaben"

    def __str__(self):
        return self.title

    @property
    def is_overdue(self):
        """Check if the task is overdue (past due_date and not done)."""
        if self.status == self.Status.DONE:
            return False
        return self.due_date < timezone.now().date()

    def mark_in_progress(self):
        """Set task status to in_progress."""
        self.status = self.Status.IN_PROGRESS
        self.completed_at = None
        self.save(update_fields=["status", "completed_at", "updated_at"])

    def mark_done(self):
        """Set task status to done and record completion time."""
        self.status = self.Status.DONE
        self.completed_at = timezone.now()
        self.save(update_fields=["status", "completed_at", "updated_at"])

    def reopen(self):
        """Reopen a task by setting status back to open."""
        self.status = self.Status.OPEN
        self.completed_at = None
        self.save(update_fields=["status", "completed_at", "updated_at"])
