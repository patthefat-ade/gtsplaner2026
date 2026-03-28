"use client";

import { useState, useEffect } from "react";
import {
  useDailyProtocols,
  useBulkProtocols,
  useUpdateProtocol,
  useDeleteProtocol,
} from "@/hooks/use-protocols";
import { useGroups, useStudents } from "@/hooks/use-groups";
import { useContacts } from "@/hooks/use-contacts";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  FileText,
  Plus,
  Save,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ArrowLeftRight,
  Trash2,
  Edit,
  Clock,
  User,
} from "lucide-react";
import type {
  DailyProtocol,
  IncidentSeverity,
  BulkDailyProtocolRecord,
  StudentContact,
} from "@/types/models";
import { SEVERITY_LABELS, SEVERITY_COLORS } from "@/types/models";

/* ─── Helper ─────────────────────────────────────────────────────────── */

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

function SeverityBadge({ severity }: { severity: IncidentSeverity }) {
  const color = SEVERITY_COLORS[severity];
  const label = SEVERITY_LABELS[severity];
  const Icon =
    severity === "urgent"
      ? AlertCircle
      : severity === "important"
        ? AlertTriangle
        : CheckCircle2;
  return (
    <Badge
      variant="outline"
      className="gap-1"
      style={{ borderColor: color, color }}
    >
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

/* ─── Bulk Row State ─────────────────────────────────────────────────── */

interface ProtocolRow {
  student_id: number;
  student_name: string;
  arrival_time: string;
  arrival_notes: string;
  incidents: string;
  incident_severity: IncidentSeverity;
  pickup_time: string;
  picked_up_by_id: number | null;
  pickup_notes: string;
  existing_id?: number;
}

/* ─── Main Page ──────────────────────────────────────────────────────── */

export default function DailyProtocolsPage() {
  const { toast } = useToast();

  // Tab state
  const [activeTab, setActiveTab] = useState<string>("erfassung");

  // Bulk-Erfassung state
  const [selectedGroup, setSelectedGroup] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [rows, setRows] = useState<ProtocolRow[]>([]);

  // Listenansicht state
  const [filterGroup, setFilterGroup] = useState<string>("");
  const [filterDate, setFilterDate] = useState(todayStr());
  const [filterSeverity, setFilterSeverity] = useState<string>("");
  const [listPage, setListPage] = useState(1);

  // Edit dialog
  const [editDialog, setEditDialog] = useState(false);
  const [editRow, setEditRow] = useState<DailyProtocol | null>(null);
  const [editForm, setEditForm] = useState({
    arrival_time: "",
    arrival_notes: "",
    incidents: "",
    incident_severity: "normal" as IncidentSeverity,
    pickup_time: "",
    picked_up_by: null as number | null,
    pickup_notes: "",
  });

  // Delete dialog
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Data queries
  const { data: groupsData } = useGroups();
  const groups = groupsData?.results ?? [];

  const { data: studentsData } = useStudents(
    selectedGroup ? { group: Number(selectedGroup) } : undefined
  );
  const students = studentsData?.results ?? [];

  // Load contacts for pickup dropdown
  const { data: contactsData } = useContacts(
    selectedGroup ? {} : undefined
  );
  const allContacts: StudentContact[] = (contactsData?.results ?? []) as StudentContact[];

  // Load existing protocols for selected group+date
  const { data: existingData, isLoading: existingLoading } = useDailyProtocols(
    selectedGroup && selectedDate
      ? { group_id: Number(selectedGroup), date: selectedDate }
      : {}
  );
  const existingProtocols = existingData?.results ?? [];

  // List data
  const listFilters: Record<string, string | number> = {};
  if (filterGroup) listFilters.group_id = Number(filterGroup);
  if (filterDate) listFilters.date = filterDate;
  if (filterSeverity) listFilters.incident_severity = filterSeverity;
  listFilters.page = listPage;

  const {
    data: listData,
    isLoading: listLoading,
    error: listError,
  } = useDailyProtocols(activeTab === "liste" ? listFilters : {});

  // Mutations
  const bulkMutation = useBulkProtocols();
  const updateMutation = useUpdateProtocol();
  const deleteMutation = useDeleteProtocol();

  // Build rows when students or existing protocols change
  useEffect(() => {
    if (!students.length) {
      setRows([]);
      return;
    }
    const newRows: ProtocolRow[] = students.map((s) => {
      const existing = existingProtocols.find((p) => p.student === s.id);
      return {
        student_id: s.id,
        student_name: `${s.first_name} ${s.last_name}`,
        arrival_time: existing?.arrival_time ?? "",
        arrival_notes: existing?.arrival_notes ?? "",
        incidents: existing?.incidents ?? "",
        incident_severity: existing?.incident_severity ?? "normal",
        pickup_time: existing?.pickup_time ?? "",
        picked_up_by_id: existing?.picked_up_by ?? null,
        pickup_notes: existing?.pickup_notes ?? "",
        existing_id: existing?.id,
      };
    });
    setRows(newRows);
  }, [students, existingProtocols]);

  // Auto-select first group for educator
  useEffect(() => {
    if (!selectedGroup && groups.length > 0) {
      setSelectedGroup(String(groups[0].id));
    }
  }, [groups, selectedGroup]);

  /* ─── Handlers ───────────────────────────────────────────────────── */

  function updateRow(idx: number, field: keyof ProtocolRow, value: string | number | null) {
    setRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  }

  async function handleBulkSave() {
    if (!selectedGroup || !selectedDate) return;
    const records: BulkDailyProtocolRecord[] = rows.map((r) => ({
      student_id: r.student_id,
      arrival_time: r.arrival_time || null,
      arrival_notes: r.arrival_notes,
      incidents: r.incidents,
      incident_severity: r.incident_severity,
      pickup_time: r.pickup_time || null,
      picked_up_by_id: r.picked_up_by_id,
      pickup_notes: r.pickup_notes,
    }));

    try {
      const result = await bulkMutation.mutateAsync({
        group_id: Number(selectedGroup),
        date: selectedDate,
        records,
      });
      toast({
        type: "success",
        title: "Gespeichert",
        description: `${result.created} erstellt, ${result.updated} aktualisiert.`,
      });
    } catch {
      toast({
        type: "error",
        title: "Fehler",
        description: "Protokolle konnten nicht gespeichert werden.",
      });
    }
  }

  function openEditDialog(protocol: DailyProtocol) {
    setEditRow(protocol);
    setEditForm({
      arrival_time: protocol.arrival_time ?? "",
      arrival_notes: protocol.arrival_notes,
      incidents: protocol.incidents,
      incident_severity: protocol.incident_severity,
      pickup_time: protocol.pickup_time ?? "",
      picked_up_by: protocol.picked_up_by,
      pickup_notes: protocol.pickup_notes,
    });
    setEditDialog(true);
  }

  async function handleEditSave() {
    if (!editRow) return;
    try {
      await updateMutation.mutateAsync({
        id: editRow.id,
        data: {
          arrival_time: editForm.arrival_time || null,
          arrival_notes: editForm.arrival_notes,
          incidents: editForm.incidents,
          incident_severity: editForm.incident_severity,
          pickup_time: editForm.pickup_time || null,
          picked_up_by: editForm.picked_up_by,
          pickup_notes: editForm.pickup_notes,
        },
      });
      toast({ type: "success", title: "Aktualisiert", description: "Protokoll wurde gespeichert." });
      setEditDialog(false);
    } catch {
      toast({
        type: "error",
        title: "Fehler",
        description: "Protokoll konnte nicht aktualisiert werden.",
      });
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast({ type: "success", title: "Gelöscht", description: "Protokoll wurde entfernt." });
      setDeleteId(null);
    } catch {
      toast({
        type: "error",
        title: "Fehler",
        description: "Protokoll konnte nicht gelöscht werden.",
      });
    }
  }

  // Get contacts for a specific student
  function getStudentContacts(studentId: number) {
    return allContacts.filter((c) => c.student === studentId);
  }

  const selectedGroupName = groups.find(
    (g) => g.id === Number(selectedGroup)
  )?.name;

  /* ─── Render ─────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Tagesprotokoll"
        description="Tägliche Protokolle für Schüler:innen – Ankunft, Vorkommnisse und Abholung"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="erfassung">
            <Plus className="mr-2 h-4 w-4" />
            Erfassung
          </TabsTrigger>
          <TabsTrigger value="liste">
            <FileText className="mr-2 h-4 w-4" />
            Übersicht
          </TabsTrigger>
        </TabsList>

        {/* ─── Tab: Erfassung ─────────────────────────────────────── */}
        <TabsContent value="erfassung" className="space-y-4">
          {/* Filter bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label>Gruppe</Label>
                  <Select
                    value={selectedGroup}
                    onValueChange={setSelectedGroup}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Gruppe wählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-[180px]"
                  />
                </div>
                <Button
                  onClick={handleBulkSave}
                  disabled={bulkMutation.isPending || !rows.length}
                  className="ml-auto"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {bulkMutation.isPending ? "Speichern..." : "Alle speichern"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Info */}
          {selectedGroupName && (
            <p className="text-sm text-muted-foreground">
              {rows.length} Schüler:innen in{" "}
              <span className="font-medium">{selectedGroupName}</span> am{" "}
              <span className="font-medium">
                {new Date(selectedDate).toLocaleDateString("de-AT")}
              </span>
              {existingProtocols.length > 0 && (
                <span className="ml-2 text-green-500">
                  ({existingProtocols.length} bereits erfasst)
                </span>
              )}
            </p>
          )}

          {/* Bulk table */}
          {!selectedGroup ? (
            <EmptyState
              icon={FileText}
              title="Gruppe wählen"
              description="Wählen Sie eine Gruppe um die Tagesprotokolle zu erfassen."
            />
          ) : existingLoading ? (
            <PageSkeleton />
          ) : rows.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="Keine Schüler:innen"
              description="In dieser Gruppe sind keine Schüler:innen eingetragen."
            />
          ) : (
            <div className="space-y-3">
              {rows.map((row, idx) => {
                const studentContacts = getStudentContacts(row.student_id);
                return (
                  <Card
                    key={row.student_id}
                    className={
                      row.existing_id
                        ? "border-green-500/30 bg-green-500/5"
                        : ""
                    }
                  >
                    <CardContent className="pt-4 pb-4">
                      <div className="flex items-center gap-2 mb-3">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{row.student_name}</span>
                        {row.existing_id && (
                          <Badge variant="outline" className="text-green-500 border-green-500 text-xs">
                            Bereits erfasst
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {/* Ankunft */}
                        <div className="space-y-1">
                          <Label className="text-xs">Ankunftszeit</Label>
                          <Input
                            type="time"
                            value={row.arrival_time}
                            onChange={(e) =>
                              updateRow(idx, "arrival_time", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Ankunft-Notizen</Label>
                          <Input
                            placeholder="z.B. von Mutter gebracht"
                            value={row.arrival_notes}
                            onChange={(e) =>
                              updateRow(idx, "arrival_notes", e.target.value)
                            }
                          />
                        </div>

                        {/* Vorkommnisse */}
                        <div className="space-y-1">
                          <Label className="text-xs">Vorkommnisse</Label>
                          <Textarea
                            placeholder="Besondere Vorkommnisse..."
                            value={row.incidents}
                            onChange={(e) =>
                              updateRow(idx, "incidents", e.target.value)
                            }
                            rows={1}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Schweregrad</Label>
                          <Select
                            value={row.incident_severity}
                            onValueChange={(v) =>
                              updateRow(
                                idx,
                                "incident_severity",
                                v as IncidentSeverity
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="normal">Normal</SelectItem>
                              <SelectItem value="important">Wichtig</SelectItem>
                              <SelectItem value="urgent">Dringend</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Abholung */}
                        <div className="space-y-1">
                          <Label className="text-xs">Abholzeit</Label>
                          <Input
                            type="time"
                            value={row.pickup_time}
                            onChange={(e) =>
                              updateRow(idx, "pickup_time", e.target.value)
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Abgeholt von</Label>
                          <Select
                            value={
                              row.picked_up_by_id
                                ? String(row.picked_up_by_id)
                                : ""
                            }
                            onValueChange={(v) =>
                              updateRow(
                                idx,
                                "picked_up_by_id",
                                v ? Number(v) : null
                              )
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Kontaktperson wählen" />
                            </SelectTrigger>
                            <SelectContent>
                              {studentContacts.map((c) => (
                                <SelectItem key={c.id} value={String(c.id)}>
                                  {c.first_name} {c.last_name} (
                                  {c.relationship_display})
                                </SelectItem>
                              ))}
                              {studentContacts.length === 0 && (
                                <SelectItem value="" disabled>
                                  Keine Kontakte hinterlegt
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <Label className="text-xs">Abhol-Notizen</Label>
                          <Input
                            placeholder="Notizen zur Abholung..."
                            value={row.pickup_notes}
                            onChange={(e) =>
                              updateRow(idx, "pickup_notes", e.target.value)
                            }
                          />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ─── Tab: Übersicht ─────────────────────────────────────── */}
        <TabsContent value="liste" className="space-y-4">
          {/* Filter bar */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label>Gruppe</Label>
                  <Select
                    value={filterGroup}
                    onValueChange={(v) => {
                      setFilterGroup(v);
                      setListPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue placeholder="Alle Gruppen" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Alle Gruppen</SelectItem>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Datum</Label>
                  <Input
                    type="date"
                    value={filterDate}
                    onChange={(e) => {
                      setFilterDate(e.target.value);
                      setListPage(1);
                    }}
                    className="w-[180px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Schweregrad</Label>
                  <Select
                    value={filterSeverity}
                    onValueChange={(v) => {
                      setFilterSeverity(v);
                      setListPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue placeholder="Alle" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">Alle</SelectItem>
                      <SelectItem value="normal">Normal</SelectItem>
                      <SelectItem value="important">Wichtig</SelectItem>
                      <SelectItem value="urgent">Dringend</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* List */}
          {listLoading ? (
            <PageSkeleton />
          ) : listError ? (
            <QueryError error={listError} />
          ) : !listData?.results?.length ? (
            <EmptyState
              icon={FileText}
              title="Keine Protokolle"
              description="Für die gewählten Filter wurden keine Tagesprotokolle gefunden."
            />
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Schüler:in</TableHead>
                        <TableHead>Gruppe</TableHead>
                        <TableHead>Ankunft</TableHead>
                        <TableHead>Vorkommnisse</TableHead>
                        <TableHead>Abholung</TableHead>
                        <TableHead>Abgeholt von</TableHead>
                        <TableHead className="w-[100px]">Aktionen</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {listData.results.map((p: DailyProtocol) => (
                        <TableRow key={p.id}>
                          <TableCell>
                            <div className="font-medium">{p.student_name}</div>
                            {p.has_transfer && (
                              <div className="flex items-center gap-1 text-xs text-amber-500 mt-0.5">
                                <ArrowLeftRight className="h-3 w-3" />
                                Wechsel: {p.effective_group_name}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {p.group_name}
                          </TableCell>
                          <TableCell>
                            {p.arrival_time ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {p.arrival_time.slice(0, 5)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                            {p.arrival_notes && (
                              <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[150px]">
                                {p.arrival_notes}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <SeverityBadge severity={p.incident_severity} />
                            {p.incidents && (
                              <div className="text-xs mt-1 truncate max-w-[200px]">
                                {p.incidents}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.pickup_time ? (
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3 text-muted-foreground" />
                                {p.pickup_time.slice(0, 5)}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.picked_up_by_name || (
                              <span className="text-muted-foreground">–</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEditDialog(p)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeleteId(p.id)}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {listData.count > 20 && (
                <div className="flex justify-center">
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={listPage <= 1}
                      onClick={() => setListPage((p) => p - 1)}
                    >
                      Zurück
                    </Button>
                    <span className="flex items-center text-sm text-muted-foreground px-2">
                      Seite {listPage} von {Math.ceil(listData.count / 20)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!listData.next}
                      onClick={() => setListPage((p) => p + 1)}
                    >
                      Weiter
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* ─── Edit Dialog ───────────────────────────────────────────── */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Protokoll bearbeiten</DialogTitle>
            <DialogDescription>
              {editRow?.student_name} –{" "}
              {editRow?.date &&
                new Date(editRow.date).toLocaleDateString("de-AT")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label>Ankunftszeit</Label>
                <Input
                  type="time"
                  value={editForm.arrival_time}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      arrival_time: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Abholzeit</Label>
                <Input
                  type="time"
                  value={editForm.pickup_time}
                  onChange={(e) =>
                    setEditForm((f) => ({
                      ...f,
                      pickup_time: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Ankunft-Notizen</Label>
              <Input
                value={editForm.arrival_notes}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    arrival_notes: e.target.value,
                  }))
                }
              />
            </div>
            <div className="space-y-1">
              <Label>Vorkommnisse</Label>
              <Textarea
                value={editForm.incidents}
                onChange={(e) =>
                  setEditForm((f) => ({ ...f, incidents: e.target.value }))
                }
                rows={3}
              />
            </div>
            <div className="space-y-1">
              <Label>Schweregrad</Label>
              <Select
                value={editForm.incident_severity}
                onValueChange={(v) =>
                  setEditForm((f) => ({
                    ...f,
                    incident_severity: v as IncidentSeverity,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="important">Wichtig</SelectItem>
                  <SelectItem value="urgent">Dringend</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Abhol-Notizen</Label>
              <Input
                value={editForm.pickup_notes}
                onChange={(e) =>
                  setEditForm((f) => ({
                    ...f,
                    pickup_notes: e.target.value,
                  }))
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleEditSave}
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? "Speichern..." : "Speichern"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Delete Confirm ────────────────────────────────────────── */}
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Protokoll löschen"
        description="Möchten Sie dieses Tagesprotokoll wirklich löschen?"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
        variant="destructive"
      />
    </div>
  );
}
