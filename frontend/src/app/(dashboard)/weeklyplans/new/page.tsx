"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useCreateWeeklyPlan } from "@/hooks/use-weeklyplans";
import { useGroups } from "@/hooks/use-groups";
import { useToast } from "@/components/ui/toast";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  Clock,
  CalendarDays,
  X,
} from "lucide-react";
import type { DayOfWeek, WeeklyPlanEntry } from "@/types/models";

// Dynamic import for RichTextEditor (SSR-incompatible)
const RichTextEditor = dynamic(
  () =>
    import("@/components/ui/rich-text-editor").then((m) => m.RichTextEditor),
  { ssr: false, loading: () => <Skeleton className="h-24 w-full" /> }
);
const CellRichTextEditor = dynamic(
  () =>
    import("@/components/ui/rich-text-editor").then(
      (m) => m.CellRichTextEditor
    ),
  { ssr: false, loading: () => <Skeleton className="h-12 w-full" /> }
);

// ── Types ──────────────────────────────────────────────────────────────────

interface TimeSlot {
  id: string;
  start_time: string;
  end_time: string;
  cells: Record<number, string>; // day_of_week -> activity HTML
}

const DAY_LABELS = ["Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag"];

const DEFAULT_TIME_SLOTS: Omit<TimeSlot, "id">[] = [
  {
    start_time: "11:20",
    end_time: "12:10",
    cells: { 0: "Kinder kommen", 1: "Kinder kommen", 2: "Kinder kommen", 3: "Kinder kommen", 4: "Kinder kommen" },
  },
  {
    start_time: "12:20",
    end_time: "13:00",
    cells: { 0: "Mittagessen", 1: "Mittagessen", 2: "Mittagessen", 3: "Mittagessen", 4: "Mittagessen" },
  },
  {
    start_time: "13:10",
    end_time: "14:00",
    cells: { 0: "Lernstunde", 1: "Lernstunde", 2: "Lernstunde", 3: "Lernstunde", 4: "Lernstunde" },
  },
  {
    start_time: "14:30",
    end_time: "15:00",
    cells: { 0: "Jausenzeit", 1: "Jausenzeit", 2: "Jausenzeit", 3: "Jausenzeit", 4: "Jausenzeit" },
  },
  {
    start_time: "15:00",
    end_time: "16:15",
    cells: {
      0: "Betreute Freizeit\nBegrüßung gemeinsamer Kreis",
      1: "Betreute Freizeit\nBegrüßung gemeinsamer Kreis",
      2: "Betreute Freizeit\nBegrüßung gemeinsamer Kreis",
      3: "Betreute Freizeit\nBegrüßung gemeinsamer Kreis",
      4: "Betreute Freizeit\nBegrüßung gemeinsamer Kreis",
    },
  },
];

function generateId() {
  return Math.random().toString(36).slice(2, 9);
}

