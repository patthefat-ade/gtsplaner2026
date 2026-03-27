"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error for debugging
    console.error("Dashboard Error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertCircle className="h-6 w-6 text-destructive" />
          </div>
          <CardTitle>Etwas ist schiefgelaufen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Beim Laden dieser Seite ist ein Fehler aufgetreten. Bitte versuchen
            Sie es erneut oder kehren Sie zum Dashboard zurück.
          </p>
          {process.env.NODE_ENV === "development" && (
            <details className="rounded-md bg-muted p-3 text-left">
              <summary className="cursor-pointer text-xs font-medium">
                Technische Details
              </summary>
              <pre className="mt-2 overflow-auto text-xs text-muted-foreground">
                {error.message}
              </pre>
            </details>
          )}
          <div className="flex justify-center gap-3">
            <Button variant="outline" onClick={reset}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
            <Button asChild>
              <Link href="/">
                <Home className="mr-2 h-4 w-4" />
                Dashboard
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
