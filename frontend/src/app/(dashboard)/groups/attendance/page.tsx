"use client";

import { useState, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import {
  ClipboardCheck,
  Save,
  CheckCircle2,
  XCircle,
  ThermometerSun,
  CalendarOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import { useGroups, useStudents } from "@/hooks/use-groups";
import {
  useAttendance,
  useBulkAttendance,
  type BulkAttendanceRecord,
} from "@/hooks/use-attendance";

/* ───── Status Config ─────────────────────────────────────────────────────── */

const STATUS_OPTIONS = [
  {
    value: "present" as const,
    label: "Anwesend",
    icon: CheckCircle2,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-100 dark:bg-green-900/30",
    badgeVariant: "success" as const,
  },
  {
    value: "absent" as const,
    label: "Abwesend",
    icon: XCircle,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-100 dark:bg-red-900/30",
    badgeVariant: "destructive" as const,
  },
  {
    value: "sick" as const,
    label: "Krank",
    icon: ThermometerSun,
    color: "text-orange-600 dark:text-orange-400",
    bgColor: "bg-orange-100 dark:bg-orange-900/30",
    badgeVariant: "warning" as const,
  },
  {
    value: "excused" as const,
    label: "Beurlaubt",
    icon: CalendarOff,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-100 dark:bg-blue-900/30",
    badgeVariant: "secondary" as const,
  },
];

type AttendanceStatus = "present" | "absent" | "sick" | "excused";

interface LocalRecord {
  student_id: number;
  student_name: string;
  status: AttendanceStatus;
  notes: string;
}

/* ───── Helper ────────────────────────────────────────────────────────────── */

function formatDateISO(date: Date): string {
  return format(date, "yyyy-MM-dd");
}

function formatDateDisplay(date: Date): string {
  return format(date, "EEEE, d. MMMM yyyy", { locale: de });
}

/* ───── Page Component ────────────────────────────────────────────────────── */

export default function AttendancePage() {
  const { toast } = useToast();
  const [selectedGroupId, setSelectedGroupId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [localRecords, setLocalRecords] = useState<LocalRecord[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [expandedNotes, setExpandedNotes] = useState<number | null>(null);

  const dateStr = formatDateISO(selectedDate);

  // Fetch groups
  const { data: groupsData, isLoading: groupsLoading } = useGroups({
    page_size: 100,
  });

  // Fetch students for selected group
  const { data: studentsData, isLoading: studentsLoading } = useStudents(
    selectedGroupId
      ? { group_id: selectedGroupId, page_size: 100, is_deleted: "false" }
      : undefined
  );

  // Fetch existing attendance for selected group + date
  const { data: attendanceData, isLoading: attendanceLoading } = useAttendance(
    selectedGroupId
      ? { group_id: selectedGroupId, date: dateStr, page_size: 200 }
      : undefined
  );

  // Bulk save mutation
  const bulkMutation = useBulkAttendance();

  // Build local records from students + existing attendance
  useMemo(() => {
    if (!studentsData?.results || !selectedGroupId) {
      setLocalRecords([]);
      return;
    }

    const existingMap = new Map<number, { status: AttendanceStatus; notes: string }>();
    if (attendanceData?.results) {
      for (const a of attendanceData.results) {
        existingMap.set(a.student, {
          status: a.status,
          notes: a.notes || "",
        });
      }
    }

    const records: LocalRecord[] = studentsData.results.map((student) => {
      const existing = existingMap.get(student.id);
      return {
        student_id: student.id,
        student_name: `${student.first_name || ""} ${student.last_name || ""}`.trim(),
        status: existing?.status || "present",
        notes: existing?.notes || "",
      };
    });

    setLocalRecords(records);
    setHasUnsavedChanges(false);
  }, [studentsData, attendanceData, selectedGroupId]);

  // Update a record
  const updateRecord = useCallback(
    (studentId: number, field: "status" | "notes", value: string) => {
      setLocalRecords((prev) =>
        prev.map((r) =>
          r.student_id === studentId ? { ...r, [field]: value } : r
        )
      );
      setHasUnsavedChanges(true);
    },
    []
  );

  // Set all students to a specific status
  const setAllStatus = useCallback((status: AttendanceStatus) => {
    setLocalRecords((prev) => prev.map((r) => ({ ...r, status })));
    setHasUnsavedChanges(true);
  }, []);

  // Save all records
  const handleSave = useCallback(async () => {
    if (!selectedGroupId || localRecords.length === 0) return;

    const records: BulkAttendanceRecord[] = localRecords.map((r) => ({
      student_id: r.student_id,
      status: r.status,
      notes: r.notes,
    }));

    bulkMutation.mutate(
      {
        group_id: parseInt(selectedGroupId),
        date: dateStr,
        records,
      },
      {
        onSuccess: (data) => {
          toast({
            type: "success",
            title: "Anwesenheit gespeichert",
            description: `${data.created} erstellt, ${data.updated} aktualisiert.`,
          });
          setHasUnsavedChanges(false);
        },
        onError: () => {
          toast({
            type: "error",
            title: "Fehler beim Speichern",
            description: "Die Anwesenheit konnte nicht gespeichert werden.",
          });
        },
      }
    );
  }, [selectedGroupId, localRecords, dateStr, bulkMutation, toast]);

  // Navigate date
  const goDay = useCallback(
    (delta: number) => {
      setSelectedDate((prev) => {
        const next = new Date(prev);
        next.setDate(next.getDate() + delta);
        return next;
      });
    },
    []
  );

  // Stats
  const stats = useMemo(() => {
    const counts = { present: 0, absent: 0, sick: 0, excused: 0 };
    for (const r of localRecords) {
      counts[r.status]++;
    }
    return counts;
  }, [localRecords]);

  const isLoading = groupsLoading || studentsLoading || attendanceLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Anwesenheit"
        description="Tägliche Anwesenheitserfassung für Schüler:innen"
      />

      {/* Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        {/* Group Selector */}
        <div className="flex-1 space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Gruppe
          </label>
          <Select
            value={selectedGroupId}
            onValueChange={(v) => {
              setSelectedGroupId(v);
              setHasUnsavedChanges(false);
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Gruppe auswählen..." />
            </SelectTrigger>
            <SelectContent>
              {groupsLoading ? (
                <SelectItem value="loading" disabled>
                  Laden...
                </SelectItem>
              ) : (
                groupsData?.results?.map((group) => (
                  <SelectItem key={group.id} value={String(group.id)}>
                    {group.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        {/* Date Navigation */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Datum
          </label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => goDay(-1)}
              title="Vorheriger Tag"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="min-w-[220px] rounded-md border bg-background px-3 py-2 text-center text-sm">
              {formatDateDisplay(selectedDate)}
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => goDay(1)}
              title="Nächster Tag"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Heute
            </Button>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={
            !selectedGroupId ||
            localRecords.length === 0 ||
            bulkMutation.isPending ||
            !hasUnsavedChanges
          }
          className="sm:self-end"
        >
          {bulkMutation.isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Speichern
        </Button>
      </div>

      {/* No group selected */}
      {!selectedGroupId && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-lg font-medium text-muted-foreground">
              Bitte eine Gruppe auswählen
            </p>
            <p className="text-sm text-muted-foreground/70">
              Wähle eine Gruppe aus, um die Anwesenheit zu erfassen.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats Summary */}
      {selectedGroupId && localRecords.length > 0 && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
          {STATUS_OPTIONS.map((opt) => (
            <Card
              key={opt.value}
              className={`cursor-pointer transition-colors hover:border-primary/50 ${opt.bgColor}`}
              onClick={() => setAllStatus(opt.value)}
            >
              <CardContent className="flex items-center gap-3 p-4">
                <opt.icon className={`h-5 w-5 ${opt.color}`} />
                <div>
                  <p className="text-2xl font-bold">{stats[opt.value]}</p>
                  <p className="text-xs text-muted-foreground">{opt.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Attendance Table */}
      {selectedGroupId && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardCheck className="h-4 w-4" />
              {groupsData?.results?.find(
                (g) => g.id === parseInt(selectedGroupId)
              )?.name || "Gruppe"}{" "}
              – {formatDateDisplay(selectedDate)}
            </CardTitle>
            {hasUnsavedChanges && (
              <Badge variant="warning" className="text-xs">
                Ungespeicherte Änderungen
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : localRecords.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
                <p>Keine Schüler:innen in dieser Gruppe.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Schüler:in</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden sm:table-cell w-[200px]">
                      Notizen
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {localRecords.map((record) => {
                    const currentStatus = STATUS_OPTIONS.find(
                      (s) => s.value === record.status
                    );
                    return (
                      <TableRow key={record.student_id}>
                        <TableCell className="font-medium">
                          {record.student_name || `Schüler:in #${record.student_id}`}
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1.5">
                            {STATUS_OPTIONS.map((opt) => {
                              const isActive = record.status === opt.value;
                              return (
                                <Button
                                  key={opt.value}
                                  variant={isActive ? "default" : "outline"}
                                  size="sm"
                                  className={`h-8 gap-1 text-xs ${
                                    isActive
                                      ? ""
                                      : "text-muted-foreground hover:text-foreground"
                                  }`}
                                  onClick={() =>
                                    updateRecord(
                                      record.student_id,
                                      "status",
                                      opt.value
                                    )
                                  }
                                >
                                  <opt.icon className="h-3.5 w-3.5" />
                                  <span className="hidden sm:inline">
                                    {opt.label}
                                  </span>
                                </Button>
                              );
                            })}
                          </div>
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {expandedNotes === record.student_id ? (
                            <Textarea
                              value={record.notes}
                              onChange={(e) =>
                                updateRecord(
                                  record.student_id,
                                  "notes",
                                  e.target.value
                                )
                              }
                              onBlur={() => setExpandedNotes(null)}
                              placeholder="Notiz hinzufügen..."
                              className="min-h-[60px] text-sm"
                              autoFocus
                            />
                          ) : (
                            <button
                              onClick={() =>
                                setExpandedNotes(record.student_id)
                              }
                              className="w-full cursor-pointer rounded px-2 py-1 text-left text-sm text-muted-foreground hover:bg-muted"
                            >
                              {record.notes || "Notiz hinzufügen..."}
                            </button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
