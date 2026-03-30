/** API base path */
export const API_BASE = "/api/v1";

/** Pagination defaults */
export const DEFAULT_PAGE_SIZE = 20;
export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Date format for display */
export const DATE_FORMAT = "dd.MM.yyyy";
export const DATETIME_FORMAT = "dd.MM.yyyy HH:mm";
export const TIME_FORMAT = "HH:mm";

/** Currency */
export const CURRENCY = "EUR";
export const LOCALE = "de-AT";

/** Role labels */
export const ROLE_LABELS: Record<string, string> = {
  educator: "Pädagog:in",
  location_manager: "Standortleitung",
  sub_admin: "Sub-Admin",
  admin: "Admin",
  super_admin: "Super Admin",
};

/** Status labels */
export const STATUS_LABELS: Record<string, string> = {
  pending: "Ausstehend",
  approved: "Genehmigt",
  rejected: "Abgelehnt",
  cancelled: "Storniert",
  draft: "Entwurf",
};

/** Transaction type labels */
export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  income: "Einnahme",
  expense: "Ausgabe",
};
