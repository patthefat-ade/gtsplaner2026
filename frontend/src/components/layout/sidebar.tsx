"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import type { UserRole } from "@/types/models";
import {
  LayoutDashboard,
  Wallet,
  Receipt,
  Clock,
  CalendarOff,
  Users,
  GraduationCap,
  Shield,
  UserCog,
  Settings,
  FileText,
  BarChart3,
  Building2,
  CheckSquare,
  type LucideIcon,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: UserRole[];
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navigation: NavSection[] = [
  {
    title: "Allgemein",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
      },
    ],
  },
  {
    title: "Finanzen",
    items: [
      {
        title: "Transaktionen",
        href: "/finance/transactions",
        icon: Wallet,
      },
      {
        title: "Kategorien",
        href: "/finance/categories",
        icon: Receipt,
        roles: ["location_manager", "admin", "super_admin"],
      },
      {
        title: "Berichte",
        href: "/finance/reports",
        icon: BarChart3,
        roles: ["location_manager", "admin", "super_admin"],
      },
    ],
  },

  {
    title: "Gruppen",
    items: [
      {
        title: "Gruppen",
        href: "/groups",
        icon: Users,
      },
      {
        title: "Schüler:innen",
        href: "/groups/students",
        icon: GraduationCap,
        roles: ["location_manager", "admin", "super_admin"],
      },
    ],
  },
  {
    title: "Zeiterfassung",
    items: [
      {
        title: "Zeiteinträge",
        href: "/timetracking/entries",
        icon: Clock,
      },
      {
        title: "Abwesenheiten",
        href: "/timetracking/leave-requests",
        icon: CalendarOff,
      },
      {
        title: "Genehmigungen",
        href: "/timetracking/approval",
        icon: CheckSquare,
        roles: ["location_manager", "admin", "super_admin"],
      },
    ],
  },
  {
    title: "Administration",
    items: [
      {
        title: "Benutzer",
        href: "/admin/users",
        icon: UserCog,
        roles: ["admin", "super_admin"],
      },
      {
        title: "Organisationen",
        href: "/admin/organizations",
        icon: Building2,
        roles: ["super_admin"],
      },
      {
        title: "Audit Log",
        href: "/admin/audit-log",
        icon: FileText,
        roles: ["admin", "super_admin"],
      },
      {
        title: "Einstellungen",
        href: "/admin/settings",
        icon: Settings,
        roles: ["admin", "super_admin"],
      },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { user } = useAuth();

  const isVisible = (item: NavItem) => {
    if (!item.roles) return true;
    return user?.role ? item.roles.includes(user.role) : false;
  };

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div
        className={cn(
          "flex h-16 items-center border-b border-sidebar-border px-4",
          collapsed ? "justify-center" : "px-6"
        )}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
          <span className="text-xs font-bold text-primary-foreground">GTS</span>
        </div>
        {!collapsed && (
          <h2 className="ml-3 text-lg font-bold text-sidebar-foreground">
            GTS Planner
          </h2>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        {navigation.map((section) => {
          const visibleItems = section.items.filter(isVisible);
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title} className="mb-4">
              {!collapsed && (
                <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {section.title}
                </p>
              )}
              {collapsed && <Separator className="mb-2" />}
              <ul className="space-y-1">
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const linkContent = (
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <item.icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active && "text-primary"
                        )}
                      />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <li key={item.href}>
                        <Tooltip delayDuration={0}>
                          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                          <TooltipContent side="right">
                            {item.title}
                          </TooltipContent>
                        </Tooltip>
                      </li>
                    );
                  }

                  return <li key={item.href}>{linkContent}</li>;
                })}
              </ul>
            </div>
          );
        })}
      </nav>

      {/* User Info Footer */}
      {user && !collapsed && (
        <div className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary">
              <span className="text-xs font-bold text-primary-foreground">
                {user.first_name?.[0]}
                {user.last_name?.[0]}
              </span>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-sidebar-foreground">
                {user.first_name} {user.last_name}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {user.role === "educator" && "Pädagog:in"}
                {user.role === "location_manager" && "Standortleitung"}
                {user.role === "admin" && "Admin"}
                {user.role === "super_admin" && "Super Admin"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
