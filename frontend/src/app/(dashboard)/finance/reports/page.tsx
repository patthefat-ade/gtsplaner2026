"use client";

import { PageHeader } from "@/components/common/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

export default function FinanceReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Finanzberichte"
        description="Übersicht über Einnahmen, Ausgaben und Kontostände."
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Einnahmen vs. Ausgaben
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Diagramm wird in Sprint 7 implementiert.
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <BarChart3 className="h-4 w-4" />
              Kontostände nach Gruppe
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Diagramm wird in Sprint 7 implementiert.
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
