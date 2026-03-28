"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useCreateEvent } from "@/hooks/use-events";
import { useLocations } from "@/hooks/use-locations";
import { useGroups } from "@/hooks/use-groups";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save } from "lucide-react";
import { EVENT_TYPE_LABELS, type EventType, type EventCreate } from "@/types/models";
import { useToast } from "@/components/ui/toast";

export default function NewEventPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { createEvent, loading } = useCreateEvent();
  const { data: locationsData } = useLocations({});
  const { data: groupsData } = useGroups({});

  const [form, setForm] = useState<EventCreate>({
    title: "",
    description: "",
    event_type: "excursion",
    status: "draft",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    venue: "",
    meeting_point: "",
    requires_consent: true,
    consent_deadline: "",
    estimated_cost: undefined,
    max_participants: undefined,
    notes: "",
    location: 0,
    school_year: undefined,
    groups: [],
  });

  const [selectedGroups, setSelectedGroups] = useState<number[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.start_date || !form.location) {
      toast({ type: "error", title: "Bitte füllen Sie alle Pflichtfelder aus." });
      return;
    }
    const result = await createEvent({
      ...form,
      groups: selectedGroups,
    });
    if (result) {
      toast({ type: "success", title: "Veranstaltung erfolgreich erstellt" });
      router.push(`/events/${result.id}`);
    }
  };

  const locations = locationsData?.results || [];
  const groups = groupsData?.results || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Neue Veranstaltung</h1>
          <p className="text-sm text-muted-foreground">
            Ausflug, Feier oder Veranstaltung anlegen
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Grunddaten */}
        <Card>
          <CardHeader>
            <CardTitle>Grunddaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="title">Titel *</Label>
                <Input
                  id="title"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="z.B. Ausflug zum Wörthersee"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event_type">Typ *</Label>
                <Select
                  value={form.event_type}
                  onValueChange={(v) => setForm({ ...form, event_type: v as EventType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EVENT_TYPE_LABELS).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Beschreibung</Label>
              <Textarea
                id="description"
                value={form.description || ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="Beschreibung der Veranstaltung..."
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="location">Standort *</Label>
                <Select
                  value={form.location ? String(form.location) : ""}
                  onValueChange={(v) => setForm({ ...form, location: Number(v) })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Standort auswählen..." />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((loc) => (
                      <SelectItem key={loc.id} value={String(loc.id)}>
                        {loc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="venue">Veranstaltungsort</Label>
                <Input
                  id="venue"
                  value={form.venue || ""}
                  onChange={(e) => setForm({ ...form, venue: e.target.value })}
                  placeholder="z.B. Wörthersee Strandbad"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Datum & Zeit */}
        <Card>
          <CardHeader>
            <CardTitle>Datum & Zeit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Startdatum *</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Enddatum</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={form.end_date || ""}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="start_time">Startzeit</Label>
                <Input
                  id="start_time"
                  type="time"
                  value={form.start_time || ""}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_time">Endzeit</Label>
                <Input
                  id="end_time"
                  type="time"
                  value={form.end_time || ""}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="meeting_point">Treffpunkt</Label>
              <Input
                id="meeting_point"
                value={form.meeting_point || ""}
                onChange={(e) => setForm({ ...form, meeting_point: e.target.value })}
                placeholder="z.B. Vor der Schule"
              />
            </div>
          </CardContent>
        </Card>

        {/* Gruppen */}
        <Card>
          <CardHeader>
            <CardTitle>Teilnehmende Gruppen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
              {groups.map((group) => (
                <label
                  key={group.id}
                  className={`flex items-center gap-2 rounded-md border p-3 cursor-pointer transition-colors ${
                    selectedGroups.includes(group.id)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted/50"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedGroups.includes(group.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedGroups([...selectedGroups, group.id]);
                      } else {
                        setSelectedGroups(selectedGroups.filter((id) => id !== group.id));
                      }
                    }}
                    className="rounded"
                  />
                  <span className="text-sm">{group.name}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Elternbestätigung & Kosten */}
        <Card>
          <CardHeader>
            <CardTitle>Elternbestätigung & Kosten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Switch
                id="requires_consent"
                checked={form.requires_consent}
                onCheckedChange={(v) => setForm({ ...form, requires_consent: v })}
              />
              <Label htmlFor="requires_consent">Elternbestätigung erforderlich</Label>
            </div>
            {form.requires_consent && (
              <div className="space-y-2">
                <Label htmlFor="consent_deadline">Frist für Bestätigung</Label>
                <Input
                  id="consent_deadline"
                  type="date"
                  value={form.consent_deadline || ""}
                  onChange={(e) => setForm({ ...form, consent_deadline: e.target.value })}
                />
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="estimated_cost">Geschätzte Kosten (€)</Label>
                <Input
                  id="estimated_cost"
                  type="number"
                  step="0.01"
                  value={form.estimated_cost || ""}
                  onChange={(e) =>
                    setForm({ ...form, estimated_cost: e.target.value ? Number(e.target.value) : undefined })
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max_participants">Max. Teilnehmer</Label>
                <Input
                  id="max_participants"
                  type="number"
                  value={form.max_participants || ""}
                  onChange={(e) =>
                    setForm({ ...form, max_participants: e.target.value ? Number(e.target.value) : undefined })
                  }
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Notizen */}
        <Card>
          <CardHeader>
            <CardTitle>Notizen</CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.notes || ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Zusätzliche Notizen..."
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Abbrechen
          </Button>
          <Button type="submit" disabled={loading}>
            <Save className="mr-2 h-4 w-4" />
            {loading ? "Speichern..." : "Veranstaltung erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
