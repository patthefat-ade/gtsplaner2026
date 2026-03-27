"use client";

import { useState } from "react";
import {
  useLeaveRequests,
  useApproveLeaveRequest,
  useRejectLeaveRequest,
  useTimeEntries,
} from "@/hooks/use-timetracking";
import { useTransactions, useApproveTransaction, useRejectTransaction } from "@/hooks/use-finance";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { QueryError } from "@/components/common/error-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatCurrency } from "@/lib/format";
import {
  CheckCircle,
  XCircle,
  Clock,
  CalendarOff,
  Wallet,
  Loader2,
  AlertCircle,
} from "lucide-react";

function StatCard({
  title,
  value,
  icon: Icon,
  loading,
}: {
  title: string;
  value: number;
  icon: React.ElementType;
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
          <Skeleton className="h-8 w-12" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ApprovalDashboardPage() {
  const toast = useToast();

  // Pending data
  const { data: pendingLeave, isLoading: loadingLeave, error: errorLeave, refetch: refetchLeave } =
    useLeaveRequests({ status: "pending", page_size: 50 });
  const { data: pendingTx, isLoading: loadingTx, error: errorTx, refetch: refetchTx } =
    useTransactions({ status: "pending", page_size: 50 });

  // Mutations
  const approveLeave = useApproveLeaveRequest();
  const rejectLeave = useRejectLeaveRequest();
  const approveTx = useApproveTransaction();
  const rejectTx = useRejectTransaction();

  // Reject dialog state
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectTarget, setRejectTarget] = useState<{
    type: "leave" | "transaction";
    id: number;
  } | null>(null);

  const handleApproveLeave = (id: number) => {
    approveLeave.mutate(id, {
      onSuccess: () => {
        toast.success("Abwesenheitsantrag genehmigt");
        refetchLeave();
      },
      onError: () => toast.error("Fehler", "Genehmigung fehlgeschlagen."),
    });
  };

  const handleApproveTx = (id: number) => {
    approveTx.mutate(id, {
      onSuccess: () => {
        toast.success("Transaktion genehmigt");
        refetchTx();
      },
      onError: () => toast.error("Fehler", "Genehmigung fehlgeschlagen."),
    });
  };

  const openRejectDialog = (type: "leave" | "transaction", id: number) => {
    setRejectTarget({ type, id });
    setRejectReason("");
    setRejectOpen(true);
  };

  const handleReject = () => {
    if (!rejectTarget) return;

    if (rejectTarget.type === "leave") {
      rejectLeave.mutate(
        { id: rejectTarget.id, reason: rejectReason },
        {
          onSuccess: () => {
            toast.success("Abwesenheitsantrag abgelehnt");
            setRejectOpen(false);
            refetchLeave();
          },
          onError: () => toast.error("Fehler", "Ablehnung fehlgeschlagen."),
        }
      );
    } else {
      rejectTx.mutate(
        { id: rejectTarget.id, reason: rejectReason },
        {
          onSuccess: () => {
            toast.success("Transaktion abgelehnt");
            setRejectOpen(false);
            refetchTx();
          },
          onError: () => toast.error("Fehler", "Ablehnung fehlgeschlagen."),
        }
      );
    }
  };

  const leaveCount = pendingLeave?.count ?? 0;
  const txCount = pendingTx?.count ?? 0;
  const totalPending = leaveCount + txCount;

  if (errorLeave) return <QueryError error={errorLeave} onRetry={() => refetchLeave()} />;
  if (errorTx) return <QueryError error={errorTx} onRetry={() => refetchTx()} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Genehmigungen"
        description="Überprüfe und genehmige ausstehende Anträge."
      />

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          title="Gesamt ausstehend"
          value={totalPending}
          icon={AlertCircle}
          loading={loadingLeave || loadingTx}
        />
        <StatCard
          title="Abwesenheitsanträge"
          value={leaveCount}
          icon={CalendarOff}
          loading={loadingLeave}
        />
        <StatCard
          title="Transaktionen"
          value={txCount}
          icon={Wallet}
          loading={loadingTx}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="leave" className="space-y-4">
        <TabsList>
          <TabsTrigger value="leave" className="gap-2">
            <CalendarOff className="h-4 w-4" />
            Abwesenheiten
            {leaveCount > 0 && (
              <Badge variant="warning" className="ml-1">
                {leaveCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <Wallet className="h-4 w-4" />
            Transaktionen
            {txCount > 0 && (
              <Badge variant="warning" className="ml-1">
                {txCount}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {/* Leave Requests Tab */}
        <TabsContent value="leave">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Ausstehende Abwesenheitsanträge
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLeave ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pendingLeave?.results && pendingLeave.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mitarbeiter:in</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead>Zeitraum</TableHead>
                      <TableHead>Tage</TableHead>
                      <TableHead className="hidden md:table-cell">Grund</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingLeave.results.map((lr) => (
                      <TableRow key={lr.id}>
                        <TableCell className="font-medium">
                          {lr.user_name
                            ? lr.user_name
                            : typeof lr.user === "object" && lr.user !== null
                              ? `${lr.user.first_name} ${lr.user.last_name}`
                              : `#${lr.user}`}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {lr.leave_type_name
                              ? lr.leave_type_name
                              : typeof lr.leave_type === "object" && lr.leave_type !== null
                                ? lr.leave_type.name
                                : `#${lr.leave_type}`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {formatDate(lr.start_date)} – {formatDate(lr.end_date)}
                        </TableCell>
                        <TableCell>{lr.total_days}</TableCell>
                        <TableCell className="hidden max-w-[200px] truncate md:table-cell">
                          {lr.reason || "–"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApproveLeave(lr.id)}
                              disabled={approveLeave.isPending}
                              className="text-green-600 hover:text-green-700"
                            >
                              {approveLeave.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => openRejectDialog("leave", lr.id)}
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Keine ausstehenden Abwesenheitsanträge.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Ausstehende Transaktionen
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTx ? (
                <div className="space-y-3">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-12 w-full" />
                  ))}
                </div>
              ) : pendingTx?.results && pendingTx.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Gruppe</TableHead>
                      <TableHead>Betrag</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="hidden md:table-cell">Datum</TableHead>
                      <TableHead className="text-right">Aktionen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTx.results.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="max-w-[200px] truncate font-medium">
                          {tx.description}
                        </TableCell>
                        <TableCell>{tx.group_name || `#${tx.group}`}</TableCell>
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
                          <Badge
                            variant={
                              tx.transaction_type === "income"
                                ? "success"
                                : "destructive"
                            }
                          >
                            {tx.transaction_type === "income"
                              ? "Einnahme"
                              : "Ausgabe"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {formatDate(tx.transaction_date)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleApproveTx(tx.id)}
                              disabled={approveTx.isPending}
                              className="text-green-600 hover:text-green-700"
                            >
                              {approveTx.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle className="h-4 w-4" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                openRejectDialog("transaction", tx.id)
                              }
                              className="text-red-600 hover:text-red-700"
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Keine ausstehenden Transaktionen.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reject Dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {rejectTarget?.type === "leave"
                ? "Abwesenheitsantrag ablehnen"
                : "Transaktion ablehnen"}
            </DialogTitle>
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
              disabled={
                !rejectReason.trim() ||
                rejectLeave.isPending ||
                rejectTx.isPending
              }
            >
              {(rejectLeave.isPending || rejectTx.isPending) && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Ablehnen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
