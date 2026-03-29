/**
 * Generische Export-Funktionen fuer XLSX und PDF Downloads.
 *
 * Nutzt direkte URL-Navigation (window.open) statt Blob-Downloads,
 * damit der Browser den Download nativ handhabt.
 * Der JWT-Token wird als Query-Parameter uebergeben, da der Browser
 * bei window.open() keine Authorization-Header senden kann.
 *
 * Backend-Endpunkte:
 *   GET /api/v1/<resource>/export-xlsx/?token=<jwt>&<filter_params>
 *   GET /api/v1/<resource>/export-pdf/?token=<jwt>&<filter_params>
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
 * Oeffnet eine Export-URL direkt im Browser.
 * Der JWT-Token wird als Query-Parameter angehaengt,
 * sodass der Browser den Download nativ handhabt.
 */
export function downloadExport({
  basePath,
  format,
  params = {},
}: ExportOptions): void {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("access_token")
    : null;

  if (!token) {
    throw new Error("Nicht authentifiziert. Bitte erneut anmelden.");
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

  // Build query string from params
  const searchParams = new URLSearchParams();
  searchParams.set("token", token);

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== "all") {
      searchParams.set(key, String(value));
    }
  });

  const url = `${apiBase}${basePath}/export-${format}/?${searchParams.toString()}`;

  // Open in new window - browser handles the download natively
  window.open(url, "_blank");
}

/**
 * Oeffnet eine einzelne Ressourcen-Export-URL direkt im Browser.
 * Fuer Detail-Exporte wie z.B. einzelne Wochenplan-PDFs.
 *
 * @param url - Relativer API-Pfad, z.B. "/weeklyplans/123/pdf/"
 */
export function downloadDirectUrl(url: string): void {
  const token = typeof window !== "undefined"
    ? localStorage.getItem("access_token")
    : null;

  if (!token) {
    throw new Error("Nicht authentifiziert. Bitte erneut anmelden.");
  }

  const apiBase = process.env.NEXT_PUBLIC_API_URL || "/api/v1";
  const separator = url.includes("?") ? "&" : "?";
  const fullUrl = `${apiBase}${url}${separator}token=${token}`;

  // Open in new window - browser handles the download natively
  window.open(fullUrl, "_blank");
}
