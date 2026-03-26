"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { getRequiredRoleForPath } from "@/hooks/use-permissions";
import type { UserRole } from "@/types/models";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const roleHierarchy: Record<UserRole, number> = {
  educator: 1,
  location_manager: 2,
  admin: 3,
  super_admin: 4,
};

/**
 * Route guard component that checks if the current user has
 * permission to access the current page based on the route
 * permission configuration.
 *
 * Renders a "Zugriff verweigert" page if the user lacks
 * the required role. Otherwise, renders children normally.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user } = useAuth();

  if (!user) return <>{children}</>;

  const requiredRole = getRequiredRoleForPath(pathname);

  if (requiredRole && roleHierarchy[user.role] < roleHierarchy[requiredRole]) {
    return (
      <Card className="mx-auto mt-8 max-w-lg">
        <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
          <ShieldOff className="h-12 w-12 text-orange-500" />
          <div>
            <h3 className="text-lg font-semibold">Zugriff verweigert</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Sie haben nicht die erforderliche Berechtigung, um auf diesen
              Bereich zuzugreifen. Bitte wenden Sie sich an Ihren Administrator.
            </p>
          </div>
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
