"use client";

import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/use-auth";
import {
  useSchoolYears,
  useCreateSchoolYear,
  useUpdateSchoolYear,
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useAutonomousDays,
  useCreateAutonomousDay,
  useDeleteAutonomousDay,
} from "@/hooks/use-groups";
import { useToast } from "@/components/ui/toast";
import { Breadcrumbs } from "@/components/common/breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
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
  School,
  Plus,
  Trash2,
  CalendarDays,
  Sun,
  Pencil,
  Check,
} from "lucide-react";
import type { HolidayPeriod, AutonomousDay } from "@/types/models";

export default function SchoolYearsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const { data: schoolYearsData, isLoading } = useSchoolYears({ page_size: 50 });
  const createSchoolYear = useCreateSchoolYear();
  const updateSchoolYear = useUpdateSchoolYear();

  // Selected school year for detail view
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);

  // New school year dialog
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [newName, setNewName] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");

  // Holiday dialog
  const [showHolidayDialog, setShowHolidayDialog] = useState(false);
  const [holidayName, setHolidayName] = useState("");
  const [holidayStart, setHolidayStart] = useState("");
  const [holidayEnd, setHolidayEnd] = useState("");

  // Autonomous day dialog
  const [showAutonomousDialog, setShowAutonomousDialog] = useState(false);
  const [autonomousName, setAutonomousName] = useState("");
  const [autonomousDate, setAutonomousDate] = useState("");
  const [autonomousDesc, setAutonomousDesc] = useState("");

  // Hooks for selected school year
  const { data: holidaysData } = useHolidays(selectedYearId ?? 0);
  const createHoliday = useCreateHoliday();
  const deleteHoliday = useDeleteHoliday();
  const { data: autonomousDaysData } = useAutonomousDays(selectedYearId ?? 0);
  const createAutonomousDay = useCreateAutonomousDay();
  const deleteAutonomousDay = useDeleteAutonomousDay();

  const selectedYear = useMemo(() => {
    if (!selectedYearId || !schoolYearsData?.results) return null;
    return schoolYearsData.results.find((sy) => sy.id === selectedYearId) ?? null;
  }, [selectedYearId, schoolYearsData]);

  // Auto-select first school year
  useMemo(() => {
    if (!selectedYearId && schoolYearsData?.results?.length) {
      const active = schoolYearsData.results.find((sy) => sy.is_active);
      setSelectedYearId(active?.id ?? schoolYearsData.results[0].id);
    }
  }, [schoolYearsData, selectedYearId]);

  const handleCreateSchoolYear = async () => {
    if (!newName || !newStartDate || !newEndDate) return;
    try {
      await createSchoolYear.mutateAsync({
        name: newName,
        location: user?.location ?? 0,
        start_date: newStartDate,
        end_date: newEndDate,
        is_active: true,
      });
      toast.success("Schuljahr erfolgreich erstellt");
      setShowNewDialog(false);
      setNewName("");
      setNewStartDate("");
      setNewEndDate("");
    } catch {
      toast.error("Fehler", "Schuljahr konnte nicht erstellt werden.");
    }
  };

  const handleToggleActive = async (id: number, currentActive: boolean) => {
    try {
      await updateSchoolYear.mutateAsync({ id, is_active: !currentActive });
      toast.success(currentActive ? "Schuljahr deaktiviert" : "Schuljahr aktiviert");
    } catch {
      toast.error("Fehler", "Status konnte nicht geändert werden.");
    }
  };

  const handleCreateHoliday = async () => {
    if (!selectedYearId || !holidayName || !holidayStart || !holidayEnd) return;
    try {
      await createHoliday.mutateAsync({
        school_year: selectedYearId,
        name: holidayName,
        start_date: holidayStart,
        end_date: holidayEnd,
      });
      toast.success("Ferien erfolgreich hinzugefügt");
      setShowHolidayDialog(false);
      setHolidayName("");
      setHolidayStart("");
      setHolidayEnd("");
    } catch {
      toast.error("Fehler", "Ferien konnten nicht erstellt werden.");
    }
  };

  const handleDeleteHoliday = async (id: number) => {
    try {
      await deleteHoliday.mutateAsync(id);
      toast.success("Ferien entfernt");
    } catch {
      toast.error("Fehler", "Ferien konnten nicht entfernt werden.");
    }
  };

  const handleCreateAutonomousDay = async () => {
    if (!selectedYearId || !autonomousName || !autonomousDate) return;
    try {
      await createAutonomousDay.mutateAsync({
        school_year: selectedYearId,
        name: autonomousName,
        date: autonomousDate,
        description: autonomousDesc,
      });
      toast.success("Autonomer Schultag erfolgreich hinzugefügt");
      setShowAutonomousDialog(false);
      setAutonomousName("");
      setAutonomousDate("");
      setAutonomousDesc("");
    } catch {
      toast.error("Fehler", "Autonomer Schultag konnte nicht erstellt werden.");
    }
  };

  const handleDeleteAutonomousDay = async (id: number) => {
    try {
      await deleteAutonomousDay.mutateAsync(id);
      toast.success("Autonomer Schultag entfernt");
    } catch {
      toast.error("Fehler", "Autonomer Schultag konnte nicht entfernt werden.");
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("de-AT", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Breadcrumbs />
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schuljahre</h1>
          <p className="text-muted-foreground">
            Schuljahre verwalten, Ferien und autonome Schultage zuordnen
          </p>
        </div>
        <Button onClick={() => setShowNewDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Neues Schuljahr
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: School year list */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Alle Schuljahre</h2>
          {schoolYearsData?.results?.map((sy) => (
            <Card
              key={sy.id}
              className={`cursor-pointer transition-colors hover:bg-muted/50 ${
                selectedYearId === sy.id ? "border-primary ring-1 ring-primary" : ""
              }`}
              onClick={() => setSelectedYearId(sy.id)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <School className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold">{sy.name}</span>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {formatDate(sy.start_date)} – {formatDate(sy.end_date)}
                  </div>
                  {sy.location_name && (
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {sy.location_name}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={sy.is_active ? "default" : "secondary"}>
                    {sy.is_active ? "Aktiv" : "Inaktiv"}
                  </Badge>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleActive(sy.id, sy.is_active);
                    }}
                  >
                    {sy.is_active ? (
                      <Check className="h-3.5 w-3.5 text-green-500" />
                    ) : (
                      <Pencil className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          {(!schoolYearsData?.results || schoolYearsData.results.length === 0) && (
            <p className="text-sm text-muted-foreground">
              Noch keine Schuljahre vorhanden.
            </p>
          )}
        </div>

        {/* Right: Detail view */}
        <div className="lg:col-span-2 space-y-6">
          {selectedYear ? (
            <>
              {/* School year info */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <School className="h-5 w-5" />
                    {selectedYear.name}
                    <Badge variant={selectedYear.is_active ? "default" : "secondary"} className="ml-2">
                      {selectedYear.is_active ? "Aktiv" : "Inaktiv"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Beginn:</span>{" "}
                      <strong>{formatDate(selectedYear.start_date)}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Ende:</span>{" "}
                      <strong>{formatDate(selectedYear.end_date)}</strong>
                    </div>
                    {selectedYear.location_name && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground">Standort:</span>{" "}
                        <strong>{selectedYear.location_name}</strong>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Holidays */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <Sun className="h-5 w-5 text-orange-500" />
                      Ferien
                    </span>
                    <Button size="sm" onClick={() => setShowHolidayDialog(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Ferien hinzufügen
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {holidaysData?.results && holidaysData.results.length > 0 ? (
                    <div className="space-y-2">
                      {holidaysData.results.map((h) => (
                        <div
                          key={h.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <div>
                            <div className="font-medium">{h.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(h.start_date)} – {formatDate(h.end_date)}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteHoliday(h.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Noch keine Ferien zugeordnet.
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Autonomous Days */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <CalendarDays className="h-5 w-5 text-blue-500" />
                      Autonome Schultage
                    </span>
                    <Button size="sm" onClick={() => setShowAutonomousDialog(true)}>
                      <Plus className="mr-1 h-4 w-4" />
                      Tag hinzufügen
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {autonomousDaysData?.results && autonomousDaysData.results.length > 0 ? (
                    <div className="space-y-2">
                      {autonomousDaysData.results.map((ad) => (
                        <div
                          key={ad.id}
                          className="flex items-center justify-between rounded-lg border border-border p-3"
                        >
                          <div>
                            <div className="font-medium">{ad.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {formatDate(ad.date)}
                              {ad.description && ` – ${ad.description}`}
                            </div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteAutonomousDay(ad.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Noch keine autonomen Schultage zugeordnet.
                    </p>
                  )}
                </CardContent>
              </Card>
            </>
          ) : (
            <div className="flex h-64 items-center justify-center">
              <p className="text-muted-foreground">
                Wählen Sie ein Schuljahr aus der Liste, um Details anzuzeigen.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* New School Year Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neues Schuljahr erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Name *</Label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="z.B. 2025/2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Beginn *</Label>
                <Input
                  type="date"
                  value={newStartDate}
                  onChange={(e) => setNewStartDate(e.target.value)}
                />
              </div>
              <div>
                <Label>Ende *</Label>
                <Input
                  type="date"
                  value={newEndDate}
                  onChange={(e) => setNewEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateSchoolYear}
              disabled={createSchoolYear.isPending || !newName || !newStartDate || !newEndDate}
            >
              {createSchoolYear.isPending ? "Erstellen..." : "Erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Holiday Dialog */}
      <Dialog open={showHolidayDialog} onOpenChange={setShowHolidayDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ferien hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bezeichnung *</Label>
              <Input
                value={holidayName}
                onChange={(e) => setHolidayName(e.target.value)}
                placeholder="z.B. Weihnachtsferien, Semesterferien..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Von *</Label>
                <Input
                  type="date"
                  value={holidayStart}
                  onChange={(e) => setHolidayStart(e.target.value)}
                />
              </div>
              <div>
                <Label>Bis *</Label>
                <Input
                  type="date"
                  value={holidayEnd}
                  onChange={(e) => setHolidayEnd(e.target.value)}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowHolidayDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateHoliday}
              disabled={createHoliday.isPending || !holidayName || !holidayStart || !holidayEnd}
            >
              {createHoliday.isPending ? "Hinzufügen..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Autonomous Day Dialog */}
      <Dialog open={showAutonomousDialog} onOpenChange={setShowAutonomousDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Autonomen Schultag hinzufügen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Bezeichnung *</Label>
              <Input
                value={autonomousName}
                onChange={(e) => setAutonomousName(e.target.value)}
                placeholder="z.B. Pädagogischer Tag, Konferenztag..."
              />
            </div>
            <div>
              <Label>Datum *</Label>
              <Input
                type="date"
                value={autonomousDate}
                onChange={(e) => setAutonomousDate(e.target.value)}
              />
            </div>
            <div>
              <Label>Beschreibung</Label>
              <Textarea
                value={autonomousDesc}
                onChange={(e) => setAutonomousDesc(e.target.value)}
                placeholder="Optionale Beschreibung..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAutonomousDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateAutonomousDay}
              disabled={createAutonomousDay.isPending || !autonomousName || !autonomousDate}
            >
              {createAutonomousDay.isPending ? "Hinzufügen..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
