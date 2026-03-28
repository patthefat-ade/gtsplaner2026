"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { downloadExport, type ExportFormat } from "@/lib/export";
import { useToast } from "@/components/ui/toast";

interface ExportButtonsProps {
  /** API-Basispfad, z.B. "/groups/students" */
  basePath: string;
  /** Aktuelle Filter-Parameter */
  params?: Record<string, string | number | boolean | undefined>;
  /** Welche Formate angeboten werden sollen */
  formats?: ExportFormat[];
  /** Button-Variante */
  variant?: "default" | "outline" | "ghost" | "secondary";
  /** Button-Groesse */
  size?: "default" | "sm" | "lg" | "icon";
}

export function ExportButtons({
  basePath,
  params = {},
  formats = ["xlsx", "pdf"],
  variant = "outline",
  size = "sm",
}: ExportButtonsProps) {
  const toast = useToast();
  const [loading, setLoading] = useState<ExportFormat | null>(null);

  const handleExport = async (format: ExportFormat) => {
    setLoading(format);
    try {
      await downloadExport({ basePath, format, params });
      toast.success(
        `${format.toUpperCase()}-Export erfolgreich heruntergeladen`
      );
    } catch {
      toast.error(
        "Export fehlgeschlagen",
        `Der ${format.toUpperCase()}-Export konnte nicht erstellt werden.`
      );
    } finally {
      setLoading(null);
    }
  };

  // Single format: show direct button
  if (formats.length === 1) {
    const format = formats[0];
    const Icon = format === "xlsx" ? FileSpreadsheet : FileText;
    return (
      <Button
        variant={variant}
        size={size}
        onClick={() => handleExport(format)}
        disabled={!!loading}
      >
        {loading === format ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Icon className="mr-2 h-4 w-4" />
        )}
        {format.toUpperCase()} Export
      </Button>
    );
  }

  // Multiple formats: show dropdown
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} disabled={!!loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {formats.includes("xlsx") && (
          <DropdownMenuItem
            onClick={() => handleExport("xlsx")}
            disabled={loading === "xlsx"}
          >
            <FileSpreadsheet className="mr-2 h-4 w-4" />
            Als XLSX exportieren
          </DropdownMenuItem>
        )}
        {formats.includes("pdf") && (
          <DropdownMenuItem
            onClick={() => handleExport("pdf")}
            disabled={loading === "pdf"}
          >
            <FileText className="mr-2 h-4 w-4" />
            Als PDF exportieren
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
