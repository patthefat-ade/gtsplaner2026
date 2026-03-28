/**
 * Generische Export-Funktionen fuer XLSX und PDF Downloads.
 *
 * Nutzt die ExportMixin-Endpunkte des Backends:
 *   GET /api/v1/<resource>/export-xlsx/?<filter_params>
 *   GET /api/v1/<resource>/export-pdf/?<filter_params>
 */

import { api } from "@/lib/api";

export type ExportFormat = "xlsx" | "pdf";

interface ExportOptions {
  /** API-Basispfad, z.B. "/groups/students" */
  basePath: string;
  /** Export-Format */
  format: ExportFormat;
  /** Optionale Filter-Parameter */
  params?: Record<string, string | number | boolean | undefined>;
  /** Optionaler Dateiname (ohne Erweiterung) */
  filename?: string;
}

/**
 * Laedt eine Export-Datei (XLSX oder PDF) vom Backend herunter
 * und triggert den Browser-Download.
 */
export async function downloadExport({
  basePath,
  format,
  params = {},
  filename,
}: ExportOptions): Promise<void> {
  // Build query string from params
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const qs = searchParams.toString();
  const url = `${basePath}/export-${format}/${qs ? `?${qs}` : ""}`;

  const contentType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";

  const response = await api.get(url, {
    responseType: "blob",
  });

  const blob = new Blob([response.data], { type: contentType });
  const blobUrl = window.URL.createObjectURL(blob);

  // Extract filename from Content-Disposition header or use provided/default
  let downloadFilename = filename
    ? `${filename}.${format}`
    : `export.${format}`;

  const disposition = response.headers["content-disposition"];
  if (disposition) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match?.[1]) {
      downloadFilename = match[1];
    }
  }

  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = downloadFilename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
