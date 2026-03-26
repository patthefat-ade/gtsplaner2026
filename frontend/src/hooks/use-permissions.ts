"use client";

import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/models";

/**
 * Role hierarchy for permission checks.
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
 * Maps URL path prefixes to the minimum required role.
 * Order matters: more specific paths should come first.
 */
const routePermissions: { path: string; minRole: UserRole }[] = [
  // Admin routes (already protected via API 403, but adding frontend guard too)
  { path: "/admin/organizations", minRole: "super_admin" },
  { path: "/admin/users", minRole: "admin" },
  { path: "/admin/audit-log", minRole: "admin" },
  { path: "/admin/settings", minRole: "admin" },

  // Finance routes restricted to location_manager+
  { path: "/finance/reports", minRole: "location_manager" },
  { path: "/finance/categories", minRole: "location_manager" },

  // Group management routes restricted to location_manager+
  { path: "/groups/students", minRole: "location_manager" },
  { path: "/groups/new", minRole: "location_manager" },

  // Timetracking approval restricted to location_manager+
  { path: "/timetracking/approval", minRole: "location_manager" },
];

/**
 * Resource-level create permissions.
 * Defines which roles can create specific resources.
 */
const createPermissions: Record<string, UserRole[]> = {
  group: ["location_manager", "admin", "super_admin"],
  category: ["location_manager", "admin", "super_admin"],
  student: ["location_manager", "admin", "super_admin"],
  transaction: ["educator", "location_manager", "admin", "super_admin"],
  time_entry: ["educator", "location_manager", "admin", "super_admin"],
  leave_request: ["educator", "location_manager", "admin", "super_admin"],
};

/**
 * Check if a user role meets the minimum required role.
 */
function hasMinRole(userRole: UserRole, minRole: UserRole): boolean {
  return roleHierarchy[userRole] >= roleHierarchy[minRole];
}

/**
 * Get the minimum required role for a given pathname.
 * Returns null if no restriction is configured (open to all authenticated users).
 */
export function getRequiredRoleForPath(pathname: string): UserRole | null {
  for (const { path, minRole } of routePermissions) {
    if (pathname === path || pathname.startsWith(path + "/")) {
      return minRole;
    }
  }
  return null;
}

/**
 * Hook for permission checks throughout the application.
 *
 * Provides:
 * - `canAccessRoute(path)`: Check if user can access a specific route
 * - `canCreate(resource)`: Check if user can create a specific resource
 * - `hasRole(minRole)`: Check if user meets minimum role requirement
 * - `isAtLeast(role)`: Alias for hasRole
 */
export function usePermissions() {
  const { user } = useAuth();

  const canAccessRoute = (pathname: string): boolean => {
    if (!user) return false;
    const requiredRole = getRequiredRoleForPath(pathname);
    if (!requiredRole) return true;
    return hasMinRole(user.role, requiredRole);
  };

  const canCreate = (resource: string): boolean => {
    if (!user) return false;
    const allowedRoles = createPermissions[resource];
    if (!allowedRoles) return false;
    return allowedRoles.includes(user.role);
  };

  const hasRole = (minRole: UserRole): boolean => {
    if (!user) return false;
    return hasMinRole(user.role, minRole);
  };

  return {
    canAccessRoute,
    canCreate,
    hasRole,
    isAtLeast: hasRole,
    user,
  };
}
