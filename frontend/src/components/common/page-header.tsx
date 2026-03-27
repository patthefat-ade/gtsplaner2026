"use client";

import { cn } from "@/lib/utils";
import { Breadcrumbs } from "./breadcrumbs";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  /** Set to false to hide breadcrumbs (e.g., on the dashboard) */
  showBreadcrumbs?: boolean;
}

export function PageHeader({
  title,
  description,
  children,
  className,
  showBreadcrumbs = true,
}: PageHeaderProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {showBreadcrumbs && <Breadcrumbs />}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {children && <div className="flex items-center gap-2">{children}</div>}
      </div>
    </div>
  );
}
