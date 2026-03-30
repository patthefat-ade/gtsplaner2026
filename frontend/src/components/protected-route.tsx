"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "educator" | "location_manager" | "sub_admin" | "admin" | "super_admin";
}

const roleHierarchy: Record<string, number> = {
  educator: 1,
  location_manager: 2,
  sub_admin: 3,
  admin: 4,
  super_admin: 5,
};

/**
 * Client-side route protection component.
 *
 * Wraps dashboard pages to ensure the user is authenticated
 * and optionally has the required role.
 */
export function ProtectedRoute({
  children,
  requiredRole,
}: ProtectedRouteProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated || !user) {
    return null;
  }

  // Role check
  if (
    requiredRole &&
    (roleHierarchy[user.role] ?? 0) < (roleHierarchy[requiredRole] ?? 0)
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground">
            Zugriff verweigert
          </h2>
          <p className="mt-2 text-muted-foreground">
            Sie haben nicht die erforderliche Berechtigung für diese Seite.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
