"use client";

import { useState } from "react";
import {
  useTransfers,
  useCreateTransfer,
  useConfirmTransfer,
  useRejectTransfer,
  useCompleteTransfer,
  useDeleteTransfer,
} from "@/hooks/use-transfers";
import { useGroups, useStudents } from "@/hooks/use-groups";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type {
  GroupTransfer,
  GroupTransferCreate,
  GroupTransferStatus,
} from "@/types/models";
import {
  Plus,
  ArrowLeftRight,
  MoreHorizontal,
  Check,
  X,
  CheckCircle2,
  Search,
  Clock,
  ArrowRight,
} from "lucide-react";

const STATUS_CONFIG: Record<
  GroupTransferStatus,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  pending: { label: "Ausstehend", variant: "secondary" },
  confirmed: { label: "Bestätigt", variant: "default" },
  rejected: { label: "Abgelehnt", variant: "destructive" },
  completed: { label: "Abgeschlossen", variant: "outline" },
  cancelled: { label: "Storniert", variant: "destructive" },
};

export default function TransfersPage() {
  const toast = useToast();
  const { hasPermission, user } = usePermissions();
  const canManage = hasPermission("manage_students");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 300);

  // Create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<GroupTransferCreate>>({});

  // Reject dialog state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectNotes, setRejectNotes] = useState("");

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-created_at",
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (statusFilter && statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading, error, refetch } = useTransfers(params);
  const { data: groupsData } = useGroups({ page_size: 200 });
  const { data: studentsData } = useStudents({ page_size: 500 });

  const createMutation = useCreateTransfer();
  const confirmMutation = useConfirmTransfer();
  const rejectMutation = useRejectTransfer();
  const completeMutation = useCompleteTransfer();
  const deleteMutation = useDeleteTransfer();

  const groups = groupsData?.results ?? [];
  const students = studentsData?.results ?? [];

  const handleCreate = async () => {
    if (
      !formData.student ||
      !formData.source_group ||
      !formData.target_group ||
      !formData.transfer_date ||
      !formData.start_time
    ) {
      toast.error("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    try {
      await createMutation.mutateAsync(formData as GroupTransferCreate);
      toast.success("Gruppenwechsel-Anfrage erstellt.");
      setCreateOpen(false);
      setFormData({});
    } catch {
      toast.error("Fehler beim Erstellen des Gruppenwechsels.");
    }
  };

  const handleConfirm = async (id: number) => {
    try {
      await confirmMutation.mutateAsync(id);
      toast.success("Gruppenwechsel bestätigt.");
    } catch {
      toast.error("Fehler beim Bestätigen.");
    }
  };

  const handleReject = async () => {
    if (!rejectId) return;
    try {
      await rejectMutation.mutateAsync({ id: rejectId, notes: rejectNotes });
      toast.success("Gruppenwechsel abgelehnt.");
      setRejectOpen(false);
      setRejectId(null);
      setRejectNotes("");
    } catch {
      toast.error("Fehler beim Ablehnen.");
    }
  };

  const handleComplete = async (id: number) => {
    try {
      await completeMutation.mutateAsync({ id });
      toast.success("Gruppenwechsel abgeschlossen.");
    } catch {
      toast.error("Fehler beim Abschließen.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Gruppenwechsel gelöscht.");
      setDeleteOpen(false);
      setDeleteId(null);
    } catch {
      toast.error("Fehler beim Löschen.");
    }
  };

  const formatTime = (time: string) => time?.slice(0, 5) ?? "";
  const formatDate = (date: string) => {
    if (!date) return "";
    const d = new Date(date + "T00:00:00");
    return d.toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (isLoading) return <PageSkeleton />;
  if (error) return <QueryError error={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gruppenwechsel"
        description="Temporäre Gruppenwechsel von Schüler:innen verwalten"
      >
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Gruppenwechsel
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Schüler:in suchen..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="confirmed">Bestätigt</SelectItem>
                <SelectItem value="completed">Abgeschlossen</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {!data?.results?.length ? (
        <EmptyState
          icon={ArrowLeftRight}
          title="Keine Gruppenwechsel"
          description="Es wurden noch keine Gruppenwechsel erstellt."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Schüler:in</TableHead>
                  <TableHead>Von / Nach</TableHead>
                  <TableHead>Datum</TableHead>
                  <TableHead>Zeitraum</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Angefragt von</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((t: GroupTransfer) => {
                  const statusCfg = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.pending;
                  return (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">
                        {t.student_name}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 text-sm">
                          <span>{t.source_group_name}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-medium">{t.target_group_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatDate(t.transfer_date)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-sm">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          {formatTime(t.start_time)}
                          {t.end_time && ` – ${formatTime(t.end_time)}`}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusCfg.variant}>
                          {statusCfg.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {t.requested_by_name}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {t.status === "pending" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => handleConfirm(t.id)}
                                >
                                  <Check className="mr-2 h-4 w-4" />
                                  Bestätigen
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setRejectId(t.id);
                                    setRejectOpen(true);
                                  }}
                                >
                                  <X className="mr-2 h-4 w-4" />
                                  Ablehnen
                                </DropdownMenuItem>
                              </>
                            )}
                            {t.status === "confirmed" && (
                              <DropdownMenuItem
                                onClick={() => handleComplete(t.id)}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                                Abschließen
                              </DropdownMenuItem>
                            )}
                            {canManage && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => {
                                    setDeleteId(t.id);
                                    setDeleteOpen(true);
                                  }}
                                >
                                  Löschen
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.count > pageSize && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(data.count / pageSize)}
          totalItems={data.count}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Neuer Gruppenwechsel</DialogTitle>
            <DialogDescription>
              Erstellen Sie eine Anfrage für einen temporären Gruppenwechsel.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Schüler:in *</Label>
              <Select
                value={formData.student?.toString() ?? ""}
                onValueChange={(v) =>
                  setFormData((prev) => {
                    const s = students.find((st) => st.id === Number(v));
                    return {
                      ...prev,
                      student: Number(v),
                      source_group: s?.group ?? prev.source_group,
                    };
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Schüler:in auswählen" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id.toString()}>
                      {s.first_name} {s.last_name}
                      {s.group_name ? ` (${s.group_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Quellgruppe *</Label>
                <Select
                  value={formData.source_group?.toString() ?? ""}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, source_group: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Von..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.map((g) => (
                      <SelectItem key={g.id} value={g.id.toString()}>
                        {g.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label>Zielgruppe *</Label>
                <Select
                  value={formData.target_group?.toString() ?? ""}
                  onValueChange={(v) =>
                    setFormData((prev) => ({ ...prev, target_group: Number(v) }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Nach..." />
                  </SelectTrigger>
                  <SelectContent>
                    {groups
                      .filter((g) => g.id !== formData.source_group)
                      .map((g) => (
                        <SelectItem key={g.id} value={g.id.toString()}>
                          {g.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Datum *</Label>
              <Input
                type="date"
                value={formData.transfer_date ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    transfer_date: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Von (Uhrzeit) *</Label>
                <Input
                  type="time"
                  value={formData.start_time ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      start_time: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Bis (Uhrzeit)</Label>
                <Input
                  type="time"
                  value={formData.end_time ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      end_time: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Grund</Label>
              <Textarea
                placeholder="Grund für den Gruppenwechsel..."
                value={formData.reason ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, reason: e.target.value }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreate}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Wird erstellt..." : "Anfrage erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Gruppenwechsel ablehnen</DialogTitle>
            <DialogDescription>
              Bitte geben Sie optional einen Grund für die Ablehnung an.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Textarea
              placeholder="Grund der Ablehnung..."
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={rejectMutation.isPending}
            >
              {rejectMutation.isPending ? "Wird abgelehnt..." : "Ablehnen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Gruppenwechsel löschen"
        description="Möchten Sie diesen Gruppenwechsel wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
