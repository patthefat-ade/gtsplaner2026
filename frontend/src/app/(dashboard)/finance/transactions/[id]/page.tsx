"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import {
  useTransaction,
  useApproveTransaction,
  useRejectTransaction,
  useDeleteTransaction,
  useUploadReceipt,
} from "@/hooks/use-finance";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  ArrowLeft,
  Trash2,
  CheckCircle,
  XCircle,
  Upload,
  FileText,
  Calendar,
  User,
  Tag,
  Users,
  Loader2,
  Download,
} from "lucide-react";

export default function TransactionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const { user } = useAuth();
  const txId = Number(params.id);

  const { data: tx, isLoading, error, refetch } = useTransaction(txId);
  const approveMutation = useApproveTransaction();
  const rejectMutation = useRejectTransaction();
  const deleteMutation = useDeleteTransaction();
  const uploadMutation = useUploadReceipt();

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const isManager =
    user?.role === "location_manager" ||
    user?.role === "admin" ||
    user?.role === "super_admin";

  const canApprove = isManager && tx?.status === "pending";
  const canDelete = tx?.status === "pending";

  const handleApprove = () => {
    approveMutation.mutate(txId, {
      onSuccess: () => {
        toast.success("Transaktion genehmigt");
        refetch();
      },
      onError: () => toast.error("Fehler", "Genehmigung fehlgeschlagen."),
    });
  };

  const handleReject = () => {
    rejectMutation.mutate(
      { id: txId, reason: rejectReason },
      {
        onSuccess: () => {
          toast.success("Transaktion abgelehnt");
          setRejectOpen(false);
          setRejectReason("");
          refetch();
        },
        onError: () => toast.error("Fehler", "Ablehnung fehlgeschlagen."),
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(txId, {
      onSuccess: () => {
        toast.success("Transaktion gelöscht");
        router.push("/finance/transactions");
      },
      onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(
      { transactionId: txId, file },
      {
        onSuccess: () => {
          toast.success("Beleg hochgeladen");
          refetch();
        },
        onError: () => toast.error("Fehler", "Upload fehlgeschlagen."),
      }
    );
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading || !tx) return <PageSkeleton rows={4} columns={2} />;

  const isIncome = tx.transaction_type === "income";

  return (
    <div className="space-y-6">
      <PageHeader
        title={tx.description}
        description={`Transaktion #${tx.id}`}
      >
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/finance/transactions")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
          {canApprove && (
            <>
              <Button
                variant="default"
                onClick={handleApprove}
                disabled={approveMutation.isPending}
              >
                {approveMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="mr-2 h-4 w-4" />
                )}
                Genehmigen
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectOpen(true)}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Ablehnen
              </Button>
            </>
          )}
          {canDelete && (
            <Button
              variant="destructive"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Löschen
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Transaction Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Transaktionsdetails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Betrag</span>
              <span
                className={`text-2xl font-bold ${
                  isIncome
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {isIncome ? "+" : "-"}
                {formatCurrency(tx.amount)}
              </span>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  Typ
                </span>
                <Badge variant={isIncome ? "success" : "destructive"}>
                  {isIncome ? "Einnahme" : "Ausgabe"}
                </Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Tag className="h-4 w-4" />
                  Kategorie
                </span>
                <span>{tx.category_name || `#${tx.category}`}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  Gruppe
                </span>
                <span>{tx.group_name || `#${tx.group}`}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Datum
                </span>
                <span>{formatDate(tx.transaction_date)}</span>
              </div>
            </div>
            {tx.notes && (
              <>
                <Separator />
                <div>
                  <p className="mb-1 text-sm text-muted-foreground">Notizen</p>
                  <p className="text-sm">{tx.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Status & Approval */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status & Genehmigung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <StatusBadge status={tx.status} />
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <User className="h-4 w-4" />
                  Erstellt von
                </span>
                <span>
                  {tx.created_by
                    ? `${tx.created_by.first_name} ${tx.created_by.last_name}`
                    : "–"}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Erstellt am
                </span>
                <span>{formatDate(tx.created_at)}</span>
              </div>
              {tx.approved_by && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-4 w-4" />
                    {tx.status === "approved" ? "Genehmigt von" : "Abgelehnt von"}
                  </span>
                  <span>
                    {tx.approved_by.first_name} {tx.approved_by.last_name}
                  </span>
                </div>
              )}
              {tx.approved_at && (
                <div className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {tx.status === "approved" ? "Genehmigt am" : "Abgelehnt am"}
                  </span>
                  <span>{formatDate(tx.approved_at)}</span>
                </div>
              )}
              {tx.rejection_reason && (
                <>
                  <Separator />
                  <div>
                    <p className="mb-1 text-sm font-medium text-destructive">
                      Ablehnungsgrund
                    </p>
                    <p className="text-sm">{tx.rejection_reason}</p>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Receipts */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Belege
            {tx.receipts && tx.receipts.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {tx.receipts.length}
              </Badge>
            )}
          </CardTitle>
          <div>
            <Input
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              id="receipt-upload"
            />
            <Button variant="outline" size="sm" asChild>
              <label htmlFor="receipt-upload" className="cursor-pointer">
                {uploadMutation.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Beleg hochladen
              </label>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tx.receipts && tx.receipts.length > 0 ? (
            <div className="space-y-2">
              {tx.receipts.map((receipt) => (
                <div
                  key={receipt.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{receipt.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {(receipt.file_size / 1024).toFixed(1)} KB –{" "}
                        {formatDate(receipt.created_at)}
                      </p>
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={receipt.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-4 text-center text-sm text-muted-foreground">
              Keine Belege vorhanden.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transaktion ablehnen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Bitte gib einen Grund für die Ablehnung an.
            </p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ablehnungsgrund..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(false)}>
              Abbrechen
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={!rejectReason.trim() || rejectMutation.isPending}
            >
              {rejectMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
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
