"use client";

import { useAuth } from "@/hooks/use-auth";
import { useTransactions } from "@/hooks/use-finance";
import { useTimeEntries, useLeaveRequests } from "@/hooks/use-timetracking";
import { useGroups } from "@/hooks/use-groups";
import { useLocations } from "@/hooks/use-locations";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/common/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate, formatTime, formatDuration } from "@/lib/format";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

/* ───── Stat Card ───── */
function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  loading,
}: {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  loading?: boolean;
}) {
  return (
    <Card>
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

  // Calculate totals
  const totalLocations = locations.results.length;
  const activeLocations = locations.results.filter((l) => l.is_active).length;
  const totalGroups = locations.results.reduce(
    (sum, l) => sum + (l.group_count ?? 0),
    0
  );
  const totalStudents = locations.results.reduce(
    (sum, l) => sum + (l.student_count ?? 0),
    0
  );
  const totalEducators = locations.results.reduce(
    (sum, l) => sum + (l.educator_count ?? 0),
    0
  );

  return (
    <>
      {/* Summary Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Standorte"
          value={String(activeLocations)}
          description={`von ${totalLocations} gesamt`}
          icon={MapPin}
        />
        <StatCard
          title="Gruppen gesamt"
          value={String(totalGroups)}
          description="Über alle Standorte"
          icon={Users}
        />
        <StatCard
          title="Schüler:innen gesamt"
          value={String(totalStudents)}
          description="Über alle Standorte"
          icon={GraduationCap}
        />
        <StatCard
          title="Pädagog:innen gesamt"
          value={String(totalEducators)}
          description="Über alle Standorte"
          icon={UserCheck}
        />
      </div>

      {/* Top Locations Table */}
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
    </>
  );
}

/* ───── Dashboard Page ───── */
export default function DashboardPage() {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canViewLocations = hasPermission("manage_locations") || hasPermission("view_locations");

  const { data: transactions, isLoading: loadingTx } = useTransactions({
    page_size: 5,
    ordering: "-created_at",
  });

  const { data: pendingTx, isLoading: loadingPending } = useTransactions({
    status: "pending",
    page_size: 1,
  });

  const { data: timeEntries, isLoading: loadingTime } = useTimeEntries({
    page_size: 5,
    ordering: "-date",
  });

  const { data: leaveRequests, isLoading: loadingLeave } = useLeaveRequests({
    status: "pending",
    page_size: 5,
  });

  const { data: groups, isLoading: loadingGroups } = useGroups({ page_size: 1 });

  const isManager =
    user?.role === "location_manager" ||
    user?.role === "admin" ||
    user?.role === "super_admin";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Willkommen, ${user?.first_name || "Benutzer"}`}
        description="Hier ist deine Übersicht für heute."
      />

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Gruppen"
          value={String(groups?.count ?? 0)}
          description="Aktive Gruppen"
          icon={Users}
          loading={loadingGroups}
        />
        <StatCard
          title="Transaktionen"
          value={String(transactions?.count ?? 0)}
          description="Gesamt"
          icon={Wallet}
          loading={loadingTx}
        />
        {isManager && (
          <StatCard
            title="Ausstehende Genehmigungen"
            value={String(pendingTx?.count ?? 0)}
            description="Warten auf deine Freigabe"
            icon={AlertCircle}
            trend={pendingTx?.count ? "up" : "neutral"}
            loading={loadingPending}
          />
        )}
        <StatCard
          title="Zeiteinträge"
          value={String(timeEntries?.count ?? 0)}
          description="Deine Einträge"
          icon={Clock}
          loading={loadingTime}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Transactions */}
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
            {loadingTx ? (
              <TableSkeleton rows={5} cols={4} />
            ) : transactions?.results && transactions.results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Beschreibung</TableHead>
                    <TableHead>Betrag</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Datum
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.results.map((tx) => (
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
                          {formatCurrency(tx.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={tx.status} />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {formatDate(tx.transaction_date)}
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

        {/* Recent Time Entries */}
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
            {loadingTime ? (
              <TableSkeleton rows={5} cols={4} />
            ) : timeEntries?.results && timeEntries.results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Datum</TableHead>
                    <TableHead>Zeit</TableHead>
                    <TableHead>Dauer</TableHead>
                    <TableHead className="hidden sm:table-cell">
                      Notizen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {timeEntries.results.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell>{formatDate(entry.date)}</TableCell>
                      <TableCell>
                        {formatTime(entry.start_time)} –{" "}
                        {formatTime(entry.end_time)}
                      </TableCell>
                      <TableCell>
                        {formatDuration(entry.duration_minutes)}
                      </TableCell>
                      <TableCell className="hidden max-w-[120px] truncate sm:table-cell">
                        {entry.notes || "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Keine Zeiteinträge vorhanden.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Location Stats Widget (Manager+ only) */}
      {isManager && canViewLocations && <LocationStatsWidget />}

      {/* Pending Leave Requests (Manager only) */}
      {isManager && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              Ausstehende Abwesenheitsanträge
              {!loadingLeave && leaveRequests?.count ? (
                <Badge variant="warning" className="ml-2">
                  {leaveRequests.count}
                </Badge>
              ) : null}
            </CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/timetracking/leave-requests">
                Alle anzeigen
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loadingLeave ? (
              <TableSkeleton rows={3} cols={4} />
            ) : leaveRequests?.results && leaveRequests.results.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Mitarbeiter:in</TableHead>
                    <TableHead>Zeitraum</TableHead>
                    <TableHead>Tage</TableHead>
                    <TableHead>Grund</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leaveRequests.results.map((lr) => (
                    <TableRow key={lr.id}>
                      <TableCell className="font-medium">
                        {lr.user_name
                          ? lr.user_name
                          : typeof lr.user === "object" && lr.user !== null
                            ? `${lr.user.first_name} ${lr.user.last_name}`
                            : `Benutzer #${lr.user}`}
                      </TableCell>
                      <TableCell>
                        {formatDate(lr.start_date)} –{" "}
                        {formatDate(lr.end_date)}
                      </TableCell>
                      <TableCell>{lr.total_days}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {lr.reason || "–"}
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
      )}
    </div>
  );
}
