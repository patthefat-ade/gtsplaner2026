"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useWeeklyPlanTemplates,
  useDeleteWeeklyPlan,
  useCreateFromTemplate,
} from "@/hooks/use-weeklyplans";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  BookTemplate,
  Plus,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  CalendarPlus,
  CalendarDays,
} from "lucide-react";
import type { WeeklyPlan } from "@/types/models";

export default function WeeklyPlanTemplatesPage() {
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_weeklyplans");

  const { data: templates, isLoading } = useWeeklyPlanTemplates();
  const toast = useToast();
  const deleteMutation = useDeleteWeeklyPlan();
  const createFromTemplate = useCreateFromTemplate();

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<WeeklyPlan | null>(null);

  // Create from template dialog
  const [createDialog, setCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<WeeklyPlan | null>(null);
  const [newPlanGroup, setNewPlanGroup] = useState("");
  const [newPlanDate, setNewPlanDate] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday.toISOString().split("T")[0];
  });
  const [newPlanTitle, setNewPlanTitle] = useState("");

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      toast.success("Vorlage erfolgreich gelöscht");
    } catch {
      toast.error("Fehler", "Vorlage konnte nicht gelöscht werden.");
    }
    setDeleteTarget(null);
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await createFromTemplate.mutateAsync({
        templateId: selectedTemplate.id,
        data: {
          group: selectedTemplate.group,
          week_start_date: newPlanDate,
          title: newPlanTitle || `Wochenplan aus Vorlage`,
        },
      });
      toast.success("Wochenplan aus Vorlage erstellt");
      setCreateDialog(false);
      setSelectedTemplate(null);
    } catch {
      toast.error("Fehler", "Wochenplan konnte nicht erstellt werden.");
    }
  };

  const openCreateDialog = (template: WeeklyPlan) => {
    setSelectedTemplate(template);
    setNewPlanTitle(`Wochenplan aus "${template.template_name}"`);
    setCreateDialog(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Vorlagen"
        description="Wiederverwendbare Wochenplan-Vorlagen verwalten"
      >
        {canManage && (
          <Button asChild>
            <Link href="/weeklyplans/new?template=true">
              <Plus className="mr-2 h-4 w-4" />
              Neue Vorlage
            </Link>
          </Button>
        )}
      </PageHeader>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="mt-2 h-4 w-32" />
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-24" />
                  <Skeleton className="h-6 w-16" />
                </div>
                <Skeleton className="mt-3 h-3 w-40" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : !templates || templates.length === 0 ? (
        <Card>
          <CardContent className="flex h-48 flex-col items-center justify-center gap-4">
            <BookTemplate className="h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Noch keine Vorlagen vorhanden</p>
            {canManage && (
              <Button asChild variant="outline">
                <Link href="/weeklyplans/new?template=true">
                  <Plus className="mr-2 h-4 w-4" />
                  Erste Vorlage erstellen
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {templates.map((template) => (
            <Card key={template.id} className="relative">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {template.template_name || template.title}
                    </CardTitle>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {template.group_name} · {template.location_name}
                    </p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link href={`/weeklyplans/${template.id}`}>
                          <Eye className="mr-2 h-4 w-4" />
                          Ansehen
                        </Link>
                      </DropdownMenuItem>
                      {canManage && (
                        <>
                          <DropdownMenuItem asChild>
                            <Link href={`/weeklyplans/${template.id}?edit=true`}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bearbeiten
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => setDeleteTarget(template)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      <CalendarDays className="mr-1 h-3 w-3" />
                      {template.entry_count ?? 0} Einträge
                    </Badge>
                    <Badge variant="secondary">Vorlage</Badge>
                  </div>
                  {canManage && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openCreateDialog(template)}
                    >
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Anwenden
                    </Button>
                  )}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Erstellt von {template.created_by_name}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create from Template Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Wochenplan aus Vorlage erstellen</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Erstellen Sie einen neuen Wochenplan basierend auf der Vorlage
              &quot;{selectedTemplate?.template_name}&quot;.
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium">Titel</label>
              <Input
                value={newPlanTitle}
                onChange={(e) => setNewPlanTitle(e.target.value)}
                placeholder="Titel des neuen Wochenplans"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">
                Wochenbeginn (Montag)
              </label>
              <Input
                type="date"
                value={newPlanDate}
                onChange={(e) => setNewPlanDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCreateFromTemplate}
              disabled={createFromTemplate.isPending}
            >
              {createFromTemplate.isPending ? "Erstellen..." : "Wochenplan erstellen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Vorlage löschen?</AlertDialogTitle>
            <AlertDialogDescription>
              Möchten Sie die Vorlage &quot;{deleteTarget?.template_name}&quot; wirklich
              löschen? Bestehende Wochenpläne, die auf dieser Vorlage basieren, bleiben
              erhalten.
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
