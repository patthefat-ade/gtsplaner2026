"""
Groups API views: SchoolYear, Semester, Group, GroupMember, Student ViewSets.

Includes CRUD operations with RBAC-based access control.
"""

from django.db.models import Q
from django_filters import rest_framework as django_filters
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.permissions import IsEducator, IsLocationManagerOrAbove
from groups.models import Group, GroupMember, SchoolYear, Semester, Student
from groups.serializers import (
    GroupCreateSerializer,
    GroupDetailSerializer,
    GroupListSerializer,
    GroupMemberCreateSerializer,
    GroupMemberSerializer,
    SchoolYearCreateSerializer,
    SchoolYearListSerializer,
    SemesterSerializer,
    StudentCreateSerializer,
    StudentDetailSerializer,
    StudentListSerializer,
)


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------

class SchoolYearFilter(django_filters.FilterSet):
    """Filter for school years."""

    location_id = django_filters.NumberFilter(field_name="location_id")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = SchoolYear
        fields = ["location_id", "is_active"]


class GroupFilter(django_filters.FilterSet):
    """Filter for groups."""

    location_id = django_filters.NumberFilter(field_name="location_id")
    school_year_id = django_filters.NumberFilter(field_name="school_year_id")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Group
        fields = ["location_id", "school_year_id", "is_active"]


class StudentFilter(django_filters.FilterSet):
    """Filter for students."""

    group_id = django_filters.NumberFilter(field_name="group_id")
    is_active = django_filters.BooleanFilter()

    class Meta:
        model = Student
        fields = ["group_id", "is_active"]


# ---------------------------------------------------------------------------
# SchoolYear ViewSet
# ---------------------------------------------------------------------------

class SchoolYearViewSet(viewsets.ModelViewSet):
    """
    CRUD for school years.

    - Educators: read-only access to their location's school years
    - LocationManager+: full CRUD
    """

    filterset_class = SchoolYearFilter
    search_fields = ["name"]
    ordering_fields = ["name", "start_date", "created_at"]
    ordering = ["-start_date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return SchoolYear.objects.none()
        user = self.request.user
        qs = SchoolYear.objects.filter(is_deleted=False).select_related("location")
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.location:
            return qs.filter(location=user.location)
        return qs.none()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return SchoolYearCreateSerializer
        return SchoolYearListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]

    def perform_create(self, serializer):
        serializer.save(location=self.request.user.location)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


# ---------------------------------------------------------------------------
# Semester ViewSet
# ---------------------------------------------------------------------------

class SemesterViewSet(viewsets.ModelViewSet):
    """
    CRUD for semesters.

    - Educators: read-only
    - LocationManager+: full CRUD
    """

    serializer_class = SemesterSerializer
    search_fields = ["name"]
    ordering_fields = ["start_date", "name"]
    ordering = ["start_date"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Semester.objects.none()
        user = self.request.user
        qs = Semester.objects.filter(is_deleted=False).select_related(
            "school_year", "school_year__location"
        )
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.location:
            return qs.filter(school_year__location=user.location)
        return qs.none()

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]


# ---------------------------------------------------------------------------
# Group ViewSet
# ---------------------------------------------------------------------------

class GroupViewSet(viewsets.ModelViewSet):
    """
    CRUD for groups.

    - Educators: read access to their own groups
    - LocationManager+: full CRUD for their location's groups
    - Admin/SuperAdmin: full access
    """

    filterset_class = GroupFilter
    search_fields = ["name", "description"]
    ordering_fields = ["name", "balance", "created_at"]
    ordering = ["name"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Group.objects.none()
        user = self.request.user
        qs = Group.objects.filter(is_deleted=False).select_related(
            "location", "school_year", "leader"
        )
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.role == "location_manager" and user.location:
            return qs.filter(location=user.location)
        return qs.filter(
            Q(members__user=user) | Q(leader=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return GroupCreateSerializer
        if self.action == "retrieve":
            return GroupDetailSerializer
        return GroupListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]

    def perform_create(self, serializer):
        serializer.save(location=self.request.user.location)

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()

    @action(detail=True, methods=["get"], url_path="members")
    def list_members(self, request, pk=None):
        """List all members of a group."""
        group = self.get_object()
        members = group.members.filter(is_active=True).select_related("user")
        serializer = GroupMemberSerializer(members, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=["post"], url_path="members/add")
    def add_member(self, request, pk=None):
        """Add a member to a group."""
        group = self.get_object()
        data = request.data.copy()
        data["group"] = group.id
        serializer = GroupMemberCreateSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            GroupMemberSerializer(serializer.instance).data,
            status=status.HTTP_201_CREATED,
        )

    @action(
        detail=True,
        methods=["delete"],
        url_path="members/(?P<member_id>[0-9]+)",
    )
    def remove_member(self, request, pk=None, member_id=None):
        """Remove a member from a group."""
        group = self.get_object()
        try:
            member = GroupMember.objects.get(pk=member_id, group=group)
        except GroupMember.DoesNotExist:
            return Response(
                {"detail": "Mitglied nicht gefunden."},
                status=status.HTTP_404_NOT_FOUND,
            )
        member.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["get"], url_path="students")
    def list_students(self, request, pk=None):
        """List all students of a group."""
        group = self.get_object()
        students = group.students.filter(is_deleted=False)
        serializer = StudentListSerializer(students, many=True)
        return Response(serializer.data)


# ---------------------------------------------------------------------------
# GroupMember ViewSet
# ---------------------------------------------------------------------------

class GroupMemberViewSet(viewsets.ModelViewSet):
    """
    CRUD for group members.

    - Educators: read-only
    - LocationManager+: full CRUD
    """

    search_fields = ["user__first_name", "user__last_name"]
    ordering_fields = ["joined_at", "role"]
    ordering = ["-joined_at"]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return GroupMember.objects.none()
        user = self.request.user
        qs = GroupMember.objects.filter(is_active=True).select_related(
            "group", "user"
        )
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.role == "location_manager" and user.location:
            return qs.filter(group__location=user.location)
        return qs.filter(user=user)

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return GroupMemberCreateSerializer
        return GroupMemberSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]


# ---------------------------------------------------------------------------
# Student ViewSet
# ---------------------------------------------------------------------------

class StudentViewSet(viewsets.ModelViewSet):
    """
    CRUD for students.

    - Educators: read access to students in their groups
    - LocationManager+: full CRUD
    """

    filterset_class = StudentFilter
    # Note: first_name, last_name, email are encrypted and cannot be
    # searched or ordered via SQL queries. Search must be done in Python.
    search_fields = []  # Encrypted fields cannot be searched via SQL
    ordering_fields = ["created_at"]
    ordering = ["id"]  # Encrypted fields cannot be ordered via SQL

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Student.objects.none()
        user = self.request.user
        qs = Student.objects.filter(is_deleted=False).select_related("group")
        if user.role in ["admin", "super_admin"]:
            return qs
        if user.role == "location_manager" and user.location:
            return qs.filter(group__location=user.location)
        return qs.filter(
            Q(group__members__user=user) | Q(group__leader=user)
        ).distinct()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return StudentCreateSerializer
        if self.action == "retrieve":
            return StudentDetailSerializer
        return StudentListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()
