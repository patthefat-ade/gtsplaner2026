"use client";

import { usePathname } from "next/navigation";
import { usePermissions, getRequiredPermissionForPath } from "@/hooks/use-permissions";
import { ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Route guard component that checks if the current user has
 * the required permission to access the current page.
 *
 * Uses the permissions array from the user profile (returned by /auth/me/)
 * as the primary source of truth. Falls back to role-based checks when
 * permissions haven't been loaded yet.
 *
 * Renders a "Zugriff verweigert" page if the user lacks the required
 * permission. Otherwise, renders children normally.
 */
export function RouteGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { hasPermission, user } = usePermissions();

  if (!user) return <>{children}</>;

  const requiredPerm = getRequiredPermissionForPath(pathname);

  if (requiredPerm && !hasPermission(requiredPerm)) {
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
