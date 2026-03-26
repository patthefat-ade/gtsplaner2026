"use client";

import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/models";

/**
 * Permission codenames as returned by the backend API.
 *
 * These correspond to the Django permissions defined in
 * core.management.commands.setup_permissions.
 */
export type PermissionCodename =
  | "view_dashboard"
  | "manage_groups"
  | "manage_students"
  | "manage_categories"
  | "create_transactions"
  | "approve_transactions"
  | "view_reports"
  | "manage_timeentries"
  | "approve_leave"
  | "manage_users"
  | "manage_settings"
  | "view_audit_log"
  | "manage_organizations"
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
 */
const routePermissions: { path: string; permission: PermissionCodename }[] = [
  // Admin routes
  { path: "/admin/organizations", permission: "manage_organizations" },
  { path: "/admin/users", permission: "manage_users" },
  { path: "/admin/audit-log", permission: "view_audit_log" },
  { path: "/admin/settings", permission: "manage_settings" },

  // Finance routes
  { path: "/finance/reports", permission: "view_reports" },
  { path: "/finance/categories", permission: "manage_categories" },

  // Group management routes
  { path: "/groups/students", permission: "manage_students" },
  { path: "/groups/new", permission: "manage_groups" },

  // Timetracking approval
  { path: "/timetracking/approval", permission: "approve_leave" },
];

/**
 * Resource-level create permissions.
 * Maps resource names to the required permission codename.
 */
const createPermissions: Record<string, PermissionCodename> = {
  group: "manage_groups",
  category: "manage_categories",
  student: "manage_students",
  transaction: "create_transactions",
  time_entry: "manage_timeentries",
  leave_request: "manage_timeentries",
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
    manage_organizations: "super_admin",
    cross_tenant_access: "super_admin",
    manage_users: "admin",
    manage_settings: "admin",
    view_audit_log: "admin",
    manage_groups: "location_manager",
    manage_students: "location_manager",
    manage_categories: "location_manager",
    approve_transactions: "location_manager",
    view_reports: "location_manager",
    approve_leave: "location_manager",
    manage_timeentries: "educator",
    create_transactions: "educator",
    view_dashboard: "educator",
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
