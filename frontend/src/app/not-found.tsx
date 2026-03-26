import Link from "next/link";
import { Home, ArrowLeft, Search } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Custom 404 page with GTS Planner branding.
 * Provides helpful navigation links back to the dashboard or login.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-yellow-50 via-white to-yellow-50 px-4 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950">
      {/* Logo */}
      <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-xl bg-primary shadow-lg">
        <span className="text-xl font-bold text-primary-foreground">GTS</span>
      </div>

      {/* Error Code */}
      <h1 className="mb-2 text-8xl font-extrabold tracking-tight text-muted-foreground/30">
        404
      </h1>

      {/* Error Message */}
      <h2 className="mb-2 text-2xl font-bold text-foreground">
        Seite nicht gefunden
      </h2>
      <p className="mb-8 max-w-md text-center text-muted-foreground">
        Die angeforderte Seite existiert nicht oder wurde verschoben. Bitte
        überprüfen Sie die URL oder navigieren Sie zurück zum Dashboard.
      </p>

      {/* Action Buttons */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/">
            <Home className="mr-2 h-4 w-4" />
            Zum Dashboard
          </Link>
        </Button>
        <Button asChild variant="outline" size="lg">
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zur Anmeldung
          </Link>
        </Button>
      </div>

      {/* Footer */}
      <p className="mt-12 text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} Hilfswerk &mdash; GTS Planner
      </p>
    </div>
  );
}
