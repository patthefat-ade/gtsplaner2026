"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useWeeklyPlans, useDeleteWeeklyPlan, useExportPdf, useDuplicateWeeklyPlan } from "@/hooks/use-weeklyplans";
import { usePermissions } from "@/hooks/use-permissions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  CalendarDays,
  FileDown,
  MoreHorizontal,
  Pencil,
  Copy,
  Trash2,
  Filter,
  Eye,
} from "lucide-react";
import type { WeeklyPlan } from "@/types/models";

export default function WeeklyPlansPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_weeklyplans");

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);

  // Data
  const { data, isLoading } = useWeeklyPlans({
    is_template: false,
    status: statusFilter !== "all" ? statusFilter : undefined,
    search: search || undefined,
  });
  const deleteMutation = useDeleteWeeklyPlan();
  const exportPdf = useExportPdf();
  const duplicateMutation = useDuplicateWeeklyPlan();

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<WeeklyPlan | null>(null);

  const plans = data?.results ?? [];

  // Group plans by week for better overview
  const sortedPlans = useMemo(() => {
    return [...plans].sort((a, b) => {
      // Sort by week_start_date descending (newest first)
      if (a.week_start_date > b.week_start_date) return -1;
      if (a.week_start_date < b.week_start_date) return 1;
      // Then by group name
      return a.group_name.localeCompare(b.group_name);
    });
  }, [plans]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    await deleteMutation.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Wochenpläne</h1>
          <p className="text-muted-foreground">
            Wochenpläne für Ihre Gruppen verwalten und einsehen
          </p>
        </div>
        {canManage && (
          <Button asChild>
            <Link href="/weeklyplans/new">
              <Plus className="mr-2 h-4 w-4" />
              Neuer Wochenplan
            </Link>
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Suche nach Titel, Gruppe oder Standort..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
          </div>

          {showFilters && (
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-sm font-medium">Status</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Alle" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle</SelectItem>
                    <SelectItem value="draft">Entwurf</SelectItem>
                    <SelectItem value="published">Veröffentlicht</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plans Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            {isLoading ? "Laden..." : `${plans.length} Wochenpläne`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <p className="text-muted-foreground">Wochenpläne werden geladen...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <CalendarDays className="h-8 w-8 text-muted-foreground" />
              <p className="text-muted-foreground">Keine Wochenpläne gefunden</p>
              {canManage && (
                <Button asChild variant="outline" size="sm">
                  <Link href="/weeklyplans/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Ersten Wochenplan erstellen
                  </Link>
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>KW</TableHead>
                  <TableHead>Titel</TableHead>
                  <TableHead>Gruppe</TableHead>
                  <TableHead>Standort</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erstellt von</TableHead>
                  <TableHead>Einträge</TableHead>
                  <TableHead className="w-[80px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedPlans.map((plan) => (
                  <TableRow key={plan.id}>
                    <TableCell className="font-medium">
                      KW {plan.calendar_week}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/weeklyplans/${plan.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {plan.title}
                      </Link>
                    </TableCell>
                    <TableCell>{plan.group_name}</TableCell>
                    <TableCell>{plan.location_name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={plan.status === "published" ? "default" : "secondary"}
                      >
                        {plan.status === "published" ? "Veröffentlicht" : "Entwurf"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {plan.created_by_name}
                    </TableCell>
                    <TableCell>{plan.entry_count ?? 0}</TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/weeklyplans/${plan.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Ansehen
                            </Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem asChild>
                              <Link href={`/weeklyplans/${plan.id}?edit=true`}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Bearbeiten
                              </Link>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem
                            onClick={() => exportPdf.mutate(plan.id)}
                            disabled={exportPdf.isPending}
                          >
                            <FileDown className="mr-2 h-4 w-4" />
                            PDF herunterladen
                          </DropdownMenuItem>
                          {canManage && (
                            <>
                              <DropdownMenuItem
                                onClick={() => duplicateMutation.mutate(plan.id)}
                                disabled={duplicateMutation.isPending}
                              >
                                <Copy className="mr-2 h-4 w-4" />
                                Duplizieren
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => setDeleteTarget(plan)}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Löschen
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Wochenplan löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie den Wochenplan &quot;{deleteTarget?.title}&quot; wirklich
              löschen? Diese Aktion kann nicht rückgängig gemacht werden.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Löschen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
