"use client";

import { useState } from "react";
import {
  useTransactions,
  useCreateTransaction,
  useUpdateTransaction,
  useApproveTransaction,
  useRejectTransaction,
  useDeleteTransaction,
  useCategories,
  useUploadReceipt,
} from "@/hooks/use-finance";
import { useGroups } from "@/hooks/use-groups";
import { useAuth } from "@/hooks/use-auth";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { TransactionForm } from "@/components/forms/transaction-form";
import { ReceiptUploadForm } from "@/components/forms/receipt-upload-form";
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
import { formatCurrency, formatDate, formatUserName } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Transaction } from "@/types/models";
import type { TransactionFormData } from "@/lib/validations";
import {
  Plus,
  Wallet,
  MoreHorizontal,
  Check,
  X,
  Trash2,
  Search,
  Pencil,
  Upload,
} from "lucide-react";

export default function TransactionsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editTransaction, setEditTransaction] = useState<Transaction | null>(null);

  // Receipt upload dialog state
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [receiptTransactionId, setReceiptTransactionId] = useState<number | null>(null);

  // Reject dialog state
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectId, setRejectId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-created_at",
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (statusFilter !== "all") params.status = statusFilter;
  if (typeFilter !== "all") params.transaction_type = typeFilter;

  const { data, isLoading, error, refetch } = useTransactions(params);
  const { data: categoriesData } = useCategories({ page_size: 100 });
  const { data: groupsData } = useGroups({ page_size: 100 });

  const createMutation = useCreateTransaction();
  const updateMutation = useUpdateTransaction();
  const approveMutation = useApproveTransaction();
  const rejectMutation = useRejectTransaction();
  const deleteMutation = useDeleteTransaction();
  const uploadReceiptMutation = useUploadReceipt();

  const isManager =
    user?.role === "location_manager" ||
    user?.role === "admin" ||
    user?.role === "super_admin";

  const handleCreate = () => {
    setEditTransaction(null);
    setFormOpen(true);
  };

  const handleEdit = (tx: Transaction) => {
    setEditTransaction(tx);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: TransactionFormData) => {
    if (editTransaction) {
      await updateMutation.mutateAsync(
        { id: editTransaction.id, ...formData },
        {
          onSuccess: () => {
            toast.success("Transaktion aktualisiert");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Transaktion konnte nicht aktualisiert werden.");
            throw err;
          },
        }
      );
    } else {
      await createMutation.mutateAsync(formData as TransactionFormData & { group: number; category: number }, {
        onSuccess: () => {
          toast.success("Transaktion erstellt");
          setFormOpen(false);
        },
        onError: (err) => {
          toast.error("Fehler", "Transaktion konnte nicht erstellt werden.");
          throw err;
        },
      });
    }
  };

  const handleApprove = (id: number) => {
    approveMutation.mutate(id, {
      onSuccess: () => toast.success("Transaktion genehmigt"),
      onError: () => toast.error("Fehler", "Genehmigung fehlgeschlagen."),
    });
  };

  const handleReject = () => {
    if (rejectId) {
      rejectMutation.mutate(
        { id: rejectId, reason: rejectReason },
        {
          onSuccess: () => {
            toast.success("Transaktion abgelehnt");
            setRejectDialogOpen(false);
            setRejectId(null);
            setRejectReason("");
          },
          onError: () => toast.error("Fehler", "Ablehnung fehlgeschlagen."),
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Transaktion gelöscht");
          setDeleteDialogOpen(false);
          setDeleteId(null);
        },
        onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
      });
    }
  };

  const handleReceiptUpload = async (transactionId: number, formData: FormData) => {
    const file = formData.get("file") as File;
    if (file) {
      await uploadReceiptMutation.mutateAsync(
        { transactionId, file },
        {
          onSuccess: () => {
            toast.success("Beleg hochgeladen");
            setReceiptOpen(false);
            setReceiptTransactionId(null);
          },
          onError: () => toast.error("Fehler", "Upload fehlgeschlagen."),
        }
      );
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={8} columns={7} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transaktionen"
        description="Verwalte alle Einnahmen und Ausgaben."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Transaktion
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Beschreibung..."
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
              </SelectContent>
            </Select>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[160px]">
                <SelectValue placeholder="Typ" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="income">Einnahme</SelectItem>
                <SelectItem value="expense">Ausgabe</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {data?.results && data.results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Beschreibung</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Datum</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Erstellt von
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="max-w-[200px] truncate font-medium">
                      {tx.description}
                    </TableCell>
                    <TableCell>{tx.group_name || `#${tx.group}`}</TableCell>
                    <TableCell>
                      <StatusBadge status={tx.transaction_type} />
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={
                          tx.transaction_type === "income"
                            ? "font-semibold text-green-600 dark:text-green-400"
                            : "font-semibold text-red-600 dark:text-red-400"
                        }
                      >
                        {tx.transaction_type === "income" ? "+" : "-"}
                        {formatCurrency(tx.amount)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={tx.status} />
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatDate(tx.transaction_date)}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatUserName(tx.created_by)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(tx)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setReceiptTransactionId(tx.id);
                              setReceiptOpen(true);
                            }}
                          >
                            <Upload className="mr-2 h-4 w-4" />
                            Beleg hochladen
                          </DropdownMenuItem>
                          {isManager && tx.status === "pending" && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleApprove(tx.id)}
                              >
                                <Check className="mr-2 h-4 w-4 text-green-500" />
                                Genehmigen
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => {
                                  setRejectId(tx.id);
                                  setRejectDialogOpen(true);
                                }}
                              >
                                <X className="mr-2 h-4 w-4 text-red-500" />
                                Ablehnen
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(tx.id);
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
          icon={Wallet}
          title="Keine Transaktionen"
          description={
            debouncedSearch
              ? "Keine Transaktionen für diese Suche gefunden."
              : "Es wurden noch keine Transaktionen erfasst."
          }
          actionLabel="Neue Transaktion"
          onAction={handleCreate}
        />
      )}

      {/* Transaction Create/Edit Dialog */}
      <TransactionForm
        open={formOpen}
        onOpenChange={setFormOpen}
        transaction={editTransaction}
        categories={categoriesData?.results || []}
        groups={groupsData?.results || []}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Receipt Upload Dialog */}
      <ReceiptUploadForm
        open={receiptOpen}
        onOpenChange={setReceiptOpen}
        transactionId={receiptTransactionId || 0}
        onSubmit={handleReceiptUpload}
        isLoading={uploadReceiptMutation.isPending}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaktion ablehnen</DialogTitle>
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

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Transaktion löschen"
        description="Möchtest du diese Transaktion wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
