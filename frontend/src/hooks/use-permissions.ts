"use client";

import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/models";

/**
 * Permission codenames as returned by the backend API.
 *
 * These correspond exactly to the Django permissions defined in
 * core.management.commands.setup_permissions.CUSTOM_PERMISSIONS.
 *
 * IMPORTANT: When adding new permissions, also update setup_permissions.py
 * and the GROUP_PERMISSIONS mapping there.
 */
export type PermissionCodename =
  // Dashboard
  | "view_dashboard"
  // Groups
  | "view_own_groups"
  | "manage_groups"
  // Students
  | "view_students"
  | "manage_students"
  // Finance
  | "view_own_transactions"
  | "create_transactions"
  | "manage_transactions"
  | "approve_transactions"
  | "manage_categories"
  | "view_reports"
  // Timetracking
  | "view_own_timeentries"
  | "manage_timeentries"
  | "approve_leave"
  // Locations
  | "view_locations"
  | "manage_locations"
  // Weekly Plans
  | "view_weeklyplans"
  | "manage_weeklyplans"
  // Admin
  | "manage_users"
  | "manage_settings"
  | "view_audit_log"
  | "manage_organizations"
  // Tasks
  | "view_tasks"
  | "manage_tasks"
  // Multi-Tenant
  | "cross_tenant_access";

/**
 * Role hierarchy for backward-compatible permission checks.
 * Higher number = more permissions.
 */
const roleHierarchy: Record<UserRole, number> = {
  educator: 1,
  location_manager: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Route permission configuration.
 *
 * Maps URL path prefixes to the required permission codename.
 * The backend is the source of truth; this mapping is used for
 * instant client-side route guarding (no API round-trip).
 *
 * Order matters: more specific paths should come first.
 *
 * NOTE: Paths without a permission entry are accessible to all
 * authenticated users (e.g., /groups/list, /timetracking/leave-requests).
 */
const routePermissions: { path: string; permission: PermissionCodename }[] = [
  // Weekly Plans routes
  { path: "/weeklyplans", permission: "view_weeklyplans" },
  // Location routes
  { path: "/admin/locations", permission: "view_locations" },
  // Admin routes (Admin+ only)
  { path: "/admin/organizations", permission: "manage_organizations" },
  { path: "/admin/users", permission: "manage_users" },
  { path: "/admin/audit-log", permission: "view_audit_log" },
  { path: "/admin/settings", permission: "manage_settings" },

  // Finance routes
  { path: "/finance/reports", permission: "view_reports" },
  { path: "/finance/categories", permission: "manage_categories" },
  { path: "/finance/transactions", permission: "view_own_transactions" },

  // Group management routes
  { path: "/groups/students", permission: "view_students" },
  { path: "/groups/new", permission: "manage_groups" },
  { path: "/groups/list", permission: "view_own_groups" },
  { path: "/groups", permission: "view_own_groups" },

  // Timetracking routes
  { path: "/timetracking/entries", permission: "view_own_timeentries" },
  { path: "/timetracking/leave-requests", permission: "view_own_timeentries" },
  { path: "/timetracking/approval", permission: "approve_leave" },
];

/**
 * Resource-level create permissions.
 * Maps resource names to the required permission codename.
 */
const createPermissions: Record<string, PermissionCodename> = {
  location: "manage_locations",
  group: "manage_groups",
  category: "manage_categories",
  student: "manage_students",
  transaction: "create_transactions",
  time_entry: "manage_timeentries",
  leave_request: "manage_timeentries",
  weeklyplan: "manage_weeklyplans",
  task: "manage_tasks",
  user: "manage_users",
  organization: "manage_organizations",
};

/**
 * Get the required permission for a given pathname.
 * Returns null if no restriction is configured (open to all authenticated users).
 */
export function getRequiredPermissionForPath(
  pathname: string,
): PermissionCodename | null {
  for (const { path, permission } of routePermissions) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return permission;
    }
  }
  return null;
}

