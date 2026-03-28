"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import { ExportButtons } from "@/components/common";
import { Button } from "@/components/ui/button";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  ArrowRightLeft,
  DollarSign,
} from "lucide-react";
import type { MonthlyFinanceSummary } from "@/types/models";

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

export default function AccountingPage() {
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [groupId, setGroupId] = useState<string>("");
  const [data, setData] = useState<MonthlyFinanceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Array<{ id: number; name: string }>>([]);

  // Fetch groups
  useEffect(() => {
    api.get("/groups/?page_size=100").then((res) => {
      setGroups(res.data.results || []);
    }).catch(() => {});
  }, []);

  // Fetch monthly summary
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ year });
      if (groupId) params.set("group", groupId);
      const res = await api.get(`/finance/transactions/monthly-summary/?${params}`);
      setData(res.data.months || []);
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [year, groupId]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Calculate totals
  const totals = data.reduce(
    (acc, m) => ({
      income: acc.income + m.income,
      expenses: acc.expenses + m.expenses,
      net: acc.net + m.net,
      transactions: acc.transactions + m.transaction_count,
    }),
    { income: 0, expenses: 0, net: 0, transactions: 0 }
  );

  const openingBalance = data.length > 0 ? data[0].opening_balance : 0;
  const closingBalance = data.length > 0 ? data[data.length - 1].closing_balance : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" }).format(n);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Buchhaltung</h1>
          <p className="text-sm text-muted-foreground">
            Monatliche Übersicht: Barbestand, Einnahmen, Ausgaben
          </p>
        </div>
        <ExportButtons basePath="/finance/transactions" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={groupId}
              onValueChange={(v) => setGroupId(v === "all" ? "" : v)}
            >
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Alle Gruppen" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Gruppen</SelectItem>
                {groups.map((g) => (
                  <SelectItem key={g.id} value={String(g.id)}>
                    {g.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-lg font-bold">{fmt(openingBalance)}</p>
                <p className="text-xs text-muted-foreground">Anfangsbestand</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingUp className="h-8 w-8 text-green-500" />
              <div>
                <p className="text-lg font-bold">{fmt(totals.income)}</p>
                <p className="text-xs text-muted-foreground">Einnahmen</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-red-500" />
              <div>
                <p className="text-lg font-bold">{fmt(totals.expenses)}</p>
                <p className="text-xs text-muted-foreground">Ausgaben</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <ArrowRightLeft className="h-8 w-8 text-primary" />
              <div>
                <p className={`text-lg font-bold ${totals.net >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {fmt(totals.net)}
                </p>
                <p className="text-xs text-muted-foreground">Saldo</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <DollarSign className="h-8 w-8 text-emerald-600" />
              <div>
                <p className="text-lg font-bold">{fmt(closingBalance)}</p>
                <p className="text-xs text-muted-foreground">Endbestand</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Table */}
      <Card>
        <CardHeader>
          <CardTitle>Monatliche Aufstellung {year}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Monat</TableHead>
                <TableHead className="text-right">Anfangsbestand</TableHead>
                <TableHead className="text-right">Einnahmen</TableHead>
                <TableHead className="text-right">Ausgaben</TableHead>
                <TableHead className="text-right">Saldo</TableHead>
                <TableHead className="text-right">Endbestand</TableHead>
                <TableHead className="text-center">Transaktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Laden...
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    Keine Daten für {year}
                  </TableCell>
                </TableRow>
              ) : (
                data.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">{m.month_label}</TableCell>
                    <TableCell className="text-right">{fmt(m.opening_balance)}</TableCell>
                    <TableCell className="text-right text-green-600">{fmt(m.income)}</TableCell>
                    <TableCell className="text-right text-red-600">{fmt(m.expenses)}</TableCell>
                    <TableCell className={`text-right font-medium ${m.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {fmt(m.net)}
                    </TableCell>
                    <TableCell className="text-right font-medium">{fmt(m.closing_balance)}</TableCell>
                    <TableCell className="text-center">{m.transaction_count}</TableCell>
                  </TableRow>
                ))
              )}
              {data.length > 0 && (
                <TableRow className="bg-muted/50 font-bold">
                  <TableCell>Gesamt</TableCell>
                  <TableCell className="text-right">{fmt(openingBalance)}</TableCell>
                  <TableCell className="text-right text-green-600">{fmt(totals.income)}</TableCell>
                  <TableCell className="text-right text-red-600">{fmt(totals.expenses)}</TableCell>
                  <TableCell className={`text-right ${totals.net >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {fmt(totals.net)}
                  </TableCell>
                  <TableCell className="text-right">{fmt(closingBalance)}</TableCell>
                  <TableCell className="text-center">{totals.transactions}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
