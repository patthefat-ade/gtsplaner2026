"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { useCreateWeeklyPlan } from "@/hooks/use-weeklyplans";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";

export default function NewWeeklyPlanPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isTemplate = searchParams.get("template") === "true";

  const createMutation = useCreateWeeklyPlan();

  // Form state
  const [title, setTitle] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [notes, setNotes] = useState("");
  const [groupId, setGroupId] = useState("");
  const [weekStartDate, setWeekStartDate] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split("T")[0];
  });
  const [asTemplate, setAsTemplate] = useState(isTemplate);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupId || !title) return;

    const result = await createMutation.mutateAsync({
      group: Number(groupId),
      week_start_date: weekStartDate,
      title,
      notes: notes || undefined,
      status: "draft",
      is_template: asTemplate,
      template_name: asTemplate ? templateName || title : undefined,
    });

    // Navigate to the new plan's editor
    router.push(`/weeklyplans/${result.id}?edit=true`);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
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
              : "Erstellen Sie einen neuen Wochenplan für eine Gruppe"}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Grunddaten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Titel *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="z.B. Wochenplan KW 14"
                required
              />
            </div>

            <div>
              <Label htmlFor="group">Gruppen-ID *</Label>
              <Input
                id="group"
                type="number"
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                placeholder="Gruppen-ID eingeben"
                required
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Die Gruppen-ID finden Sie in der Gruppenübersicht
              </p>
            </div>

            {!asTemplate && (
              <div>
                <Label htmlFor="weekStart">Wochenbeginn (Montag) *</Label>
                <Input
                  id="weekStart"
                  type="date"
                  value={weekStartDate}
                  onChange={(e) => setWeekStartDate(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <Label htmlFor="notes">Notizen</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optionale Notizen zum Wochenplan..."
                rows={3}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="template"
                checked={asTemplate}
                onCheckedChange={setAsTemplate}
              />
              <Label htmlFor="template">Als Vorlage speichern</Label>
            </div>

            {asTemplate && (
              <div>
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

        <div className="mt-6 flex justify-end gap-3">
          <Button variant="outline" asChild>
            <Link href="/weeklyplans">Abbrechen</Link>
          </Button>
          <Button type="submit" disabled={createMutation.isPending || !title || !groupId}>
            <Save className="mr-2 h-4 w-4" />
            {createMutation.isPending
              ? "Erstellen..."
              : asTemplate
                ? "Vorlage erstellen"
                : "Wochenplan erstellen"}
          </Button>
        </div>
      </form>
    </div>
  );
}