/**
 * Legacy function for backward compatibility with RouteGuard.
 * Maps path to minimum role via permission lookup.
 */
export function getRequiredRoleForPath(pathname: string): UserRole | null {
  const perm = getRequiredPermissionForPath(pathname);
  if (!perm) return null;

  // Map permission to minimum role (fallback for when permissions aren't loaded yet)
  const permToMinRole: Partial<Record<PermissionCodename, UserRole>> = {
    // SuperAdmin only
    cross_tenant_access: "super_admin",
    // Admin+
    manage_organizations: "admin",
    manage_users: "admin",
    manage_settings: "admin",
    view_audit_log: "admin",
    // LocationManager+
    manage_groups: "location_manager",
    manage_students: "location_manager",
    manage_categories: "location_manager",
    manage_locations: "location_manager",
    manage_transactions: "location_manager",
    approve_transactions: "location_manager",
    view_reports: "location_manager",
    approve_leave: "location_manager",
    // Educator+
    view_dashboard: "educator",
    view_own_groups: "educator",
    view_students: "educator",
    view_locations: "educator",
    view_own_transactions: "educator",
    create_transactions: "educator",
    view_own_timeentries: "educator",
    manage_timeentries: "educator",
    view_weeklyplans: "educator",
    manage_weeklyplans: "educator",
    view_tasks: "educator",
    manage_tasks: "location_manager",
  };

  return permToMinRole[perm] ?? null;
}

/**
 * Hook for permission checks throughout the application.
 *
 * Uses the permissions array from the user profile (returned by /auth/me/)
 * as the primary source of truth. Falls back to role-based checks when
 * permissions haven't been loaded yet.
 *
 * Provides:
 * - `hasPermission(perm)`: Check if user has a specific permission codename
 * - `canAccessRoute(path)`: Check if user can access a specific route
 * - `canCreate(resource)`: Check if user can create a specific resource
 * - `hasRole(minRole)`: Check if user meets minimum role requirement (legacy)
 * - `isAtLeast(role)`: Alias for hasRole
 * - `isCrossTenant`: Whether user has cross-tenant access
 */
export function usePermissions() {
  const { user } = useAuth();

  /**
   * Check if the user has a specific permission codename.
   *
   * If the user has permissions loaded from the API, checks against those.
   * Otherwise falls back to role-based hierarchy check.
   */
  const hasPermission = (perm: PermissionCodename): boolean => {
    if (!user) return false;

    // SuperAdmin always has all permissions
    if (user.role === "super_admin") return true;

    // Check API-provided permissions if available
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(perm);
    }

    // Fallback: role-based check
    const minRole = getRequiredRoleForPath("/" + perm);
    if (minRole) {
      return roleHierarchy[user.role] >= roleHierarchy[minRole];
    }

    return false;
  };

  /**
   * Check if the user can access a specific route.
   */
  const canAccessRoute = (pathname: string): boolean => {
    if (!user) return false;

    const requiredPerm = getRequiredPermissionForPath(pathname);
    if (!requiredPerm) return true; // No restriction

    return hasPermission(requiredPerm);
  };

  /**
   * Check if the user can create a specific resource type.
   */
  const canCreate = (resource: string): boolean => {
    if (!user) return false;

    const requiredPerm = createPermissions[resource];
    if (!requiredPerm) return false;

    return hasPermission(requiredPerm);
  };

  /**
   * Legacy: Check if user meets minimum role requirement.
   */
  const hasRole = (minRole: UserRole): boolean => {
    if (!user) return false;
    return roleHierarchy[user.role] >= roleHierarchy[minRole];
  };

  return {
    hasPermission,
    canAccessRoute,
    canCreate,
    hasRole,
    isAtLeast: hasRole,
    isCrossTenant: user?.is_cross_tenant ?? false,
    user,
  };
}