function getCalendarWeek(dateStr: string): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function getWeekEndDate(startDate: string): string {
  if (!startDate) return "";
  const d = new Date(startDate);
  d.setDate(d.getDate() + 4);
  return d.toISOString().split("T")[0];
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("de-AT", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Component ──────────────────────────────────────────────────────────────

export default function NewWeeklyPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTemplate = searchParams.get("template") === "true";

  const toast = useToast();
  const createMutation = useCreateWeeklyPlan();
  const { data: groupsData, isLoading: loadingGroups } = useGroups({
    page_size: 200,
  });

  // ── Form state ─────────────────────────────────────────────────────────
  const [title, setTitle] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [weeklyTheme, setWeeklyTheme] = useState("");
  const [groupId, setGroupId] = useState("");
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split("T")[0];
  });
  const [asTemplate, setAsTemplate] = useState(isTemplate);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>(
    DEFAULT_TIME_SLOTS.map((s) => ({ ...s, id: generateId() }))
  );
  const [dailyActivities, setDailyActivities] = useState<Record<number, string>>({
    0: "",
    1: "",
    2: "",
    3: "",
    4: "",
  });

  // ── Derived data ───────────────────────────────────────────────────────
  const selectedGroup = useMemo(() => {
    if (!groupId || !groupsData?.results) return null;
    return groupsData.results.find((g) => g.id === Number(groupId)) ?? null;
  }, [groupId, groupsData]);

  const calendarWeek = useMemo(() => getCalendarWeek(weekStartDate), [weekStartDate]);
  const weekEndDate = useMemo(() => getWeekEndDate(weekStartDate), [weekStartDate]);

  // Auto-set title
  useEffect(() => {
    if (calendarWeek && !asTemplate) {
      setTitle(`Wochenplan KW ${calendarWeek}`);
    }
  }, [calendarWeek, asTemplate]);

  // ── Time slot handlers ─────────────────────────────────────────────────

  const addTimeSlot = () => {
    const lastSlot = timeSlots[timeSlots.length - 1];
    setTimeSlots([
      ...timeSlots,
      {
        id: generateId(),
        start_time: lastSlot?.end_time || "16:00",
        end_time: "17:00",
        cells: { 0: "", 1: "", 2: "", 3: "", 4: "" },
      },
    ]);
  };

  const removeTimeSlot = (id: string) => {
    setTimeSlots(timeSlots.filter((s) => s.id !== id));
  };

  const updateSlotTime = (id: string, field: "start_time" | "end_time", value: string) => {
    setTimeSlots(
      timeSlots.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const updateSlotCell = (slotId: string, day: number, html: string) => {
    setTimeSlots(
      timeSlots.map((s) =>
        s.id === slotId ? { ...s, cells: { ...s.cells, [day]: html } } : s
      )
    );
  };

  // ── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !title) return;

    // Build entries from time slots
    const entries: Omit<WeeklyPlanEntry, "id" | "day_name">[] = [];
    timeSlots.forEach((slot, sortOrder) => {
      for (let day = 0; day < 5; day++) {
        const activity = slot.cells[day] || "";
        if (activity) {
          entries.push({
            day_of_week: day as DayOfWeek,
            start_time: slot.start_time,
            end_time: slot.end_time,
            activity,
            description: "",
            color: "",
            category: "sonstiges",
            sort_order: sortOrder,
          });
        }
      }
    });

    // Build daily activities
    const dailyActs = Object.entries(dailyActivities)
      .filter(([, content]) => content.trim())
      .map(([day, content]) => ({
        day_of_week: Number(day) as DayOfWeek,
        content,
      }));

    try {
      const result = await createMutation.mutateAsync({
        group: Number(groupId),
        week_start_date: weekStartDate,
        title,
        weekly_theme: weeklyTheme,
        status: "draft",
        is_template: asTemplate,
        template_name: asTemplate ? templateName || title : undefined,
        entries,
        daily_activities: dailyActs,
      });

      toast.success(
        asTemplate
          ? "Vorlage erfolgreich erstellt"
          : "Wochenplan erfolgreich erstellt"
      );
      router.push(`/weeklyplans/${result.id}`);
    } catch {
      toast.error("Fehler", "Wochenplan konnte nicht erstellt werden.");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/weeklyplans">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {asTemplate ? "Neue Vorlage" : "Neuer Wochenplan"}
          </h1>
          <p className="text-muted-foreground">
            {asTemplate
              ? "Erstellen Sie eine wiederverwendbare Vorlage"
              : "Nachmittagsbetreuung – Die Standardzeiten sind vorausgefüllt, können aber angepasst werden."}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        {/* ── Metadaten-Karte ──────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <CardTitle>Grunddaten</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {/* Gruppe */}
              <div>
                <Label htmlFor="group">Gruppenname *</Label>
                {loadingGroups ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select value={groupId} onValueChange={setGroupId}>
                    <SelectTrigger id="group">
                      <SelectValue placeholder="Gruppe auswählen..." />
                    </SelectTrigger>
                    <SelectContent>
                      {groupsData?.results?.map((group) => (
                        <SelectItem key={group.id} value={String(group.id)}>
                          {group.name}
                          {group.location_name && ` (${group.location_name})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Volksschule (auto) */}
              <div>
                <Label>Volksschule (Standort)</Label>
                <Input
                  value={selectedGroup?.location_name || "–"}
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Kalenderwoche */}
              <div>
                <Label>Kalenderwoche</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={calendarWeek ? `KW ${calendarWeek}` : "–"}
                    readOnly
                    className="bg-muted"
                  />
                </div>
              </div>

              {/* Schuljahr */}
              <div>
                <Label>Schuljahr</Label>
                <Input value="2025/2026" readOnly className="bg-muted" />
              </div>

              {/* Datum von */}
              {!asTemplate && (
                <div>
                  <Label htmlFor="weekStart">
                    <CalendarDays className="mr-1 inline h-4 w-4" />
                    Datum von *
                  </Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="weekStart"
                      type="date"
                      value={weekStartDate}
                      onChange={(e) => setWeekStartDate(e.target.value)}
                      required
                    />
                    {calendarWeek && (
                      <span className="whitespace-nowrap rounded bg-yellow-500 px-2 py-1 text-xs font-bold text-white">
                        KW {calendarWeek}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Datum bis */}
              {!asTemplate && (
                <div>
                  <Label>Datum bis</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      value={weekEndDate}
                      type="date"
                      readOnly
                      className="bg-muted"
                    />
                    {calendarWeek && (
                      <span className="whitespace-nowrap rounded bg-yellow-500 px-2 py-1 text-xs font-bold text-white">
                        KW {calendarWeek}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Gruppenleiter/in */}
              <div>
                <Label>Gruppenleiter/in</Label>
                <Input
                  value={
                    selectedGroup?.leader
                      ? `${selectedGroup.leader.first_name} ${selectedGroup.leader.last_name}`.trim()
                      : selectedGroup?.group_leader_name || "–"
                  }
                  readOnly
                  className="bg-muted"
                />
              </div>

              {/* Template toggle */}
              <div className="flex items-center space-x-2 pt-6">
                <Switch
                  id="template"
                  checked={asTemplate}
                  onCheckedChange={setAsTemplate}
                />
                <Label htmlFor="template">Als Vorlage speichern</Label>
              </div>
            </div>

            {asTemplate && (
              <div className="mt-4">
                <Label htmlFor="templateName">Vorlagen-Name</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="z.B. Standard GTS Wochenplan"
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Thema der Woche ──────────────────────────────────────────── */}
        <Card className="mt-6 border-yellow-400 dark:border-yellow-600">
          <CardHeader className="bg-yellow-50 dark:bg-yellow-950/30">
            <CardTitle className="flex items-center gap-2 text-yellow-800 dark:text-yellow-200">
              <span className="text-lg">⭐</span>
              Aktivitäten / Thema der Woche
            </CardTitle>
          </CardHeader>
          <CardContent className="bg-yellow-50/50 pt-4 dark:bg-yellow-950/20">
            <RichTextEditor
              content={weeklyTheme}
              onChange={setWeeklyTheme}
              placeholder="Geben Sie hier das übergreifende Thema oder besondere Aktivitäten der Woche ein..."
              variant="highlight"
              minHeight="100px"
            />
          </CardContent>
        </Card>

        {/* ── Wochenplan-Tabelle ───────────────────────────────────────── */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Wochenplan – Nachmittagsbetreuung
              </span>
              <Button
                type="button"
                size="sm"
                variant="default"
                className="bg-green-600 hover:bg-green-700"
                onClick={addTimeSlot}
              >
                <Plus className="mr-1 h-4 w-4" />
                Zeitfenster hinzufügen
              </Button>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Die Standardzeiten sind vorausgefüllt, können aber angepasst
              werden.
            </p>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th
                    colSpan={2}
                    className="border border-border bg-muted/50 p-2 text-center text-xs font-semibold"
                  >
                    Uhrzeit
                  </th>
                  {DAY_LABELS.map((day) => (
                    <th
                      key={day}
                      className="border border-border bg-yellow-500 p-2 text-center text-xs font-bold text-white"
                    >
                      {day}
                    </th>
                  ))}
                  <th className="w-[60px] border border-border bg-yellow-500 p-2 text-center text-xs font-bold text-white">
                    Aktion
                  </th>
                </tr>
                <tr>
                  <th className="border border-border bg-muted/30 p-1 text-center text-xs">
                    Von
                  </th>
                  <th className="border border-border bg-muted/30 p-1 text-center text-xs">
                    Bis
                  </th>
                  {DAY_LABELS.map((day) => (
                    <th key={day} className="border border-border p-0" />
                  ))}
                  <th className="border border-border p-0" />
                </tr>
              </thead>
              <tbody>
                {timeSlots.map((slot) => (
                  <tr key={slot.id}>
                    <td className="w-[90px] border border-border p-1">
                      <Input
                        type="time"
                        value={slot.start_time}
                        onChange={(e) =>
                          updateSlotTime(slot.id, "start_time", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </td>
                    <td className="w-[90px] border border-border p-1">
                      <Input
                        type="time"
                        value={slot.end_time}
                        onChange={(e) =>
                          updateSlotTime(slot.id, "end_time", e.target.value)
                        }
                        className="h-8 text-xs"
                      />
                    </td>
                    {[0, 1, 2, 3, 4].map((day) => (
                      <td
                        key={day}
                        className="border border-border p-1"
                        style={{ minWidth: "140px" }}
                      >
                        <CellRichTextEditor
                          content={slot.cells[day] || ""}
                          onChange={(html) =>
                            updateSlotCell(slot.id, day, html)
                          }
                          placeholder="Aktivität..."
                        />
                      </td>
                    ))}
                    <td className="border border-border p-1 text-center">
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removeTimeSlot(slot.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* ── Tagesaktivitäten-Vorlagen ────────────────────────────────── */}
        <Card className="mt-6 border-amber-300 dark:border-amber-600">
          <CardHeader className="bg-amber-50 dark:bg-amber-950/30">
            <CardTitle className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
              <span className="text-lg">📋</span>
              Tagesaktivitäten-Vorlagen (passend zum Thema)
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Erstellen Sie hier detaillierte Aktivitäten für jeden Wochentag.
              Diese werden im Ausdruck unter dem Wochenplan angezeigt und dienen
              als Inspiration und Dokumentation.
            </p>
          </CardHeader>
          <CardContent className="pt-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {DAY_LABELS.map((day, i) => (
                <div key={day}>
                  <Label className="mb-1 flex items-center gap-1 text-sm font-semibold">
                    <span className="text-base">📅</span> {day}
                  </Label>
                  <RichTextEditor
                    content={dailyActivities[i] || ""}
                    onChange={(html) =>
                      setDailyActivities((prev) => ({ ...prev, [i]: html }))
                    }
                    placeholder={`Aktivitäten für ${day}...`}
                    minHeight="120px"
                  />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Footer Buttons ───────────────────────────────────────────── */}
        <div className="mt-6 flex justify-between">
          <Button variant="destructive" asChild>
            <Link href="/weeklyplans">
              <X className="mr-2 h-4 w-4" />
              Abbrechen
            </Link>
          </Button>
          <Button
            type="submit"
            disabled={createMutation.isPending || !title || !groupId}
            className="bg-green-600 hover:bg-green-700"
          >
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending
              ? "Erstellen..."
              : asTemplate
                ? "Vorlage erstellen"
                : "Wochenplan speichern"}
          </Button>
        </div>
      </form>
    </div>
  );
}
