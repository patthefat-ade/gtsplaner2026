"use client";

import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useLeaveRequests,
  useCreateLeaveRequest,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useCancelLeaveRequest,
  useLeaveTypes,
} from "@/hooks/use-timetracking";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { LeaveRequestForm } from "@/components/forms/leave-request-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { LeaveRequestFormData } from "@/lib/validations";
import {
  Plus,
  CalendarOff,
  MoreHorizontal,
  Check,
  X,
  Ban,
  Search,
} from "lucide-react";

export default function LeaveRequestsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Cancel dialog state
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelId, setCancelId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-created_at",
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (statusFilter !== "all") params.status = statusFilter;

  const { data, isLoading, error, refetch } = useLeaveRequests(params);
  const { data: leaveTypesData } = useLeaveTypes();

  const createMutation = useCreateLeaveRequest();
  const approveMutation = useApproveLeaveRequest();
  const rejectMutation = useRejectLeaveRequest();
  const cancelMutation = useCancelLeaveRequest();

  const isManager =
    user?.role === "location_manager" ||
    user?.role === "admin" ||
    user?.role === "super_admin";

  const handleCreate = () => {
    setFormOpen(true);
  };

  const handleSubmit = async (formData: LeaveRequestFormData) => {
    await createMutation.mutateAsync(
      formData as LeaveRequestFormData & { leave_type: number },
      {
        onSuccess: () => {
          toast.success("Abwesenheitsantrag erstellt");
          setFormOpen(false);
        },
        onError: (err) => {
          toast.error("Fehler", "Antrag konnte nicht erstellt werden.");
          throw err;
        },
      }
    );
  };

  const handleApprove = (id: number) => {
    approveMutation.mutate(id, {
      onSuccess: () => toast.success("Antrag genehmigt"),
      onError: () => toast.error("Fehler", "Genehmigung fehlgeschlagen."),
    });
  };

  const handleReject = () => {
    if (rejectId) {
      rejectMutation.mutate(
        { id: rejectId, reason: rejectReason },
        {
          onSuccess: () => {
            toast.success("Antrag abgelehnt");
            setRejectDialogOpen(false);
            setRejectId(null);
            setRejectReason("");
          },
          onError: () => toast.error("Fehler", "Ablehnung fehlgeschlagen."),
        }
      );
    }
  };

  const handleCancel = () => {
    if (cancelId) {
      cancelMutation.mutate(cancelId, {
        onSuccess: () => {
          toast.success("Antrag storniert");
          setCancelDialogOpen(false);
          setCancelId(null);
        },
        onError: () => toast.error("Fehler", "Stornierung fehlgeschlagen."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={6} columns={7} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Abwesenheitsanträge"
        description="Verwalte Urlaub, Krankheit und andere Abwesenheiten."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Antrag
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Grund..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(v) => {
                setStatusFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Status</SelectItem>
                <SelectItem value="pending">Ausstehend</SelectItem>
                <SelectItem value="approved">Genehmigt</SelectItem>
                <SelectItem value="rejected">Abgelehnt</SelectItem>
                <SelectItem value="cancelled">Storniert</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {data?.results && data.results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  {isManager && <TableHead>Mitarbeiter:in</TableHead>}
                  <TableHead>Typ</TableHead>
                  <TableHead>Von</TableHead>
                  <TableHead>Bis</TableHead>
                  <TableHead>Tage</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Grund</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((lr) => (
                  <TableRow key={lr.id}>
                    {isManager && (
                      <TableCell className="font-medium">
                        {lr.user_name
                          ? lr.user_name
                          : typeof lr.user === "object" && lr.user !== null
                            ? `${lr.user.first_name} ${lr.user.last_name}`
                            : `#${lr.user}`}
                      </TableCell>
                    )}
                    <TableCell>
                      {lr.leave_type_name
                        ? lr.leave_type_name
                        : typeof lr.leave_type === "object" && lr.leave_type !== null
                          ? lr.leave_type.name
                          : `#${lr.leave_type}`}
                    </TableCell>
                    <TableCell>{formatDate(lr.start_date)}</TableCell>
                    <TableCell>{formatDate(lr.end_date)}</TableCell>
                    <TableCell className="font-semibold">
                      {lr.total_days}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={lr.status} />
                    </TableCell>
                    <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                      {lr.reason || "–"}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isManager && lr.status === "pending" && (
                            <>
                              <DropdownMenuItem
                                onClick={() => handleApprove(lr.id)}
                              >
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                                Genehmigen
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRejectId(lr.id);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <X className="mr-2 h-4 w-4 text-red-500" />
                                Ablehnen
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                            </>
                          )}
                          {lr.status === "pending" && (typeof lr.user === "object" ? lr.user.id : lr.user) === user?.id && (
                            <DropdownMenuItem
                              onClick={() => {
                                setCancelId(lr.id);
                                setCancelDialogOpen(true);
                              }}
                              className="text-destructive"
                            >
                              <Ban className="mr-2 h-4 w-4" />
                              Stornieren
                            </DropdownMenuItem>
                          )}
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
          icon={CalendarOff}
          title="Keine Abwesenheitsanträge"
          description={
            debouncedSearch || statusFilter !== "all"
              ? "Keine Anträge für diese Filter gefunden."
              : "Es wurden noch keine Abwesenheitsanträge gestellt."
          }
          actionLabel="Neuer Antrag"
          onAction={handleCreate}
        />
      )}

      {/* LeaveRequest Create Dialog */}
      <LeaveRequestForm
        open={formOpen}
        onOpenChange={setFormOpen}
        leaveTypes={leaveTypesData?.results || []}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Antrag ablehnen</DialogTitle>
            <DialogDescription>
              Bitte gib einen Grund für die Ablehnung an.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="reject-reason">Ablehnungsgrund</Label>
            <Textarea
              id="reject-reason"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Grund eingeben..."
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectDialogOpen(false)}
            >
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

      {/* Cancel Dialog */}
      <ConfirmDialog
        open={cancelDialogOpen}
        onOpenChange={setCancelDialogOpen}
        title="Antrag stornieren"
        description="Möchtest du diesen Abwesenheitsantrag wirklich stornieren?"
        confirmLabel="Stornieren"
        variant="destructive"
        onConfirm={handleCancel}
        isLoading={cancelMutation.isPending}
      />
    </div>
  );
}
