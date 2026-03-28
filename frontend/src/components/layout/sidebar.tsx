"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions, type PermissionCodename } from "@/hooks/use-permissions";
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
  MapPin,
  CalendarDays,
  BookTemplate,
  ClipboardCheck,
  ArrowLeftRight,
  Contact,
  School,
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
  /** Permission codename required to see this item. */
  permission?: PermissionCodename;
  badge?: string;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

/**
 * Navigation configuration.
 *
 * Permission codenames MUST match the Django backend permissions defined in
 * core.management.commands.setup_permissions.CUSTOM_PERMISSIONS.
 *
 * Items without a `permission` field are visible to all authenticated users.
 * Items with a `permission` field are only visible if the user has that permission.
 */
const navigation: NavSection[] = [
  {
    title: "Allgemein",
    items: [
      {
        title: "Dashboard",
        href: "/",
        icon: LayoutDashboard,
        // Dashboard is visible to all authenticated users (view_dashboard)
        permission: "view_dashboard",
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
        // All roles can see transactions (view_own_transactions)
        permission: "view_own_transactions",
      },
      {
        title: "Kategorien",
        href: "/finance/categories",
        icon: Receipt,
        permission: "manage_categories",
      },
      {
        title: "Berichte",
        href: "/finance/reports",
        icon: BarChart3,
        permission: "view_reports",
      },
    ],
  },
  {
    title: "Standorte & Gruppen",
    items: [
      {
        title: "Standorte",
        href: "/admin/locations",
        icon: MapPin,
        permission: "view_locations",
      },
      {
        title: "Gruppen",
        href: "/groups/list",
        icon: Users,
        // Visible to all authenticated users (view_own_groups)
        permission: "view_own_groups",
      },
      {
        title: "Schüler:innen",
        href: "/groups/students",
        icon: GraduationCap,
        // Educators can view, LocationManager+ can manage
        permission: "view_students",
      },
      {
        title: "Anwesenheit",
        href: "/groups/attendance",
        icon: ClipboardCheck,
        // Educators can record attendance for their groups
        permission: "view_own_groups",
      },
      {
        title: "Gruppenwechsel",
        href: "/groups/transfers",
        icon: ArrowLeftRight,
        permission: "view_own_groups",
      },
      {
        title: "Kontaktpersonen",
        href: "/groups/contacts",
        icon: Contact,
        permission: "view_students",
      },
      {
        title: "Schuljahre",
        href: "/groups/school-years",
        icon: School,
        permission: "view_own_groups",
      },
    ],
  },
  {
    title: "Wochenpläne",
    items: [
      {
        title: "Wochenpläne",
        href: "/weeklyplans",
        icon: CalendarDays,
        permission: "view_weeklyplans",
      },
      {
        title: "Vorlagen",
        href: "/weeklyplans/templates",
        icon: BookTemplate,
        permission: "view_weeklyplans",
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
        // All roles can see their own time entries
        permission: "view_own_timeentries",
      },
      {
        title: "Abwesenheiten",
        href: "/timetracking/leave-requests",
        icon: CalendarOff,
        // Visible to all authenticated users
      },
      {
        title: "Genehmigungen",
        href: "/timetracking/approval",
        icon: CheckSquare,
        permission: "approve_leave",
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
        permission: "manage_users",
      },
      {
        title: "Organisationen",
        href: "/admin/organizations",
        icon: Building2,
        permission: "manage_organizations",
      },
      {
        title: "Audit Log",
        href: "/admin/audit-log",
        icon: FileText,
        permission: "view_audit_log",
      },
      {
        title: "Einstellungen",
        href: "/admin/settings",
        icon: Settings,
        permission: "manage_settings",
      },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
}

export function Sidebar({ collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const { hasPermission, user } = usePermissions();

  const isVisible = (item: NavItem) => {
    if (!item.permission) return true;
    return hasPermission(item.permission);
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
