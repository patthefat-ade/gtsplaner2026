"use client";

import { useContext } from "react";
import { AuthContext } from "@/components/auth-provider";

/**
 * Hook to access the authentication context.
 *
 * Provides:
 * - `user`: The authenticated user's profile (or null)
 * - `isAuthenticated`: Whether the user is logged in
 * - `isLoading`: Whether the auth state is being checked
 * - `login(credentials)`: Login function
 * - `logout()`: Logout function
 * - `refreshProfile()`: Refresh user profile from API
 *
 * @example
 * const { user, login, logout, isAuthenticated } = useAuth();
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

/**
 * Helper hook to check if the current user has a specific role or above.
 *
 * Role hierarchy (5 levels):
 *   educator (1) < location_manager (2) < sub_admin (3) < admin (4) < super_admin (5)
 */
export function useHasRole(
  requiredRole: "educator" | "location_manager" | "sub_admin" | "admin" | "super_admin",
): boolean {
  const { user } = useAuth();
  if (!user) return false;

  const roleHierarchy: Record<string, number> = {
    educator: 1,
    location_manager: 2,
    sub_admin: 3,
    admin: 4,
    super_admin: 5,
  };

  return (roleHierarchy[user.role] ?? 0) >= (roleHierarchy[requiredRole] ?? 0);
}
