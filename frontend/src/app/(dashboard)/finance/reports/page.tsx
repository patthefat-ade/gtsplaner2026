"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTransactions } from "@/hooks/use-finance";
import { usePermissions } from "@/hooks/use-permissions";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { TRANSACTION_TYPE_LABELS } from "@/lib/constants";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Loader2,
  Download,
} from "lucide-react";

/** Chart color palette (dark-mode friendly) */
const COLORS = [
  "hsl(220 70% 50%)",
  "hsl(160 60% 45%)",
  "hsl(30 80% 55%)",
  "hsl(280 65% 60%)",
  "hsl(340 75% 55%)",
];

const INCOME_COLOR = "#22c55e";
const EXPENSE_COLOR = "#ef4444";

/** Month names in German */
const MONTH_NAMES = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

interface MonthlyData {
  month: string;
  income: number;
  expense: number;
  balance: number;
}

interface CategoryData {
  name: string;
  value: number;
}

/**
 * Custom tooltip for the charts that respects dark mode.
 */
function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-popover p-3 shadow-md">
      <p className="mb-1 text-sm font-medium text-popover-foreground">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-sm" style={{ color: entry.color }}>
          {entry.name}: {formatCurrency(entry.value)}
        </p>
      ))}
    </div>
  );
}

export default function FinanceReportsPage() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [exporting, setExporting] = useState(false);
  const { hasPermission } = usePermissions();
  const canExport = hasPermission("manage_transactions");

  const handleExportCSV = async () => {
    setExporting(true);
    try {
      const response = await api.get("/finance/transactions/export-csv/", {
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "text/csv;charset=utf-8;" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `transaktionen_${year}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error("CSV-Export fehlgeschlagen:", error);
    } finally {
      setExporting(false);
    }
  };

  // Fetch all transactions (paginated, up to 1000)
  const { data, isLoading } = useTransactions({
    page_size: 1000,
    ordering: "transaction_date",
  });

  const transactions = data?.results ?? [];

  // Compute monthly aggregation
  const monthlyData = useMemo<MonthlyData[]>(() => {
    const months: MonthlyData[] = MONTH_NAMES.map((m) => ({
      month: m,
      income: 0,
      expense: 0,
      balance: 0,
    }));

    for (const tx of transactions) {
      const d = new Date(tx.transaction_date);
      if (d.getFullYear() !== year) continue;
      const monthIdx = d.getMonth();
      const amount = parseFloat(tx.amount) || 0;
      if (tx.transaction_type === "income") {
        months[monthIdx].income += amount;
      } else {
        months[monthIdx].expense += amount;
      }
    }

    // Compute running balance
    let running = 0;
    for (const m of months) {
      running += m.income - m.expense;
      m.balance = running;
    }

    return months;
  }, [transactions, year]);

  // Compute category breakdown for expenses
  const categoryExpenses = useMemo<CategoryData[]>(() => {
    const map = new Map<string, number>();
    for (const tx of transactions) {
      const d = new Date(tx.transaction_date);
      if (d.getFullYear() !== year) continue;
      if (tx.transaction_type !== "expense") continue;
      const cat = tx.category_name || "Ohne Kategorie";
      map.set(cat, (map.get(cat) || 0) + (parseFloat(tx.amount) || 0));
    }
    return Array.from(map.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions, year]);

  // Summary KPIs
  const summary = useMemo(() => {
    let totalIncome = 0;
    let totalExpense = 0;
    let count = 0;
    for (const tx of transactions) {
      const d = new Date(tx.transaction_date);
      if (d.getFullYear() !== year) continue;
      count++;
      const amount = parseFloat(tx.amount) || 0;
      if (tx.transaction_type === "income") totalIncome += amount;
      else totalExpense += amount;
    }
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense, count };
  }, [transactions, year]);

  // Year options
  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title="Finanzberichte"
          description="Übersicht über Einnahmen, Ausgaben und Kontostände."
        />
        <div className="flex items-center gap-3">
          {canExport && (
            <Button
              variant="outline"
              onClick={handleExportCSV}
              disabled={exporting}
            >
              {exporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              CSV-Export
            </Button>
          )}
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10">
              <ArrowUpRight className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Einnahmen</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalIncome)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-500/10">
              <ArrowDownRight className="h-5 w-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ausgaben</p>
              <p className="text-xl font-bold">{formatCurrency(summary.totalExpense)}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Wallet className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Saldo</p>
              <p className={`text-xl font-bold ${summary.balance >= 0 ? "text-green-500" : "text-red-500"}`}>
                {formatCurrency(summary.balance)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10">
              <TrendingUp className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Transaktionen</p>
              <p className="text-xl font-bold">{summary.count}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : transactions.length === 0 ? (
        <Card>
          <CardContent className="flex h-64 flex-col items-center justify-center gap-2 text-muted-foreground">
            <BarChart3 className="h-12 w-12" />
            <p className="text-lg font-medium">Keine Transaktionen vorhanden</p>
            <p className="text-sm">
              Erstellen Sie Transaktionen, um Finanzberichte zu sehen.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Bar Chart: Income vs Expenses per Month */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <BarChart3 className="h-4 w-4" />
                Einnahmen vs. Ausgaben ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Bar
                    dataKey="income"
                    name={TRANSACTION_TYPE_LABELS.income || "Einnahme"}
                    fill={INCOME_COLOR}
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="expense"
                    name={TRANSACTION_TYPE_LABELS.expense || "Ausgabe"}
                    fill={EXPENSE_COLOR}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Line Chart: Running Balance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <TrendingUp className="h-4 w-4" />
                Saldoverlauf ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="month" className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis className="text-xs" tick={{ fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="balance"
                    name="Saldo"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Pie Chart: Expenses by Category */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PieChartIcon className="h-4 w-4" />
                Ausgaben nach Kategorie ({year})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {categoryExpenses.length === 0 ? (
                <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
                  Keine Ausgaben im ausgewaehlten Zeitraum.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categoryExpenses}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      nameKey="name"
                      label={(props) =>
                        `${props.name ?? ""} (${(((props.percent as number) ?? 0) * 100).toFixed(0)}%)`
                      }
                      labelLine={false}
                    >
                      {categoryExpenses.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={COLORS[index % COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value ?? 0))}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
