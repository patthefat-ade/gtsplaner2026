"""
Location API views: CRUD for school locations (Schulstandorte).

Provides tenant-aware access to locations with role-based permissions:
  - SuperAdmin: Full CRUD across all organizations
  - Admin: Full CRUD within own tenant scope
  - LocationManager: Read + update own location(s) only
  - Educator: Read-only access to own location

Custom actions:
  - /locations/{id}/groups/   – List groups at this location
  - /locations/{id}/stats/    – Location statistics
  - /locations/{id}/educators/ – List educators at this location
"""

from django.db.models import Count, Q
from django_filters import rest_framework as django_filters
from drf_spectacular.utils import extend_schema, extend_schema_view
from rest_framework import permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.models import Location, Organization, User
from core.permissions import (
    GROUP_ADMIN,
    GROUP_HIERARCHY,
    GROUP_LOCATION_MANAGER,
    GROUP_SUB_ADMIN,
    IsSubAdminOrAbove,
    IsEducator,
    IsLocationManagerOrAbove,
    get_user_hierarchy_level,
    require_permission,
)
from groups.models import Group, GroupMember, Student


# ---------------------------------------------------------------------------
# Serializers
# ---------------------------------------------------------------------------


class LocationUserCompactSerializer(serializers.Serializer):
    """Compact user representation for location manager display."""

    id = serializers.IntegerField(read_only=True)
    first_name = serializers.CharField(read_only=True)
    last_name = serializers.CharField(read_only=True)
    email = serializers.EmailField(read_only=True)
    role = serializers.CharField(read_only=True)


class LocationGroupCompactSerializer(serializers.Serializer):
    """Compact group representation for location detail."""

    id = serializers.IntegerField(read_only=True)
    name = serializers.CharField(read_only=True)
    leader_name = serializers.SerializerMethodField()
    leader_id = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    member_count = serializers.SerializerMethodField()
    is_active = serializers.BooleanField(read_only=True)

    def get_leader_name(self, obj) -> str | None:
        if obj.leader:
            return f"{obj.leader.first_name} {obj.leader.last_name}"
        return None

    def get_leader_id(self, obj) -> int | None:
        return obj.leader_id

    def get_student_count(self, obj) -> int:
        return obj.students.filter(is_deleted=False).count()

    def get_member_count(self, obj) -> int:
        return obj.members.filter(is_active=True).count()


class LocationListSerializer(serializers.ModelSerializer):
    """Serializer for listing locations (compact)."""

    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    manager = LocationUserCompactSerializer(read_only=True)
    group_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    educator_count = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = [
            "id",
            "name",
            "organization",
            "organization_name",
            "manager",
            "city",
            "postal_code",
            "group_count",
            "student_count",
            "educator_count",
            "is_active",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "group_count",
            "student_count",
            "educator_count",
        ]

    def get_group_count(self, obj) -> int:
        return Group.objects.filter(location=obj, is_active=True).count()

    def get_student_count(self, obj) -> int:
        return Student.objects.filter(
            group__location=obj, is_deleted=False
        ).count()

    def get_educator_count(self, obj) -> int:
        return User.objects.filter(
            location=obj, is_deleted=False, is_active=True
        ).exclude(role=User.Role.LOCATION_MANAGER).count()


class LocationDetailSerializer(serializers.ModelSerializer):
    """Serializer for location detail view (includes groups and stats)."""

    organization_name = serializers.CharField(
        source="organization.name", read_only=True
    )
    manager = LocationUserCompactSerializer(read_only=True)
    groups = serializers.SerializerMethodField()
    group_count = serializers.SerializerMethodField()
    student_count = serializers.SerializerMethodField()
    educator_count = serializers.SerializerMethodField()

    class Meta:
        model = Location
        fields = [
            "id",
            "name",
            "description",
            "organization",
            "organization_name",
            "manager",
            "street",
            "city",
            "postal_code",
            "email",
            "phone",
            "groups",
            "group_count",
            "student_count",
            "educator_count",
            "is_active",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "groups",
            "group_count",
            "student_count",
            "educator_count",
        ]

    def get_groups(self, obj) -> list:
        groups = Group.objects.filter(
            location=obj, is_active=True
        ).select_related("leader")
        return LocationGroupCompactSerializer(groups, many=True).data

    def get_group_count(self, obj) -> int:
        return Group.objects.filter(location=obj, is_active=True).count()

    def get_student_count(self, obj) -> int:
        return Student.objects.filter(
            group__location=obj, is_deleted=False
        ).count()

    def get_educator_count(self, obj) -> int:
        return User.objects.filter(
            location=obj, is_deleted=False, is_active=True
        ).exclude(role=User.Role.LOCATION_MANAGER).count()


class LocationCreateSerializer(serializers.ModelSerializer):
    """Serializer for creating/updating locations."""

    class Meta:
        model = Location
        fields = [
            "id",
            "name",
            "description",
            "organization",
            "manager",
            "street",
            "city",
            "postal_code",
            "email",
            "phone",
        ]
        read_only_fields = ["id"]

    def validate_organization(self, value):
        """Ensure the organization is active and not deleted."""
        if not value.is_active or value.is_deleted:
            raise serializers.ValidationError(
                "Die Organisation ist nicht aktiv."
            )
        return value


# ---------------------------------------------------------------------------
# Filters
# ---------------------------------------------------------------------------


class LocationFilter(django_filters.FilterSet):
    """Filter for locations."""

    organization = django_filters.NumberFilter(field_name="organization_id")
    manager = django_filters.NumberFilter(field_name="manager_id")
    is_active = django_filters.BooleanFilter()
    city = django_filters.CharFilter(lookup_expr="icontains")

    class Meta:
        model = Location
        fields = ["organization", "manager", "is_active", "city"]


