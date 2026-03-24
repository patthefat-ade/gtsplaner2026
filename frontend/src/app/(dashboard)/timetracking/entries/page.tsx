"use client";

import { useState } from "react";
import {
  useTimeEntries,
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
} from "@/hooks/use-timetracking";
import { useGroups } from "@/hooks/use-groups";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { TimeEntryForm } from "@/components/forms/time-entry-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatTime, formatDuration } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { TimeEntry } from "@/types/models";
import type { TimeEntryFormData } from "@/lib/validations";
import {
  Plus,
  Clock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";

export default function TimeEntriesPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<TimeEntry | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-date",
  };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading, error, refetch } = useTimeEntries(params);
  const { data: groupsData } = useGroups({ page_size: 100 });

  const createMutation = useCreateTimeEntry();
  const updateMutation = useUpdateTimeEntry();
  const deleteMutation = useDeleteTimeEntry();

  const handleCreate = () => {
    setEditEntry(null);
    setFormOpen(true);
  };

  const handleEdit = (entry: TimeEntry) => {
    setEditEntry(entry);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: TimeEntryFormData) => {
    if (editEntry) {
      await updateMutation.mutateAsync(
        { id: editEntry.id, ...formData },
        {
          onSuccess: () => {
            toast.success("Zeiteintrag aktualisiert");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Zeiteintrag konnte nicht aktualisiert werden.");
            throw err;
          },
        }
      );
    } else {
      await createMutation.mutateAsync(formData as TimeEntryFormData & { group: number }, {
        onSuccess: () => {
          toast.success("Zeiteintrag erstellt");
          setFormOpen(false);
        },
        onError: (err) => {
          toast.error("Fehler", "Zeiteintrag konnte nicht erstellt werden.");
          throw err;
        },
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Zeiteintrag gelöscht");
          setDeleteDialogOpen(false);
          setDeleteId(null);
        },
        onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={8} columns={7} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Zeiteinträge"
        description="Erfasse und verwalte deine Arbeitszeiten."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Eintrag
        </Button>
      </PageHeader>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Notizen durchsuchen..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {data?.results && data.results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Datum</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Beginn</TableHead>
                  <TableHead>Ende</TableHead>
                  <TableHead>Pause</TableHead>
                  <TableHead>Dauer</TableHead>
                  <TableHead className="hidden md:table-cell">Notizen</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium">
                      {formatDate(entry.date)}
                    </TableCell>
                    <TableCell>{entry.group_name || `#${entry.group}`}</TableCell>
                    <TableCell>{formatTime(entry.start_time)}</TableCell>
                    <TableCell>{formatTime(entry.end_time)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {entry.break_minutes || 0} min
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatDuration(entry.duration_minutes)}
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                      {entry.notes || "–"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(entry)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(entry.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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
          icon={Clock}
          title="Keine Zeiteinträge"
          description={
            debouncedSearch
              ? "Keine Zeiteinträge für diese Suche gefunden."
              : "Du hast noch keine Arbeitszeiten erfasst."
          }
          actionLabel="Neuer Eintrag"
          onAction={handleCreate}
        />
      )}

      {/* TimeEntry Create/Edit Dialog */}
      <TimeEntryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editEntry}
        groups={groupsData?.results || []}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Zeiteintrag löschen"
        description="Möchtest du diesen Zeiteintrag wirklich löschen?"
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
