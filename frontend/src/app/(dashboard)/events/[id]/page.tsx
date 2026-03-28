"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  useEvent,
  useUpdateEvent,
  useEventParticipants,
  useEventStats,
  useEventTransactions,
} from "@/hooks/use-events";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Pencil,
  Save,
  X,
  Users,
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  UserPlus,
  FileText,
} from "lucide-react";
import {
  EVENT_TYPE_LABELS,
  EVENT_STATUS_LABELS,
  CONSENT_STATUS_LABELS,
  type EventType,
  type EventStatus,
  type ConsentStatus,
} from "@/types/models";
import { useToast } from "@/components/ui/toast";
import { downloadExport } from "@/lib/export";

const CONSENT_COLORS: Record<string, string> = {
  pending: "bg-yellow-500",
  granted: "bg-green-500",
  denied: "bg-red-500",
  not_required: "bg-gray-500",
};

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const eventId = Number(params.id);

  const { event, loading, refetch } = useEvent(eventId);
  const { updateEvent, loading: updating } = useUpdateEvent();
  const { participants, refetch: refetchParticipants, updateConsent } = useEventParticipants(eventId);
  const { stats, refetch: refetchStats } = useEventStats(eventId);

  const [isEditing, setIsEditing] = useState(searchParams.get("edit") === "true");
  const [editForm, setEditForm] = useState({
    title: "",
    description: "",
    event_type: "excursion" as EventType,
    status: "draft" as EventStatus,
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    venue: "",
    meeting_point: "",
    notes: "",
    estimated_cost: "",
  });

  const [consentDialog, setConsentDialog] = useState<{
    participantId: number;
    studentName: string;
    status: ConsentStatus;
    givenBy: string;
    notes: string;
  } | null>(null);

  // Initialize edit form from event data
  useEffect(() => {
    if (event) {
      setEditForm({
        title: event.title,
        description: event.description || "",
        event_type: event.event_type,
        status: event.status,
        start_date: event.start_date,
        end_date: event.end_date || "",
        start_time: event.start_time || "",
        end_time: event.end_time || "",
        venue: event.venue || "",
        meeting_point: event.meeting_point || "",
        notes: event.notes || "",
        estimated_cost: event.estimated_cost || "",
      });
    }
  }, [event]);

  const handleSave = async () => {
    const result = await updateEvent(eventId, {
      title: editForm.title,
      description: editForm.description,
      event_type: editForm.event_type,
      status: editForm.status,
      start_date: editForm.start_date,
      end_date: editForm.end_date || undefined,
      start_time: editForm.start_time || undefined,
      end_time: editForm.end_time || undefined,
      venue: editForm.venue,
      meeting_point: editForm.meeting_point,
      notes: editForm.notes,
      estimated_cost: editForm.estimated_cost ? Number(editForm.estimated_cost) : undefined,
    });
    if (result) {
      toast({ type: "success", title: "Veranstaltung aktualisiert" });
      setIsEditing(false);
      refetch();
    }
  };

  const handleConsentUpdate = async () => {
    if (!consentDialog) return;
    await updateConsent([
      {
        id: consentDialog.participantId,
        consent_status: consentDialog.status,
        consent_given_by: consentDialog.givenBy,
        consent_notes: consentDialog.notes,
      },
    ]);
    toast({ type: "success", title: "Bestätigung aktualisiert" });
    setConsentDialog(null);
    refetchStats();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Laden...</p>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Veranstaltung nicht gefunden</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push("/events")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            {isEditing ? (
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="text-2xl font-bold h-auto py-1"
              />
            ) : (
              <h1 className="text-2xl font-bold text-foreground">{event.title}</h1>
            )}
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="secondary">
                {EVENT_TYPE_LABELS[event.event_type as EventType]}
              </Badge>
              <Badge
                variant="secondary"
                className={`${
                  event.status === "confirmed" ? "bg-green-500" :
                  event.status === "cancelled" ? "bg-red-500" :
                  event.status === "completed" ? "bg-emerald-700" : "bg-blue-500"
                } text-white`}
              >
                {EVENT_STATUS_LABELS[event.status as EventStatus]}
              </Badge>
              {event.location_name && (
                <span className="text-sm text-muted-foreground">{event.location_name}</span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button variant="outline" onClick={() => setIsEditing(false)}>
                <X className="mr-2 h-4 w-4" />
                Abbrechen
              </Button>
              <Button onClick={handleSave} disabled={updating}>
                <Save className="mr-2 h-4 w-4" />
                Speichern
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => downloadExport({ basePath: `/events/${eventId}`, format: "pdf" })}
              >
                <FileText className="mr-2 h-4 w-4" />
                PDF
              </Button>
              <Button onClick={() => setIsEditing(true)}>
                <Pencil className="mr-2 h-4 w-4" />
                Bearbeiten
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Users className="h-8 w-8 text-blue-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.total_participants}</p>
                  <p className="text-xs text-muted-foreground">Teilnehmer</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.consent_granted}</p>
                  <p className="text-xs text-muted-foreground">Bestätigungen</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold">{stats.consent_pending}</p>
                  <p className="text-xs text-muted-foreground">Ausstehend</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <DollarSign className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {stats.total_cost ? `€${stats.total_cost}` : "–"}
                  </p>
                  <p className="text-xs text-muted-foreground">Kosten</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs defaultValue="details">
        <TabsList>
          <TabsTrigger value="details">Details</TabsTrigger>
          <TabsTrigger value="participants">
            Teilnehmer ({participants.length})
          </TabsTrigger>
          <TabsTrigger value="transactions">Transaktionen</TabsTrigger>
        </TabsList>

        {/* Details Tab */}
        <TabsContent value="details" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Veranstaltungsdetails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Typ</Label>
                      <Select
                        value={editForm.event_type}
                        onValueChange={(v) => setEditForm({ ...editForm, event_type: v as EventType })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Status</Label>
                      <Select
                        value={editForm.status}
                        onValueChange={(v) => setEditForm({ ...editForm, status: v as EventStatus })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(EVENT_STATUS_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>{label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Beschreibung</Label>
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Startdatum</Label>
                      <Input
                        type="date"
                        value={editForm.start_date}
                        onChange={(e) => setEditForm({ ...editForm, start_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Enddatum</Label>
                      <Input
                        type="date"
                        value={editForm.end_date}
                        onChange={(e) => setEditForm({ ...editForm, end_date: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Startzeit</Label>
                      <Input
                        type="time"
                        value={editForm.start_time}
                        onChange={(e) => setEditForm({ ...editForm, start_time: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Endzeit</Label>
                      <Input
                        type="time"
                        value={editForm.end_time}
                        onChange={(e) => setEditForm({ ...editForm, end_time: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Veranstaltungsort</Label>
                      <Input
                        value={editForm.venue}
                        onChange={(e) => setEditForm({ ...editForm, venue: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Treffpunkt</Label>
                      <Input
                        value={editForm.meeting_point}
                        onChange={(e) => setEditForm({ ...editForm, meeting_point: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Geschätzte Kosten (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editForm.estimated_cost}
                      onChange={(e) => setEditForm({ ...editForm, estimated_cost: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Notizen</Label>
                    <Textarea
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                      rows={3}
                    />
                  </div>
                </>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Beschreibung</p>
                      <p className="text-sm">{event.description || "–"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Datum</p>
                      <p className="text-sm">
                        {new Date(event.start_date).toLocaleDateString("de-AT")}
                        {event.end_date && ` – ${new Date(event.end_date).toLocaleDateString("de-AT")}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Zeit</p>
                      <p className="text-sm">
                        {event.start_time || "–"} {event.end_time && `– ${event.end_time}`}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Gruppen</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {event.group_names?.map((name, i) => (
                          <Badge key={i} variant="outline">{name}</Badge>
                        )) || <span className="text-sm">–</span>}
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground">Veranstaltungsort</p>
                      <p className="text-sm">{event.venue || "–"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Treffpunkt</p>
                      <p className="text-sm">{event.meeting_point || "–"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Geschätzte Kosten</p>
                      <p className="text-sm">
                        {event.estimated_cost ? `€ ${event.estimated_cost}` : "–"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Erstellt von</p>
                      <p className="text-sm">{event.created_by_name || "–"}</p>
                    </div>
                    {event.notes && (
                      <div>
                        <p className="text-sm text-muted-foreground">Notizen</p>
                        <p className="text-sm">{event.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Participants Tab */}
        <TabsContent value="participants" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Teilnehmer</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Schüler:in</TableHead>
                    <TableHead>Gruppe</TableHead>
                    <TableHead>Bestätigung</TableHead>
                    <TableHead>Bestätigt von</TableHead>
                    <TableHead>Bestätigungsdatum</TableHead>
                    <TableHead>Anwesenheit</TableHead>
                    <TableHead className="w-[80px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {participants.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        Noch keine Teilnehmer hinzugefügt
                      </TableCell>
                    </TableRow>
                  ) : (
                    participants.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">{p.student_name}</TableCell>
                        <TableCell>{p.student_group_name || "–"}</TableCell>
                        <TableCell>
                          <Badge
                            variant="secondary"
                            className={`${CONSENT_COLORS[p.consent_status] || "bg-gray-500"} text-white`}
                          >
                            {CONSENT_STATUS_LABELS[p.consent_status as ConsentStatus]}
                          </Badge>
                        </TableCell>
                        <TableCell>{p.consent_given_by || "–"}</TableCell>
                        <TableCell>
                          {p.consent_date
                            ? new Date(p.consent_date).toLocaleDateString("de-AT")
                            : "–"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{p.attendance_status}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setConsentDialog({
                                participantId: p.id,
                                studentName: p.student_name,
                                status: p.consent_status as ConsentStatus,
                                givenBy: p.consent_given_by || "",
                                notes: p.consent_notes || "",
                              })
                            }
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Verknüpfte Transaktionen</CardTitle>
            </CardHeader>
            <CardContent>
              {event.transactions && event.transactions.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Typ</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {event.transactions.map((t) => (
                      <TableRow key={t.id}>
                        <TableCell>
                          {new Date(t.transaction_date).toLocaleDateString("de-AT")}
                        </TableCell>
                        <TableCell>{t.description}</TableCell>
                        <TableCell>
                          <Badge variant={t.transaction_type === "income" ? "default" : "destructive"}>
                            {t.transaction_type === "income" ? "Einnahme" : "Ausgabe"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          € {Number(t.amount).toFixed(2)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-center py-8 text-muted-foreground">
                  Keine Transaktionen verknüpft
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Consent Dialog */}
      <Dialog open={!!consentDialog} onOpenChange={() => setConsentDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elternbestätigung: {consentDialog?.studentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={consentDialog?.status || "pending"}
                onValueChange={(v) =>
                  consentDialog && setConsentDialog({ ...consentDialog, status: v as ConsentStatus })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CONSENT_STATUS_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Bestätigt von</Label>
              <Input
                value={consentDialog?.givenBy || ""}
                onChange={(e) =>
                  consentDialog && setConsentDialog({ ...consentDialog, givenBy: e.target.value })
                }
                placeholder="Name des Erziehungsberechtigten"
              />
            </div>
            <div className="space-y-2">
              <Label>Notizen</Label>
              <Textarea
                value={consentDialog?.notes || ""}
                onChange={(e) =>
                  consentDialog && setConsentDialog({ ...consentDialog, notes: e.target.value })
                }
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConsentDialog(null)}>
              Abbrechen
            </Button>
            <Button onClick={handleConsentUpdate}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
