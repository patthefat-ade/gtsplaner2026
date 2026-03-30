"use client";

import { useAuth } from "@/hooks/use-auth";
import { usePermissions } from "@/hooks/use-permissions";
import { useLocations } from "@/hooks/use-locations";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  Wallet,
  Clock,
  Users,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  ArrowRight,
  MapPin,
  GraduationCap,
  UserCheck,
  CalendarDays,
  FileText,
  BarChart3,
  ClipboardList,
  CheckCircle2,
  CircleDot,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";
import { useState, useEffect, useCallback } from "react";

/* ───── Types ───── */
interface DashboardStats {
  role: string;
  locations_count: number;
  groups_count: number;
  students_count: number;
  transactions_count: number;
  time_entries_count: number;
  weeklyplans_count: number;
  pending_leave_requests: number;
  pending_transactions: number;
  total_income: number;
  total_expense: number;
  recent_time_entries: Array<{
    id: number;
    date: string;
    duration_minutes: number;
    notes: string;
    start_time: string;
    end_time: string;
    user__first_name: string;
    user__last_name: string;
    group__name: string;
  }>;
  recent_transactions: Array<{
    id: number;
    transaction_date: string;
    amount: string;
    description: string;
    transaction_type: string;
    status: string;
    created_by__first_name: string;
    created_by__last_name: string;
    group__name: string;
  }>;
  recent_leave_requests: Array<{
    id: number;
    start_date: string;
    end_date: string;
    status: string;
    user__first_name: string;
    user__last_name: string;
    leave_type__name: string;
  }>;
  open_tasks?: number;
  in_progress_tasks?: number;
  done_tasks?: number;
  overdue_tasks?: number;
  recent_tasks?: Array<{
    id: number;
    title: string;
    status: string;
    priority: string;
    due_date: string;
    assigned_to__first_name: string;
    assigned_to__last_name: string;
    created_by__first_name: string;
    created_by__last_name: string;
  }>;
  educator_task_summary?: Array<{
    assigned_to__id: number;
    assigned_to__first_name: string;
    assigned_to__last_name: string;
    open_count: number;
    in_progress_count: number;
    overdue_count: number;
  }>;
  location_task_summary?: Array<{
    location__id: number;
    location__name: string;
    open_count: number;
    in_progress_count: number;
    done_count: number;
    overdue_count: number;
    total_count: number;
  }>;
  location_manager_task_summary?: Array<{
    assigned_to__id: number;
    assigned_to__first_name: string;
    assigned_to__last_name: string;
    assigned_to__location__name: string;
    open_count: number;
    in_progress_count: number;
    overdue_count: number;
  }>;
}

