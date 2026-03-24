"use client";

import { useState } from "react";
import { ProtectedRoute } from "@/components/protected-route";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <ProtectedRoute>
      <TooltipProvider>
        <div className="flex min-h-screen">
          {/* Desktop Sidebar */}
          <aside
            className={cn(
              "hidden border-r border-sidebar-border bg-sidebar-background transition-all duration-300 lg:block",
              sidebarCollapsed ? "w-16" : "w-64"
            )}
          >
            <Sidebar collapsed={sidebarCollapsed} />
          </aside>

          {/* Main Content */}
          <div className="flex flex-1 flex-col">
            <Header
              sidebarCollapsed={sidebarCollapsed}
              onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            />
            <main className="flex-1 p-4 sm:p-6">{children}</main>
          </div>
        </div>
      </TooltipProvider>
    </ProtectedRoute>
  );
}
