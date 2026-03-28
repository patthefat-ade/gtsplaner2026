"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  useWeeklyPlan,
  useUpdateWeeklyPlan,
  useExportPdf,
  useDuplicateWeeklyPlan,
  useDuplicateEntry,
} from "@/hooks/use-weeklyplans";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/ui/toast";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  FileDown,
  Copy,
  Plus,
  Trash2,
  CalendarDays,
} from "lucide-react";
import {
  type WeeklyPlanEntry,
  type DayOfWeek,
  DAY_NAMES,
  ENTRY_CATEGORIES,
} from "@/types/models";

// ── Types ───────────────────────────────────────────────────────────────────

interface EntryFormData {
  day_of_week: DayOfWeek;
  start_time: string;
  end_time: string;
  activity: string;
  description: string;
  color: string;
  category: string;
  sort_order: number;
}

const DEFAULT_ENTRY: EntryFormData = {
  day_of_week: 0,
  start_time: "08:00",
  end_time: "09:00",
  activity: "",
  description: "",
  color: "#3B82F6",
  category: "learning",
  sort_order: 0,
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function getTimeSlots(entries: WeeklyPlanEntry[]): string[] {
  const slots = new Set<string>();
  entries.forEach((e) => {
    slots.add(`${e.start_time}-${e.end_time}`);
  });
  return Array.from(slots).sort();
}

function getCategoryColor(category: string): string {
  return ENTRY_CATEGORIES.find((c) => c.value === category)?.color ?? "#6B7280";
}

function getCategoryLabel(category: string): string {
  return ENTRY_CATEGORIES.find((c) => c.value === category)?.label ?? category;
}

// ── Component ───────────────────────────────────────────────────────────────

export default function WeeklyPlanDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const planId = Number(params.id);

  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_weeklyplans");

  const toast = useToast();
  const { data: plan, isLoading } = useWeeklyPlan(planId);
  const updateMutation = useUpdateWeeklyPlan();
  const exportPdf = useExportPdf();
  const duplicateMutation = useDuplicateWeeklyPlan();
  const duplicateEntryMutation = useDuplicateEntry();

  // Duplicate entry dialog
  const [duplicateEntryDialog, setDuplicateEntryDialog] = useState(false);
  const [duplicateSourceEntry, setDuplicateSourceEntry] = useState<WeeklyPlanEntry | null>(null);
  const [duplicateTargetDay, setDuplicateTargetDay] = useState<string>("0");

  // Edit mode
  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "true");
  const [editedEntries, setEditedEntries] = useState<WeeklyPlanEntry[]>([]);
  const [editTitle, setEditTitle] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState<string>("draft");

  // Entry dialog
  const [entryDialog, setEntryDialog] = useState(false);
  const [editingEntry, setEditingEntry] = useState<EntryFormData>(DEFAULT_ENTRY);
  const [editingEntryIndex, setEditingEntryIndex] = useState<number | null>(null);

  // Initialize edit state when plan loads
  useEffect(() => {
    if (plan) {
      setEditedEntries(plan.entries ?? []);
      setEditTitle(plan.title);
      setEditNotes(plan.notes ?? "");
      setEditStatus(plan.status);
    }
  }, [plan]);

  // Grid data
  const entries = isEditing ? editedEntries : (plan?.entries ?? []);
  const timeSlots = useMemo(() => getTimeSlots(entries), [entries]);
  const days: DayOfWeek[] = [0, 1, 2, 3, 4];

  const getEntry = useCallback(
    (day: DayOfWeek, slot: string): WeeklyPlanEntry | undefined => {
      const [start, end] = slot.split("-");
      return entries.find(
        (e) => e.day_of_week === day && e.start_time === start && e.end_time === end
      );
    },
    [entries]
  );

  // ── Entry CRUD ──────────────────────────────────────────────────────────

  const openNewEntry = (day: DayOfWeek, slot?: string) => {
    const [start, end] = slot ? slot.split("-") : ["08:00", "09:00"];
    setEditingEntry({
      ...DEFAULT_ENTRY,
      day_of_week: day,
      start_time: start,
      end_time: end,
      sort_order: entries.length,
    });
    setEditingEntryIndex(null);
    setEntryDialog(true);
  };

  const openEditEntry = (entry: WeeklyPlanEntry, index: number) => {
    setEditingEntry({
      day_of_week: entry.day_of_week,
      start_time: entry.start_time,
      end_time: entry.end_time,
      activity: entry.activity,
      description: entry.description,
      color: entry.color,
      category: entry.category,
      sort_order: entry.sort_order,
    });
    setEditingEntryIndex(index);
    setEntryDialog(true);
  };

  const saveEntry = () => {
    const newEntry: WeeklyPlanEntry = {
      ...editingEntry,
      color: getCategoryColor(editingEntry.category),
    };

    if (editingEntryIndex !== null) {
      // Update existing
      const updated = [...editedEntries];
      updated[editingEntryIndex] = newEntry;
      setEditedEntries(updated);
    } else {
      // Add new
      setEditedEntries([...editedEntries, newEntry]);
    }
    setEntryDialog(false);
  };

  const deleteEntry = (index: number) => {
    setEditedEntries(editedEntries.filter((_, i) => i !== index));
  };

  // ── Save Plan ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!plan) return;
    try {
      await updateMutation.mutateAsync({
        id: plan.id,
        data: {
          title: editTitle,
          notes: editNotes,
          status: editStatus as "draft" | "published",
          entries: editedEntries.map((e) => ({
            day_of_week: e.day_of_week,
            start_time: e.start_time,
            end_time: e.end_time,
            activity: e.activity,
            description: e.description,
            color: e.color,
            category: e.category,
            sort_order: e.sort_order,
          })),
        },
      });
      toast.success("Wochenplan erfolgreich gespeichert");
      setIsEditing(false);
    } catch {
      toast.error("Fehler", "Wochenplan konnte nicht gespeichert werden.");
    }
  };

  const handleExportPdf = async () => {
    try {
      await exportPdf.mutateAsync(planId);
      toast.success("PDF-Export gestartet");
    } catch {
      toast.error("Fehler", "PDF konnte nicht exportiert werden.");
    }
  };

  const handleDuplicateEntry = async () => {
    if (!duplicateSourceEntry?.id || !plan) return;
    try {
      await duplicateEntryMutation.mutateAsync({
        planId: plan.id,
        entryId: duplicateSourceEntry.id,
        targetDay: Number(duplicateTargetDay),
      });
      toast.success("Eintrag erfolgreich dupliziert");
      setDuplicateEntryDialog(false);
      setDuplicateSourceEntry(null);
    } catch {
      toast.error("Fehler", "Eintrag konnte nicht dupliziert werden.");
    }
  };

  const openDuplicateEntryDialog = (entry: WeeklyPlanEntry) => {
    setDuplicateSourceEntry(entry);
    // Default to next day
    const nextDay = entry.day_of_week < 4 ? entry.day_of_week + 1 : 0;
    setDuplicateTargetDay(String(nextDay));
    setDuplicateEntryDialog(true);
  };

  const handleDuplicate = async () => {
    try {
      await duplicateMutation.mutateAsync(planId);
      toast.success("Wochenplan erfolgreich dupliziert");
    } catch {
      toast.error("Fehler", "Wochenplan konnte nicht dupliziert werden.");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs />
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
          <div className="grid grid-cols-6 gap-2">
            {Array.from({ length: 30 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-4">
        <p className="text-muted-foreground">Wochenplan nicht gefunden</p>
        <Button asChild variant="outline">
          <Link href="/weeklyplans">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück zur Übersicht
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs />
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/weeklyplans">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            {isEditing ? (
              <Input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="text-2xl font-bold"
              />
            ) : (
              <h1 className="text-3xl font-bold tracking-tight">{plan.title}</h1>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>KW {plan.calendar_week}</span>
              {plan.week_start_date && (
                <span className="text-xs">
                  ({new Date(plan.week_start_date).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  {" \u2013 "}
                  {plan.week_end_date
                    ? new Date(plan.week_end_date).toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" })
                    : ""})
                </span>
              )}
              <span>\u00b7</span>
              <span>{plan.group_name}</span>
              <span>\u00b7</span>
              <span>{plan.location_name}</span>
              <span>\u00b7</span>
              <Badge variant={plan.status === "published" ? "default" : "secondary"}>
                {plan.status === "published" ? "Ver\u00f6ffentlicht" : "Entwurf"}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Entwurf</SelectItem>
                  <SelectItem value="published">Veröffentlicht</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setEditedEntries(plan.entries ?? []);
                  setEditTitle(plan.title);
                  setEditNotes(plan.notes ?? "");
                  setEditStatus(plan.status);
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={updateMutation.isPending}>
                <Save className="mr-2 h-4 w-4" />
                {updateMutation.isPending ? "Speichern..." : "Speichern"}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={handleExportPdf}
                disabled={exportPdf.isPending}
              >
                <FileDown className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button
                variant="outline"
                onClick={handleDuplicate}
                disabled={duplicateMutation.isPending}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplizieren
              </Button>
              {canManage && (
                <Button onClick={() => setIsEditing(true)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Notes (edit mode) */}
      {isEditing && (
        <Card>
          <CardContent className="pt-6">
            <label className="mb-1 block text-sm font-medium">Notizen</label>
            <Textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              placeholder="Notizen zum Wochenplan..."
              rows={2}
            />
          </CardContent>
        </Card>
      )}

      {/* Notes (view mode) */}
      {!isEditing && plan.notes && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">{plan.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* Weekly Theme */}
      {!isEditing && plan.weekly_theme && (
        <Card className="border-yellow-400 dark:border-yellow-600">
          <CardHeader className="bg-yellow-50 dark:bg-yellow-950/30">
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <span className="text-lg">\u2b50</span>
              Thema der Woche
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-yellow-50/50 pt-4 dark:bg-yellow-950/20">
            <div
              className="prose prose-sm dark:prose-invert max-w-none"
              dangerouslySetInnerHTML={{ __html: plan.weekly_theme }}
            />
          </CardContent>
        </Card>
      )}

      {/* Weekly Grid */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Wochenübersicht</span>
            {isEditing && (
              <Button size="sm" variant="outline" onClick={() => openNewEntry(0)}>
                <Plus className="mr-2 h-4 w-4" />
                Zeitslot hinzufügen
              </Button>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {timeSlots.length === 0 ? (
            <div className="flex h-32 flex-col items-center justify-center gap-2">
              <p className="text-muted-foreground">Noch keine Einträge vorhanden</p>
              {isEditing && (
                <Button size="sm" onClick={() => openNewEntry(0)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Ersten Eintrag hinzufügen
                </Button>
              )}
            </div>
          ) : (
            <>
            {/* Desktop: Full grid table */}
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="w-[120px] border border-border bg-muted/50 p-2 text-left text-xs font-semibold">
                    Zeit
                  </th>
                  {days.map((day) => (
                    <th
                      key={day}
                      className="border border-border bg-muted/50 p-2 text-center text-xs font-semibold"
                    >
                      {DAY_NAMES[day]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => {
                  const [start, end] = slot.split("-");
                  return (
                    <tr key={slot}>
                      <td className="border border-border bg-muted/30 p-2 text-xs font-medium">
                        {start}
                        <br />
                        {end}
                      </td>
                      {days.map((day) => {
                        const entry = getEntry(day, slot);
                        const entryIndex = entry
                          ? entries.findIndex(
                              (e) =>
                                e.day_of_week === day &&
                                e.start_time === start &&
                                e.end_time === end
                            )
                          : -1;

                        if (entry) {
                          return (
                            <td
                              key={day}
                              className="border border-border p-1"
                              style={{
                                backgroundColor: `${entry.color}15`,
                              }}
                            >
                              <div
                                className={`rounded p-2 text-xs ${isEditing ? "cursor-pointer hover:opacity-80" : ""}`}
                                style={{
                                  borderLeft: `3px solid ${entry.color}`,
                                }}
                                onClick={
                                  isEditing
                                    ? () => openEditEntry(entry, entryIndex)
                                    : undefined
                                }
                              >
                                <div className="font-semibold">{entry.activity}</div>
                                {entry.description && (
                                  <div className="mt-0.5 text-muted-foreground">
                                    {entry.description}
                                  </div>
                                )}
                                <div className="mt-1">
                                  <span
                                    className="inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                                    style={{ backgroundColor: entry.color }}
                                  >
                                    {getCategoryLabel(entry.category)}
                                  </span>
                                </div>
                                {isEditing ? (
                                  <button
                                    className="mt-1 text-[10px] text-destructive hover:underline"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteEntry(entryIndex);
                                    }}
                                  >
                                    Entfernen
                                  </button>
                                ) : (
                                  entry.id && (
                                    <button
                                      className="mt-1 flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-primary hover:underline"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openDuplicateEntryDialog(entry);
                                      }}
                                    >
                                      <Copy className="h-2.5 w-2.5" />
                                      Duplizieren
                                    </button>
                                  )
                                )}
                              </div>
                            </td>
                          );
                        }

                        return (
                          <td
                            key={day}
                            className={`border border-border p-1 ${isEditing ? "cursor-pointer hover:bg-muted/50" : ""}`}
                            onClick={
                              isEditing ? () => openNewEntry(day, slot) : undefined
                            }
                          >
                            {isEditing && (
                              <div className="flex h-full min-h-[40px] items-center justify-center text-muted-foreground">
                                <Plus className="h-3 w-3" />
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>

            {/* Mobile: Stacked day cards */}
            <div className="space-y-4 md:hidden">
              {days.map((day) => {
                const dayEntries = entries
                  .filter((e) => e.day_of_week === day)
                  .sort((a, b) => a.start_time.localeCompare(b.start_time));
                return (
                  <div key={day} className="rounded-lg border border-border">
                    <div className="flex items-center justify-between border-b border-border bg-muted/50 px-3 py-2">
                      <span className="text-sm font-semibold">{DAY_NAMES[day]}</span>
                      {isEditing && (
                        <button
                          className="text-xs text-primary hover:underline"
                          onClick={() => openNewEntry(day)}
                        >
                          + Hinzufügen
                        </button>
                      )}
                    </div>
                    {dayEntries.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Keine Einträge
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {dayEntries.map((entry, idx) => {
                          const entryIndex = entries.findIndex(
                            (e) =>
                              e.day_of_week === entry.day_of_week &&
                              e.start_time === entry.start_time &&
                              e.end_time === entry.end_time
                          );
                          return (
                            <div
                              key={idx}
                              className={`flex items-start gap-3 px-3 py-2 ${isEditing ? "cursor-pointer hover:bg-muted/30" : ""}`}
                              style={{ borderLeft: `3px solid ${entry.color}` }}
                              onClick={
                                isEditing
                                  ? () => openEditEntry(entry, entryIndex)
                                  : undefined
                              }
                            >
                              <div className="shrink-0 text-xs text-muted-foreground">
                                {entry.start_time}
                                <br />
                                {entry.end_time}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="text-sm font-medium">{entry.activity}</div>
                                {entry.description && (
                                  <div className="text-xs text-muted-foreground">
                                    {entry.description}
                                  </div>
                                )}
                                <span
                                  className="mt-1 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium text-white"
                                  style={{ backgroundColor: entry.color }}
                                >
                                  {getCategoryLabel(entry.category)}
                                </span>
                              </div>
                              {isEditing && (
                                <button
                                  className="shrink-0 text-[10px] text-destructive hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteEntry(entryIndex);
                                  }}
                                >
                                  Entfernen
                                </button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Category Legend */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            {ENTRY_CATEGORIES.map((cat) => (
              <div key={cat.value} className="flex items-center gap-1.5">
                <div
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                <span className="text-xs text-muted-foreground">{cat.label}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Daily Activities */}
      {!isEditing && plan.daily_activities && plan.daily_activities.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-600">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <span className="text-lg">\ud83d\udccb</span>
              Tagesaktivit\u00e4ten
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {[0, 1, 2, 3, 4].map((dayIdx) => {
                const da = plan.daily_activities?.find((a) => a.day_of_week === dayIdx);
                if (!da || !da.content) return null;
                return (
                  <div key={dayIdx} className="rounded-lg border border-border p-3">
                    <h4 className="mb-2 text-sm font-semibold">
                      {DAY_NAMES[dayIdx as DayOfWeek]}
                    </h4>
                    <div
                      className="prose prose-xs dark:prose-invert max-w-none text-sm"
                      dangerouslySetInnerHTML={{ __html: da.content }}
                    />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry Edit Dialog */}
      <Dialog open={entryDialog} onOpenChange={setEntryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingEntryIndex !== null ? "Eintrag bearbeiten" : "Neuer Eintrag"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Tag</label>
                <Select
                  value={String(editingEntry.day_of_week)}
                  onValueChange={(v) =>
                    setEditingEntry({
                      ...editingEntry,
                      day_of_week: Number(v) as DayOfWeek,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {days.map((d) => (
                      <SelectItem key={d} value={String(d)}>
                        {DAY_NAMES[d]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Kategorie</label>
                <Select
                  value={editingEntry.category}
                  onValueChange={(v) =>
                    setEditingEntry({
                      ...editingEntry,
                      category: v,
                      color: getCategoryColor(v),
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        <div className="flex items-center gap-2">
                          <div
                            className="h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                          {cat.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Von</label>
                <Input
                  type="time"
                  value={editingEntry.start_time}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, start_time: e.target.value })
                  }
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Bis</label>
                <Input
                  type="time"
                  value={editingEntry.end_time}
                  onChange={(e) =>
                    setEditingEntry({ ...editingEntry, end_time: e.target.value })
                  }
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Aktivität</label>
              <Input
                value={editingEntry.activity}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, activity: e.target.value })
                }
                placeholder="z.B. Mathematik, Fußball, Basteln..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Beschreibung</label>
              <Textarea
                value={editingEntry.description}
                onChange={(e) =>
                  setEditingEntry({ ...editingEntry, description: e.target.value })
                }
                placeholder="Kurze Beschreibung der Aktivität..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEntryDialog(false)}>
              Abbrechen
            </Button>
            <Button onClick={saveEntry} disabled={!editingEntry.activity}>
              {editingEntryIndex !== null ? "Aktualisieren" : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Entry Dialog */}
      <Dialog open={duplicateEntryDialog} onOpenChange={setDuplicateEntryDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eintrag duplizieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {duplicateSourceEntry && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <div className="text-sm font-semibold">{duplicateSourceEntry.activity}</div>
                <div className="text-xs text-muted-foreground">
                  {DAY_NAMES[duplicateSourceEntry.day_of_week]} {duplicateSourceEntry.start_time} \u2013 {duplicateSourceEntry.end_time}
                </div>
                {duplicateSourceEntry.description && (
                  <div className="mt-1 text-xs text-muted-foreground">{duplicateSourceEntry.description}</div>
                )}
              </div>
            )}
            <div>
              <label className="mb-1 block text-sm font-medium">Ziel-Wochentag</label>
              <Select value={duplicateTargetDay} onValueChange={setDuplicateTargetDay}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {days.map((d) => (
                    <SelectItem key={d} value={String(d)}>
                      {DAY_NAMES[d]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateEntryDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleDuplicateEntry}
              disabled={duplicateEntryMutation.isPending}
            >
              <Copy className="mr-2 h-4 w-4" />
              {duplicateEntryMutation.isPending ? "Duplizieren..." : "Duplizieren"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
