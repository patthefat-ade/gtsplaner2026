"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Route-to-label mapping for breadcrumb display.
 * Keys are URL path segments, values are German display labels.
 */
const ROUTE_LABELS: Record<string, string> = {
  // General
  dashboard: "Dashboard",
  // Finance
  finance: "Finanzen",
  transactions: "Transaktionen",
  categories: "Kategorien",
  reports: "Berichte",
  new: "Neu",
  // Locations & Groups
  admin: "Administration",
  locations: "Standorte",
  groups: "Gruppen",
  list: "Liste",
  students: "Schüler:innen",
  // Weekly Plans
  weeklyplans: "Wochenpläne",
  templates: "Vorlagen",
  // Time Tracking
  timetracking: "Zeiterfassung",
  entries: "Zeiteinträge",
  "leave-requests": "Abwesenheitsanträge",
  approval: "Genehmigungen",
  // Admin
  users: "Benutzer",
  organizations: "Organisationen",
  "audit-log": "Audit Log",
  settings: "Einstellungen",
  profile: "Profil",
};

interface BreadcrumbItem {
  label: string;
  href: string;
  isLast: boolean;
}

export function Breadcrumbs({ className }: { className?: string }) {
  const pathname = usePathname();

  // Don't show breadcrumbs on the dashboard root
  if (pathname === "/" || pathname === "/dashboard") {
    return null;
  }

  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: BreadcrumbItem[] = [];

  let currentPath = "";
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    currentPath += `/${segment}`;

    // Skip numeric IDs but show them as "Details"
    const isId = /^\d+$/.test(segment);
    const label = isId
      ? "Details"
      : ROUTE_LABELS[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

    breadcrumbs.push({
      label,
      href: currentPath,
      isLast: i === segments.length - 1,
    });
  }

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("flex items-center gap-1.5 text-sm text-muted-foreground", className)}
    >
      <Link
        href="/"
        className="flex items-center gap-1 transition-colors hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Dashboard</span>
      </Link>
      {breadcrumbs.map((crumb, idx) => (
        <span key={crumb.href} className="flex items-center gap-1.5">
          <ChevronRight className="h-3.5 w-3.5" />
          {crumb.isLast ? (
            <span className="font-medium text-foreground">{crumb.label}</span>
          ) : (
            <Link
              href={crumb.href}
              className="transition-colors hover:text-foreground"
            >
              {crumb.label}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
