"""
Student Contact API views.

Provides CRUD operations for managing contact persons and authorized
pickup persons for students.

Access control:
- Educators: Read access for students in their groups
- LocationManager+: Full CRUD
- Admin/SuperAdmin: Full access within tenant

Tenant isolation is provided by TenantViewSetMixin.
"""

from django.db.models import Q
from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, viewsets

from core.mixins import TenantViewSetMixin
from core.permissions import (
    GROUP_HIERARCHY,
    GROUP_LOCATION_MANAGER,
    IsEducator,
    get_user_hierarchy_level,
    require_permission,
)
from groups.models_contacts import StudentContact
from groups.serializers_contacts import (
    StudentContactCreateSerializer,
    StudentContactListSerializer,
)


class StudentContactFilter(django_filters.FilterSet):
    """Filter for student contact records."""

    student_id = django_filters.NumberFilter(field_name="student_id")
    is_primary = django_filters.BooleanFilter(field_name="is_primary")
    relationship = django_filters.ChoiceFilter(
        choices=StudentContact.Relationship.choices
    )

    class Meta:
        model = StudentContact
        fields = ["student_id", "is_primary", "relationship"]


@extend_schema_view(
    list=extend_schema(tags=["Kontaktpersonen"]),
    retrieve=extend_schema(tags=["Kontaktpersonen"]),
    create=extend_schema(tags=["Kontaktpersonen"]),
    update=extend_schema(tags=["Kontaktpersonen"]),
    partial_update=extend_schema(tags=["Kontaktpersonen"]),
    destroy=extend_schema(tags=["Kontaktpersonen"]),
)
class StudentContactViewSet(TenantViewSetMixin, viewsets.ModelViewSet):
    """
    CRUD for student contact persons.

    Endpoints:
    - GET /contacts/ - List all contacts (filterable by student_id)
    - POST /contacts/ - Create a new contact
    - GET /contacts/{id}/ - Retrieve a contact
    - PATCH /contacts/{id}/ - Update a contact
    - DELETE /contacts/{id}/ - Soft-delete a contact

    Permissions:
    - Educators: Read access for students in their groups
    - LocationManager+: Full CRUD
    - Admin/SuperAdmin: Full access within tenant
    """

    queryset = StudentContact.objects.all()
    filterset_class = StudentContactFilter
    ordering_fields = ["created_at", "is_primary", "last_name"]
    ordering = ["-is_primary", "last_name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return StudentContact.objects.none()

        qs = super().get_queryset()
        qs = qs.filter(is_deleted=False).select_related("student", "student__group")

        user = self.request.user
        level = get_user_hierarchy_level(user)

        if level >= GROUP_HIERARCHY[GROUP_LOCATION_MANAGER]:
            return qs

        # Educators see contacts for students in their groups
        return qs.filter(
            Q(student__group__members__user=user)
            | Q(student__group__leader=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return StudentContactCreateSerializer
        return StudentContactListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [
            permissions.IsAuthenticated(),
            require_permission("manage_students")(),
        ]

    def perform_destroy(self, instance):
        """Soft delete."""
        instance.is_deleted = True
        instance.save()
