/**
 * Generische Export-Funktionen fuer XLSX und PDF Downloads.
 *
 * Downloads werden ueber fetch() mit credentials: "include" durchgefuehrt,
 * sodass die httpOnly JWT-Cookies automatisch mitgesendet werden.
 *
 * Fuer Endpunkte, die ueber window.open() aufgerufen werden muessen
 * (z.B. direkte PDF-Ansicht), wird der QueryParameterJWTAuthentication
 * Fallback im Backend verwendet. Da die Cookies bei same-origin window.open()
 * automatisch mitgesendet werden, funktioniert auch das ohne Token-Parameter.
 *
 * Backend-Endpunkte:
 *   GET /api/v1/<resource>/export-xlsx/
 *   GET /api/v1/<resource>/export-pdf/
 */

export type ExportFormat = "xlsx" | "pdf" | "csv";

interface ExportOptions {
  /** API-Basispfad, z.B. "/groups/students" */
  basePath: string;
  /** Export-Format */
  format: ExportFormat;
  /** Optionale Filter-Parameter */
  params?: Record<string, string | number | boolean | undefined>;
}

/**
 * Download eine Export-Datei ueber fetch() mit Cookie-Authentifizierung.
 * Erstellt einen temporaeren Blob-Download-Link.
 */
export async function downloadExport({
  basePath,
  format,
  params = {},
}: ExportOptions): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  // Build query string from params (without token)
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const url = `${apiBase}${basePath}/export-${format}/${queryString ? `?${queryString}` : ""}`;

  // Fetch with credentials to include httpOnly cookies
  const response = await fetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Export fehlgeschlagen: ${response.status} ${response.statusText}`);
  }

  // Extract filename from Content-Disposition header or generate default
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = `export.${format}`;
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      filename = match[1].replace(/['"]/g, "");
    }
  }

  // Create blob download
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}

/**
 * Download eine einzelne Ressource ueber fetch() mit Cookie-Authentifizierung.
 * Fuer Detail-Exporte wie z.B. einzelne Wochenplan-PDFs.
 *
 * @param url - Relativer API-Pfad, z.B. "/weeklyplans/123/pdf/"
 */
export async function downloadDirectUrl(url: string): Promise<void> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  const fullUrl = `${apiBase}${url}`;

  // Fetch with credentials to include httpOnly cookies
  const response = await fetch(fullUrl, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    throw new Error(`Download fehlgeschlagen: ${response.status} ${response.statusText}`);
  }

  // Extract filename from Content-Disposition header
  const contentDisposition = response.headers.get("Content-Disposition");
  let filename = "download";
  if (contentDisposition) {
    const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
    if (match?.[1]) {
      filename = match[1].replace(/['"]/g, "");
    }
  }

  // Create blob download
  const blob = await response.blob();
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = blobUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(blobUrl);
}
