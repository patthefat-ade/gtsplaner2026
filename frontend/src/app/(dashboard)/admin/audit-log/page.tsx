"use client";

import { useState } from "react";
import { useAuditLog } from "@/hooks/use-admin";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { ScrollText } from "lucide-react";

const ACTION_COLORS: Record<string, "default" | "success" | "warning" | "destructive"> = {
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
 * Falls back to changes.display, then user ID, then "System".
 */
function getUserDisplay(entry: { user: number | null; user_name?: string; changes: Record<string, unknown> }): string {
  if (entry.user_name) return entry.user_name;
  if (entry.changes?.display && typeof entry.changes.display === "string") {
    return entry.changes.display;
  }
  if (entry.user !== null && entry.user !== undefined) return `Benutzer #${entry.user}`;
  return "System";
}

/**
 * Format audit log changes into a human-readable string.
 */
function formatChanges(changes: Record<string, unknown> | null | undefined): string {
  if (!changes) return "\u2013";
  const parts: string[] = [];
  if (changes.action && typeof changes.action === "string") parts.push(changes.action);
  if (changes.display && typeof changes.display === "string") parts.push(changes.display);
  if (parts.length > 0) return parts.join(" \u2013 ");
  // Fallback: show key-value pairs
  const entries = Object.entries(changes).filter(([k]) => k !== "model");
  if (entries.length === 0) return "\u2013";
  return entries.map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join(", ").slice(0, 120);
}

export default function AuditLogPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [actionFilter, setActionFilter] = useState<string>("all");

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-created_at",
  };
  if (actionFilter !== "all") params.action = actionFilter;

  const { data, isLoading, error, refetch } = useAuditLog(params);

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
          <Select
            value={actionFilter}
            onValueChange={(v) => {
              setActionFilter(v);
              setPage(1);
            }}
          >
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Aktion filtern" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Aktionen</SelectItem>
              <SelectItem value="create">Erstellt</SelectItem>
              <SelectItem value="update">Aktualisiert</SelectItem>
              <SelectItem value="delete">Gelöscht</SelectItem>
            </SelectContent>
          </Select>
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
            actionFilter !== "all"
              ? "Keine Einträge für diesen Filter gefunden."
              : "Es sind noch keine Audit-Log-Einträge vorhanden."
          }
        />
      )}
    </div>
  );
}
