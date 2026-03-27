"use client";
import { useState } from "react";
import { useAuditLog } from "@/hooks/use-admin";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import { ScrollText, X } from "lucide-react";

const ACTION_COLORS: Record<
  string,
  "default" | "success" | "warning" | "destructive"
> = {
  create: "success",
  update: "warning",
  delete: "destructive",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Erstellt",
  update: "Aktualisiert",
  delete: "Gelöscht",
};

/**
 * Extract a readable user display name from an audit log entry.
 * The API returns `user` as an object `{ id, first_name, last_name }`
 * or `null` when the action was performed by a system process.
 */
function getUserDisplay(entry: {
  user:
    | number
    | { id: number; first_name?: string; last_name?: string }
    | null;
  user_name?: string;
  changes: Record<string, unknown>;
}): string {
  if (entry.user_name) return entry.user_name;
  if (entry.user && typeof entry.user === "object" && "id" in entry.user) {
    const u = entry.user as {
      id: number;
      first_name?: string;
      last_name?: string;
    };
    const name = [u.first_name, u.last_name].filter(Boolean).join(" ");
    return name || `Benutzer #${u.id}`;
  }
  if (entry.user !== null && entry.user !== undefined)
    return `Benutzer #${entry.user}`;
  return "System";
}

/**
 * Format audit log changes into a human-readable string.
 */
function formatChanges(
  changes: Record<string, unknown> | null | undefined
): string {
  if (!changes) return "\u2013";
  const parts: string[] = [];
  if (changes.action && typeof changes.action === "string")
    parts.push(changes.action);
  if (changes.display && typeof changes.display === "string")
    parts.push(changes.display);
  if (parts.length > 0) return parts.join(" \u2013 ");
  const entries = Object.entries(changes).filter(([k]) => k !== "model");
  if (entries.length === 0) return "\u2013";
  return entries
    .map(
      ([k, v]) =>
        `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`
    )
    .slice(0, 120)
    .join(", ");
}

/** Quick-select date presets */
function getDatePreset(
  preset: string
): { start: string; end: string } | null {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "today":
      return { start: fmt(today), end: fmt(today) };
    case "7days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 7);
      return { start: fmt(d), end: fmt(today) };
    }
    case "30days": {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      return { start: fmt(d), end: fmt(today) };
    }
    default:
      return null;
  }
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-created_at",
  };
  if (actionFilter !== "all") params.action = actionFilter;
  if (startDate) params.start_date = startDate;
  if (endDate) params.end_date = endDate;

  const { data, isLoading, error, refetch } = useAuditLog(params);

  const hasActiveFilters =
    actionFilter !== "all" || startDate !== "" || endDate !== "";

  const clearFilters = () => {
    setActionFilter("all");
    setStartDate("");
    setEndDate("");
    setPage(1);
  };

  const applyPreset = (preset: string) => {
    const dates = getDatePreset(preset);
    if (dates) {
      setStartDate(dates.start);
      setEndDate(dates.end);
      setPage(1);
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={8} columns={6} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit-Log"
        description="Protokoll aller Systemaktivitäten."
      />

      {/* Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:flex-wrap">
            {/* Aktions-Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Aktion</Label>
              <Select
                value={actionFilter}
                onValueChange={(v) => {
                  setActionFilter(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Aktion filtern" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Alle Aktionen</SelectItem>
                  <SelectItem value="create">Erstellt</SelectItem>
                  <SelectItem value="update">Aktualisiert</SelectItem>
                  <SelectItem value="delete">Gelöscht</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Datums-Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Von</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Bis</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
                className="w-full sm:w-[160px]"
              />
            </div>

            {/* Schnell-Filter */}
            <div className="flex items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("today")}
              >
                Heute
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("7days")}
              >
                7 Tage
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => applyPreset("30days")}
              >
                30 Tage
              </Button>
            </div>

            {/* Filter zurücksetzen */}
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="mr-1 h-3 w-3" />
                Filter zurücksetzen
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {data?.results && data.results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Zeitpunkt</TableHead>
                  <TableHead>Benutzer</TableHead>
                  <TableHead>Aktion</TableHead>
                  <TableHead>Modell</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Objekt-ID
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Details
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-sm">
                      {formatDate(entry.created_at)}
                    </TableCell>
                    <TableCell className="font-medium">
                      {getUserDisplay(entry)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={ACTION_COLORS[entry.action] || "default"}
                      >
                        {ACTION_LABELS[entry.action] || entry.action}
                      </Badge>
                    </TableCell>
                    <TableCell>{entry.model_name}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {entry.object_id || "–"}
                    </TableCell>
                    <TableCell className="hidden max-w-[300px] truncate lg:table-cell">
                      {formatChanges(entry.changes)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={data.count}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </Card>
      ) : (
        <EmptyState
          icon={ScrollText}
          title="Keine Einträge"
          description={
            hasActiveFilters
              ? "Keine Einträge für die gewählten Filter gefunden."
              : "Es sind noch keine Audit-Log-Einträge vorhanden."
          }
        />
      )}
    </div>
  );
}