# ---------------------------------------------------------------------------
# LocationViewSet
# ---------------------------------------------------------------------------


@extend_schema_view(
    list=extend_schema(tags=["Locations"], summary="Standorte auflisten"),
    retrieve=extend_schema(tags=["Locations"], summary="Standort abrufen"),
    create=extend_schema(tags=["Locations"], summary="Standort erstellen"),
    update=extend_schema(tags=["Locations"], summary="Standort aktualisieren"),
    partial_update=extend_schema(
        tags=["Locations"], summary="Standort teilweise aktualisieren"
    ),
    destroy=extend_schema(tags=["Locations"], summary="Standort loeschen"),
)
class LocationViewSet(viewsets.ModelViewSet):
    """
    CRUD for school locations (Schulstandorte).

    Tenant-aware with role-based access:
      - SuperAdmin: Full CRUD across all organizations
      - Admin: Full CRUD within own tenant scope
      - LocationManager: Read + update own location(s)
      - Educator: Read-only access to own location
    """

    filterset_class = LocationFilter
    search_fields = ["name", "city"]
    ordering_fields = ["name", "city", "created_at"]
    ordering = ["name"]

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return LocationCreateSerializer
        if self.action == "retrieve":
            return LocationDetailSerializer
        return LocationListSerializer

    def get_permissions(self):
        if self.action in ["list", "retrieve", "groups", "stats", "educators"]:
            return [permissions.IsAuthenticated(), IsEducator()]
        if self.action in ["update", "partial_update"]:
            # LocationManager can update own location, Admin+ can update any
            return [permissions.IsAuthenticated(), IsLocationManagerOrAbove()]
        # Create and delete: SubAdmin+ only
        return [permissions.IsAuthenticated(), IsSubAdminOrAbove()]

    def get_queryset(self):
        if getattr(self, "swagger_fake_view", False):
            return Location.objects.none()

        qs = Location.objects.select_related(
            "organization", "manager"
        ).filter(is_deleted=False)

        user = self.request.user
        level = get_user_hierarchy_level(user)

        # SuperAdmin: see all locations (or filtered if ?organization_id= set)
        if getattr(self.request, "is_cross_tenant", False):
            return qs

        # Admin/SubAdmin: see locations within tenant scope
        tenant_ids = getattr(self.request, "tenant_ids", [])
        if level >= GROUP_HIERARCHY[GROUP_SUB_ADMIN] and tenant_ids:
            return qs.filter(organization_id__in=tenant_ids)

        # LocationManager: see only managed locations
        if level >= GROUP_HIERARCHY[GROUP_LOCATION_MANAGER]:
            return qs.filter(
                Q(manager=user) | Q(organization_id__in=tenant_ids)
            )

        # Educator: see only own location
        if user.location_id:
            return qs.filter(id=user.location_id)

        return qs.none()

    def perform_update(self, serializer):
        """
        LocationManager can only update their own location.
        Admin+ can update any location within tenant scope.
        """
        instance = serializer.instance
        user = self.request.user
        level = get_user_hierarchy_level(user)

        # LocationManager: can only update own location
        if level < GROUP_HIERARCHY[GROUP_SUB_ADMIN]:
            if instance.manager_id != user.id:
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "Sie koennen nur Ihren eigenen Standort bearbeiten."
                )

        serializer.save()

    def perform_destroy(self, instance):
        """Soft-delete: mark as deleted instead of removing from DB."""
        instance.is_deleted = True
        instance.is_active = False
        instance.save(update_fields=["is_deleted", "is_active", "updated_at"])

    # ── Custom Actions ────────────────────────────────────────────────────

    @extend_schema(tags=["Locations"], summary="Gruppen eines Standorts")
    @action(detail=True, methods=["get"], url_path="groups")
    def groups(self, request, pk=None):
        """List all active groups at this location."""
        location = self.get_object()
        groups = Group.objects.filter(
            location=location, is_active=True
        ).select_related("leader")
        data = LocationGroupCompactSerializer(groups, many=True).data
        return Response(data)

    @extend_schema(tags=["Locations"], summary="Statistiken eines Standorts")
    @action(detail=True, methods=["get"], url_path="stats")
    def stats(self, request, pk=None):
        """Return statistics for a location."""
        location = self.get_object()

        groups = Group.objects.filter(location=location, is_active=True)
        students = Student.objects.filter(
            group__location=location, is_deleted=False
        )
        educators = User.objects.filter(
            location=location, is_deleted=False, is_active=True
        )

        data = {
            "location_id": location.id,
            "location_name": location.name,
            "total_groups": groups.count(),
            "active_groups": groups.filter(is_active=True).count(),
            "total_students": students.count(),
            "active_students": students.filter(is_active=True).count(),
            "total_educators": educators.count(),
            "location_managers": educators.filter(
                role=User.Role.LOCATION_MANAGER
            ).count(),
            "educators": educators.filter(role=User.Role.EDUCATOR).count(),
        }
        return Response(data)

    @extend_schema(
        tags=["Locations"], summary="Paedagog:innen eines Standorts"
    )
    @action(detail=True, methods=["get"], url_path="educators")
    def educators(self, request, pk=None):
        """List all educators at this location."""
        location = self.get_object()
        users = User.objects.filter(
            location=location,
            is_deleted=False,
            is_active=True,
        ).order_by("last_name", "first_name")

        data = LocationUserCompactSerializer(users, many=True).data
        return Response(data)
