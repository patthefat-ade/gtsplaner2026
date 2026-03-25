"use client";

import { useSystemSettings, useUpdateSystemSetting } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Settings, Save } from "lucide-react";
import { useState, useMemo, useCallback } from "react";

export default function SettingsPage() {
  const toast = useToast();
  const { data, isLoading, error, refetch } = useSystemSettings();
  const updateMutation = useUpdateSystemSetting();
  const [localEdits, setLocalEdits] = useState<Record<number, string>>({});

  // Berechne die angezeigten Werte: lokale Edits haben Vorrang vor Server-Daten
  const displayValues = useMemo(() => {
    const values: Record<number, string> = {};
    if (data?.results) {
      data.results.forEach((s) => {
        values[s.id] = s.id in localEdits ? localEdits[s.id] : s.value;
      });
    }
    return values;
  }, [data, localEdits]);

  const handleEdit = useCallback((id: number, value: string) => {
    setLocalEdits((prev) => ({ ...prev, [id]: value }));
  }, []);

  const handleSave = (id: number, key: string) => {
    updateMutation.mutate(
      { id, value: displayValues[id] },
      {
        onSuccess: () => {
          toast.success(`"${key}" gespeichert`);
          // Lokalen Edit entfernen, da Server-Daten jetzt aktuell sind
          setLocalEdits((prev) => {
            const next = { ...prev };
            delete next[id];
            return next;
          });
        },
        onError: () => toast.error("Fehler", "Einstellung konnte nicht gespeichert werden."),
      }
    );
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={4} columns={2} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Systemeinstellungen"
        description="Globale Konfiguration der Anwendung."
      />

      {data?.results && data.results.length > 0 ? (
        <div className="grid gap-4">
          {data.results.map((setting) => (
            <Card key={setting.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  {setting.key}
                </CardTitle>
                {setting.description && (
                  <p className="text-sm text-muted-foreground">
                    {setting.description}
                  </p>
                )}
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="flex-1 space-y-2">
                    <Label htmlFor={`setting-${setting.id}`}>Wert</Label>
                    {setting.value === "true" || setting.value === "false" ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`setting-${setting.id}`}
                          checked={displayValues[setting.id] === "true"}
                          onCheckedChange={(checked) =>
                            handleEdit(setting.id, checked ? "true" : "false")
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {displayValues[setting.id] === "true"
                            ? "Aktiviert"
                            : "Deaktiviert"}
                        </span>
                      </div>
                    ) : (
                      <Input
                        id={`setting-${setting.id}`}
                        value={displayValues[setting.id] || ""}
                        onChange={(e) =>
                          handleEdit(setting.id, e.target.value)
                        }
                      />
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSave(setting.id, setting.key)}
                    disabled={
                      updateMutation.isPending ||
                      displayValues[setting.id] === setting.value
                    }
                  >
                    <Save className="mr-2 h-4 w-4" />
                    Speichern
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Settings}
          title="Keine Einstellungen"
          description="Es sind noch keine Systemeinstellungen konfiguriert."
        />
      )}
    </div>
  );
}