/* ───── Hooks ───── */
function useDashboardStats(organizationId?: number) {
  const [data, setData] = useState<DashboardStats | undefined>(undefined);
  const [error, setError] = useState<Error | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = useCallback(() => {
    setIsLoading(true);
    const params = organizationId ? { organization_id: organizationId } : {};
    api.get("/dashboard/stats/", { params })
      .then((r) => setData(r.data))
      .catch((e) => setError(e))
      .finally(() => setIsLoading(false));
  }, [organizationId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { data, error, isLoading };
}

interface Organization {
  id: number;
  name: string;
  org_type: string;
}

function useOrganizationsList() {
  const [data, setData] = useState<Organization[]>([]);

  useEffect(() => {
    api.get("/admin/organizations/", { params: { page_size: 100 } })
      .then((r) => setData(r.data?.results ?? []))
      .catch(() => {});
  }, []);

  return data;
}

/* ───── Stat Card ───── */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  loading,
  href,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
  href?: string;
}) {
  const content = (
    <Card className={href ? "transition-colors hover:border-primary/50" : ""}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? (
          <>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="mt-2 h-3 w-24" />
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            {description && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                {trend === "up" && (
                  <TrendingUp className="h-3 w-3 text-green-500" />
                )}
                {trend === "down" && (
                  <TrendingDown className="h-3 w-3 text-red-500" />
                )}
                {description}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

/* ───── Table Skeleton ───── */
function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4">
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ───── Educator Dashboard ───── */
function EducatorDashboard({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  return (
    <div className="space-y-6">
      {/* Personal Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Meine Zeiteinträge"
          value={String(stats?.time_entries_count ?? 0)}
          description="Deine erfassten Einträge"
          icon={Clock}
          loading={loading}
          href="/timetracking/entries"
        />
        <StatCard
          title="Meine Transaktionen"
          value={String(stats?.transactions_count ?? 0)}
          description="Von dir erstellt"
          icon={Wallet}
          loading={loading}
          href="/finance/transactions"
        />
        <StatCard
          title="Meine Wochenpläne"
          value={String(stats?.weeklyplans_count ?? 0)}
          description="Erstellt"
          icon={CalendarDays}
          loading={loading}
          href="/weeklyplans"
        />
        <StatCard
          title="Offene Abwesenheitsanträge"
          value={String(stats?.pending_leave_requests ?? 0)}
          description="Warten auf Genehmigung"
          icon={AlertCircle}
          trend={stats?.pending_leave_requests ? "up" : "neutral"}
          loading={loading}
          href="/timetracking/leave-requests"
        />
      </div>

      {/* Task Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Offene Aufgaben"
          value={String(stats?.open_tasks ?? 0)}
          description="Warten auf Bearbeitung"
          icon={ClipboardList}
          trend={stats?.open_tasks ? "up" : "neutral"}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="In Arbeit"
          value={String(stats?.in_progress_tasks ?? 0)}
          description="Aktuell in Bearbeitung"
          icon={CircleDot}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="Überfällig"
          value={String(stats?.overdue_tasks ?? 0)}
          description="Stichtag überschritten"
          icon={AlertTriangle}
          trend={stats?.overdue_tasks ? "down" : "neutral"}
          loading={loading}
          href="/tasks"
        />
      </div>

      {/* My Open Tasks */}
      <RecentTasks stats={stats} loading={loading} showAssignee={false} />

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Schnellzugriff</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/timetracking/entries">
                <Clock className="h-5 w-5" />
                <span className="text-xs">Zeiteintrag erfassen</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/weeklyplans/new">
                <CalendarDays className="h-5 w-5" />
                <span className="text-xs">Wochenplan erstellen</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/timetracking/leave-requests">
                <FileText className="h-5 w-5" />
                <span className="text-xs">Abwesenheit beantragen</span>
              </Link>
            </Button>
            <Button variant="outline" className="h-auto flex-col gap-2 py-4" asChild>
              <Link href="/finance/transactions">
                <Wallet className="h-5 w-5" />
                <span className="text-xs">Transaktion erfassen</span>
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Recent Time Entries */}
      <RecentTimeEntries stats={stats} loading={loading} />
    </div>
  );
}

/* ───── LocationManager Dashboard ───── */
function LocationManagerDashboard({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  return (
    <div className="space-y-6">
      {/* Location Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Mein Standort"
          value={String(stats?.locations_count ?? 0)}
          description="Standort(e)"
          icon={MapPin}
          loading={loading}
          href="/admin/locations"
        />
        <StatCard
          title="Gruppen"
          value={String(stats?.groups_count ?? 0)}
          description="Am Standort"
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Schüler:innen"
          value={String(stats?.students_count ?? 0)}
          description="Am Standort"
          icon={GraduationCap}
          loading={loading}
        />
        <StatCard
          title="Wochenpläne"
          value={String(stats?.weeklyplans_count ?? 0)}
          description="Am Standort"
          icon={CalendarDays}
          loading={loading}
          href="/weeklyplans"
        />
      </div>

      {/* Pending Approvals */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Ausstehende Abwesenheitsanträge"
          value={String(stats?.pending_leave_requests ?? 0)}
          description="Warten auf deine Freigabe"
          icon={AlertCircle}
          trend={stats?.pending_leave_requests ? "up" : "neutral"}
          loading={loading}
          href="/timetracking/approval"
        />
        <StatCard
          title="Ausstehende Transaktionen"
          value={String(stats?.pending_transactions ?? 0)}
          description="Warten auf Genehmigung"
          icon={Wallet}
          loading={loading}
          href="/finance/transactions"
        />
        <StatCard
          title="Zeiteinträge"
          value={String(stats?.time_entries_count ?? 0)}
          description="Am Standort"
          icon={Clock}
          loading={loading}
          href="/timetracking/entries"
        />
      </div>

      {/* Task Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Offene Aufgaben"
          value={String(stats?.open_tasks ?? 0)}
          description="Am Standort"
          icon={ClipboardList}
          trend={stats?.open_tasks ? "up" : "neutral"}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="In Arbeit"
          value={String(stats?.in_progress_tasks ?? 0)}
          description="Am Standort"
          icon={CircleDot}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="Erledigt"
          value={String(stats?.done_tasks ?? 0)}
          description="Am Standort"
          icon={CheckCircle2}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="Überfällig"
          value={String(stats?.overdue_tasks ?? 0)}
          description="Am Standort"
          icon={AlertTriangle}
          trend={stats?.overdue_tasks ? "down" : "neutral"}
          loading={loading}
          href="/tasks"
        />
      </div>

      {/* Educator Task Summary */}
      <EducatorTaskSummaryWidget stats={stats} loading={loading} />

      {/* Recent Tasks */}
      <RecentTasks stats={stats} loading={loading} showAssignee={true} />

      {/* Recent Leave Requests + Transactions */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentLeaveRequests stats={stats} loading={loading} />
        <RecentTransactions stats={stats} loading={loading} />
      </div>
    </div>
  );
}

/* ───── Admin Dashboard ───── */
function AdminDashboard({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  const balance = (stats?.total_income ?? 0) - (stats?.total_expense ?? 0);

  return (
    <div className="space-y-6">
      {/* Organization Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Standorte"
          value={String(stats?.locations_count ?? 0)}
          description="In der Organisation"
          icon={MapPin}
          loading={loading}
          href="/admin/locations"
        />
        <StatCard
          title="Gruppen"
          value={String(stats?.groups_count ?? 0)}
          description="Über alle Standorte"
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Schüler:innen"
          value={String(stats?.students_count ?? 0)}
          description="Über alle Standorte"
          icon={GraduationCap}
          loading={loading}
        />
        <StatCard
          title="Wochenpläne"
          value={String(stats?.weeklyplans_count ?? 0)}
          description="In der Organisation"
          icon={CalendarDays}
          loading={loading}
          href="/weeklyplans"
        />
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Einnahmen"
          value={formatCurrency(stats?.total_income ?? 0)}
          description="Gesamt"
          icon={TrendingUp}
          trend="up"
          loading={loading}
          href="/finance/reports"
        />
        <StatCard
          title="Ausgaben"
          value={formatCurrency(stats?.total_expense ?? 0)}
          description="Gesamt"
          icon={TrendingDown}
          trend="down"
          loading={loading}
          href="/finance/reports"
        />
        <StatCard
          title="Saldo"
          value={formatCurrency(balance)}
          description={balance >= 0 ? "Positiv" : "Negativ"}
          icon={BarChart3}
          trend={balance >= 0 ? "up" : "down"}
          loading={loading}
          href="/finance/reports"
        />
      </div>

      {/* Pending Items */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Ausstehende Abwesenheitsanträge"
          value={String(stats?.pending_leave_requests ?? 0)}
          description="Warten auf Genehmigung"
          icon={AlertCircle}
          trend={stats?.pending_leave_requests ? "up" : "neutral"}
          loading={loading}
          href="/timetracking/approval"
        />
        <StatCard
          title="Ausstehende Transaktionen"
          value={String(stats?.pending_transactions ?? 0)}
          description="Warten auf Genehmigung"
          icon={Wallet}
          loading={loading}
          href="/finance/transactions"
        />
      </div>

      {/* Task Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Offene Aufgaben"
          value={String(stats?.open_tasks ?? 0)}
          description="In der Organisation"
          icon={ClipboardList}
          trend={stats?.open_tasks ? "up" : "neutral"}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="In Arbeit"
          value={String(stats?.in_progress_tasks ?? 0)}
          description="In der Organisation"
          icon={CircleDot}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="Erledigt"
          value={String(stats?.done_tasks ?? 0)}
          description="In der Organisation"
          icon={CheckCircle2}
          loading={loading}
          href="/tasks"
        />
        <StatCard
          title="Überfällig"
          value={String(stats?.overdue_tasks ?? 0)}
          description="In der Organisation"
          icon={AlertTriangle}
          trend={stats?.overdue_tasks ? "down" : "neutral"}
          loading={loading}
          href="/tasks"
        />
      </div>

      {/* Location Task Summary for Admin */}
      <LocationTaskSummaryWidget stats={stats} loading={loading} />

      {/* Location Manager Task Summary for Admin */}
      <LocationManagerTaskSummaryWidget stats={stats} loading={loading} />

      {/* Recent Tasks */}
      <RecentTasks stats={stats} loading={loading} showAssignee={true} />

      {/* Location Overview Table */}
      <LocationStatsWidget />

      {/* Recent Data */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentLeaveRequests stats={stats} loading={loading} />
        <RecentTransactions stats={stats} loading={loading} />
      </div>

      {/* Recent Time Entries */}
      <RecentTimeEntries stats={stats} loading={loading} />
    </div>
  );
}

/* ───── SuperAdmin Dashboard ───── */
function SuperAdminDashboard({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  const balance = (stats?.total_income ?? 0) - (stats?.total_expense ?? 0);

  return (
    <div className="space-y-6">
      {/* System-wide Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Standorte"
          value={String(stats?.locations_count ?? 0)}
          description="Systemweit"
          icon={MapPin}
          loading={loading}
          href="/admin/locations"
        />
        <StatCard
          title="Gruppen"
          value={String(stats?.groups_count ?? 0)}
          description="Systemweit"
          icon={Users}
          loading={loading}
        />
        <StatCard
          title="Schüler:innen"
          value={String(stats?.students_count ?? 0)}
          description="Systemweit"
          icon={GraduationCap}
          loading={loading}
        />
        <StatCard
          title="Zeiteinträge"
          value={String(stats?.time_entries_count ?? 0)}
          description="Systemweit"
          icon={Clock}
          loading={loading}
          href="/timetracking/entries"
        />
        <StatCard
          title="Wochenpläne"
          value={String(stats?.weeklyplans_count ?? 0)}
          description="Systemweit"
          icon={CalendarDays}
          loading={loading}
          href="/weeklyplans"
        />
      </div>

      {/* Financial Overview */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          title="Einnahmen"
          value={formatCurrency(stats?.total_income ?? 0)}
          description="Systemweit"
          icon={TrendingUp}
          trend="up"
          loading={loading}
          href="/finance/reports"
        />
        <StatCard
          title="Ausgaben"
          value={formatCurrency(stats?.total_expense ?? 0)}
          description="Systemweit"
          icon={TrendingDown}
          trend="down"
          loading={loading}
          href="/finance/reports"
        />
        <StatCard
          title="Saldo"
          value={formatCurrency(balance)}
          description={balance >= 0 ? "Positiv" : "Negativ"}
          icon={BarChart3}
          trend={balance >= 0 ? "up" : "down"}
          loading={loading}
          href="/finance/reports"
        />
      </div>

      {/* Pending Items */}
      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          title="Ausstehende Abwesenheitsanträge"
          value={String(stats?.pending_leave_requests ?? 0)}
          description="Systemweit"
          icon={AlertCircle}
          trend={stats?.pending_leave_requests ? "up" : "neutral"}
          loading={loading}
          href="/timetracking/approval"
        />
        <StatCard
          title="Ausstehende Transaktionen"
          value={String(stats?.pending_transactions ?? 0)}
          description="Systemweit"
          icon={Wallet}
          loading={loading}
          href="/finance/transactions"
        />
      </div>

      {/* Location Overview Table */}
      <LocationStatsWidget />

      {/* Recent Data */}
      <div className="grid gap-6 lg:grid-cols-2">
        <RecentLeaveRequests stats={stats} loading={loading} />
        <RecentTransactions stats={stats} loading={loading} />
      </div>

      {/* Recent Time Entries */}
      <RecentTimeEntries stats={stats} loading={loading} />
    </div>
  );
}

/* ───── Shared Widgets ───── */

function RecentTimeEntries({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  const showUser = stats?.role === "super_admin" || stats?.role === "admin" || stats?.role === "sub_admin" || stats?.role === "location_manager";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Letzte Zeiteinträge</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/timetracking/entries">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={5} cols={showUser ? 5 : 4} />
        ) : stats?.recent_time_entries && stats.recent_time_entries.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                {showUser && <TableHead>Mitarbeiter:in</TableHead>}
                <TableHead>Gruppe</TableHead>
                <TableHead>Dauer</TableHead>
                <TableHead className="hidden sm:table-cell">Notizen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent_time_entries.map((entry) => {
                const hours = Math.floor(entry.duration_minutes / 60);
                const mins = entry.duration_minutes % 60;
                return (
                  <TableRow key={entry.id}>
                    <TableCell>{formatDate(entry.date)}</TableCell>
                    {showUser && (
                      <TableCell className="text-sm font-medium">
                        {entry.user__first_name} {entry.user__last_name}
                      </TableCell>
                    )}
                    <TableCell className="text-sm">{entry.group__name}</TableCell>
                    <TableCell>{hours} Std. {mins > 0 ? `${mins} Min.` : ""}</TableCell>
                    <TableCell className="hidden max-w-[200px] truncate sm:table-cell">
                      {entry.notes || "–"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Zeiteinträge vorhanden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentTransactions({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Letzte Transaktionen</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/finance/transactions">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={5} cols={4} />
        ) : stats?.recent_transactions && stats.recent_transactions.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Beschreibung</TableHead>
                <TableHead>Betrag</TableHead>
                <TableHead className="hidden sm:table-cell">Erstellt von</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent_transactions.map((tx) => (
                <TableRow key={tx.id}>
                  <TableCell className="max-w-[150px] truncate font-medium">
                    {tx.description}
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        tx.transaction_type === "income"
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-600 dark:text-red-400"
                      }
                    >
                      {tx.transaction_type === "income" ? "+" : "-"}
                      {formatCurrency(parseFloat(tx.amount))}
                    </span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-sm">
                    {tx.created_by__first_name} {tx.created_by__last_name}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine Transaktionen vorhanden.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function RecentLeaveRequests({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          Ausstehende Abwesenheitsanträge
          {!loading && stats?.pending_leave_requests ? (
            <Badge variant="warning" className="ml-2">
              {stats.pending_leave_requests}
            </Badge>
          ) : null}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/timetracking/approval">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={3} cols={4} />
        ) : stats?.recent_leave_requests && stats.recent_leave_requests.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mitarbeiter:in</TableHead>
                <TableHead>Zeitraum</TableHead>
                <TableHead className="hidden sm:table-cell">Typ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent_leave_requests.map((lr) => (
                <TableRow key={lr.id}>
                  <TableCell className="font-medium">
                    {lr.user__first_name} {lr.user__last_name}
                  </TableCell>
                  <TableCell>
                    {formatDate(lr.start_date)} – {formatDate(lr.end_date)}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {lr.leave_type__name || "–"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine ausstehenden Anträge.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ───── Recent Tasks Widget ───── */
function RecentTasks({ stats, loading, showAssignee }: { stats?: DashboardStats; loading: boolean; showAssignee: boolean }) {
  const priorityColors: Record<string, string> = {
    high: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    low: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };
  const priorityLabels: Record<string, string> = { high: "Hoch", medium: "Mittel", low: "Niedrig" };
  const statusLabels: Record<string, string> = { open: "Offen", in_progress: "In Arbeit", done: "Erledigt" };
  const statusColors: Record<string, string> = {
    open: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
    in_progress: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    done: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {showAssignee ? "Offene Aufgaben am Standort" : "Meine offenen Aufgaben"}
          {!loading && stats?.open_tasks ? (
            <Badge variant="warning" className="ml-2">
              {stats.open_tasks}
            </Badge>
          ) : null}
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <TableSkeleton rows={5} cols={showAssignee ? 5 : 4} />
        ) : stats?.recent_tasks && stats.recent_tasks.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aufgabe</TableHead>
                {showAssignee && <TableHead>Zugewiesen an</TableHead>}
                <TableHead>Priorität</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stichtag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recent_tasks.map((task) => {
                const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== "done";
                return (
                  <TableRow key={task.id}>
                    <TableCell className="font-medium max-w-[200px] truncate">
                      <Link href="/tasks" className="hover:underline">
                        {task.title}
                      </Link>
                    </TableCell>
                    {showAssignee && (
                      <TableCell className="text-sm">
                        {task.assigned_to__first_name} {task.assigned_to__last_name}
                      </TableCell>
                    )}
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority] || ""}`}>
                        {priorityLabels[task.priority] || task.priority}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusColors[task.status] || ""}`}>
                        {statusLabels[task.status] || task.status}
                      </span>
                    </TableCell>
                    <TableCell className={isOverdue ? "text-red-600 dark:text-red-400 font-medium" : ""}>
                      {task.due_date ? formatDate(task.due_date) : "–"}
                      {isOverdue && " \u26a0"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Keine offenen Aufgaben.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ───── Educator Task Summary Widget (for LocationManager) ───── */
function EducatorTaskSummaryWidget({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aufgaben je Pädagogin</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} cols={5} />
        </CardContent>
      </Card>
    );
  }

  if (!stats?.educator_task_summary || stats.educator_task_summary.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Aufgaben je Pädagogin</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pädagogin</TableHead>
              <TableHead className="text-center">Offen</TableHead>
              <TableHead className="text-center">In Arbeit</TableHead>
              <TableHead className="text-center">Überfällig</TableHead>
              <TableHead className="text-center">Gesamt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.educator_task_summary.map((edu) => (
              <TableRow key={edu.assigned_to__id}>
                <TableCell className="font-medium">
                  {edu.assigned_to__first_name} {edu.assigned_to__last_name}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{edu.open_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="warning">{edu.in_progress_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {edu.overdue_count > 0 ? (
                    <Badge variant="destructive">{edu.overdue_count}</Badge>
                  ) : (
                    <Badge variant="outline">0</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {edu.open_count + edu.in_progress_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───── Location Stats Widget ───── */
function LocationStatsWidget() {
  const { data: locations, isLoading } = useLocations({ page_size: 100 });

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Standort-Übersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={5} cols={5} />
        </CardContent>
      </Card>
    );
  }

  if (!locations?.results || locations.results.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Standort-Übersicht</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/admin/locations">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Standort</TableHead>
              <TableHead className="hidden sm:table-cell">Organisation</TableHead>
              <TableHead className="text-center">Gruppen</TableHead>
              <TableHead className="text-center">Schüler:innen</TableHead>
              <TableHead className="text-center hidden sm:table-cell">Pädagog:innen</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locations.results.slice(0, 8).map((loc) => (
              <TableRow key={loc.id}>
                <TableCell className="font-medium">
                  <Link
                    href={`/admin/locations/${loc.id}`}
                    className="flex items-center gap-2 hover:underline"
                  >
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    <div>
                      <div className="text-sm">{loc.name}</div>
                      {loc.city && (
                        <div className="text-xs text-muted-foreground">
                          {loc.city}
                        </div>
                      )}
                    </div>
                  </Link>
                </TableCell>
                <TableCell className="hidden sm:table-cell text-sm">
                  {loc.organization_name || "–"}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Users className="h-3 w-3 text-muted-foreground" />
                    {loc.group_count ?? 0}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <GraduationCap className="h-3 w-3 text-muted-foreground" />
                    {loc.student_count ?? 0}
                  </div>
                </TableCell>
                <TableCell className="text-center hidden sm:table-cell">
                  {loc.educator_count ?? 0}
                </TableCell>
                <TableCell>
                  <Badge
                    variant={loc.is_active ? "success" : "secondary"}
                    className="text-xs"
                  >
                    {loc.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───── Location Task Summary Widget (for Admin) ───── */
function LocationTaskSummaryWidget({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aufgaben pro Standort</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} cols={6} />
        </CardContent>
      </Card>
    );
  }

  if (!stats?.location_task_summary || stats.location_task_summary.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Aufgaben pro Standort</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Standort</TableHead>
              <TableHead className="text-center">Offen</TableHead>
              <TableHead className="text-center">In Arbeit</TableHead>
              <TableHead className="text-center">Erledigt</TableHead>
              <TableHead className="text-center">Überfällig</TableHead>
              <TableHead className="text-center">Gesamt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.location_task_summary.map((loc) => (
              <TableRow key={loc.location__id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                    {loc.location__name}
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{loc.open_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="warning">{loc.in_progress_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="success">{loc.done_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {loc.overdue_count > 0 ? (
                    <Badge variant="destructive">{loc.overdue_count}</Badge>
                  ) : (
                    <Badge variant="outline">0</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {loc.total_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───── Location Manager Task Summary Widget (for Admin) ───── */
function LocationManagerTaskSummaryWidget({ stats, loading }: { stats?: DashboardStats; loading: boolean }) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aufgaben je Standortleitung</CardTitle>
        </CardHeader>
        <CardContent>
          <TableSkeleton rows={4} cols={5} />
        </CardContent>
      </Card>
    );
  }

  if (!stats?.location_manager_task_summary || stats.location_manager_task_summary.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Aufgaben je Standortleitung</CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link href="/tasks">
            Alle anzeigen
            <ArrowRight className="ml-1 h-4 w-4" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Standortleitung</TableHead>
              <TableHead>Standort</TableHead>
              <TableHead className="text-center">Offen</TableHead>
              <TableHead className="text-center">In Arbeit</TableHead>
              <TableHead className="text-center">Überfällig</TableHead>
              <TableHead className="text-center">Gesamt</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {stats.location_manager_task_summary.map((lm) => (
              <TableRow key={lm.assigned_to__id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    {lm.assigned_to__first_name} {lm.assigned_to__last_name}
                  </div>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lm.assigned_to__location__name || "–"}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline">{lm.open_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="warning">{lm.in_progress_count}</Badge>
                </TableCell>
                <TableCell className="text-center">
                  {lm.overdue_count > 0 ? (
                    <Badge variant="destructive">{lm.overdue_count}</Badge>
                  ) : (
                    <Badge variant="outline">0</Badge>
                  )}
                </TableCell>
                <TableCell className="text-center font-medium">
                  {lm.open_count + lm.in_progress_count}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ───── Organization Filter ───── */
function OrganizationFilter({
  value,
  onChange,
}: {
  value: number | undefined;
  onChange: (id: number | undefined) => void;
}) {
  const organizations = useOrganizationsList();

  if (organizations.length === 0) return null;

  return (
    <Select
      value={value ? String(value) : "all"}
      onValueChange={(v) => onChange(v === "all" ? undefined : Number(v))}
    >
      <SelectTrigger className="w-[280px]">
        <SelectValue placeholder="Alle Organisationen" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Alle Organisationen (kumuliert)</SelectItem>
        {organizations.map((org) => (
          <SelectItem key={org.id} value={String(org.id)}>
            {org.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

/* ───── Dashboard Page ───── */
export default function DashboardPage() {
  const { user } = useAuth();
  const [selectedOrgId, setSelectedOrgId] = useState<number | undefined>(undefined);
  const { data: stats, isLoading } = useDashboardStats(
    (user?.role === "super_admin" || user?.role === "admin") ? selectedOrgId : undefined
  );

  const role = user?.role;

  // Role-specific greeting
  const roleLabels: Record<string, string> = {
    educator: "Pädagog:in",
    location_manager: "Standortleitung",
    sub_admin: "Sub-Administrator",
    admin: "Administrator",
    super_admin: "Systemadministrator",
  };

  const roleLabel = roleLabels[role || ""] || "Benutzer";
  const showOrgFilter = role === "super_admin" || role === "admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={`Willkommen, ${user?.first_name || "Benutzer"}`}
          description={`${roleLabel} – Hier ist deine Übersicht für heute.`}
        />
        {showOrgFilter && (
          <OrganizationFilter
            value={selectedOrgId}
            onChange={setSelectedOrgId}
          />
        )}
      </div>

      {role === "educator" && (
        <EducatorDashboard stats={stats} loading={isLoading} />
      )}
      {role === "location_manager" && (
        <LocationManagerDashboard stats={stats} loading={isLoading} />
      )}
      {role === "sub_admin" && (
        <AdminDashboard stats={stats} loading={isLoading} />
      )}
      {role === "admin" && (
        <AdminDashboard stats={stats} loading={isLoading} />
      )}
      {role === "super_admin" && (
        <SuperAdminDashboard stats={stats} loading={isLoading} />
      )}
      {!role && (
        <div className="text-center text-muted-foreground py-12">
          Lade Dashboard...
        </div>
      )}
    </div>
  );
}
