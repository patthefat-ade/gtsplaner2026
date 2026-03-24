import type { UseFormSetError, FieldValues, Path } from "react-hook-form";

/**
 * Setzt server-seitige Validierungsfehler in ein React Hook Form.
 * Unterstützt sowohl DRF-Fehlerformat (Feld -> Array von Fehlern)
 * als auch generische Fehler (non_field_errors, detail).
 */
export function setServerErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
): string | null {
  if (!error || typeof error !== "object" || !("response" in error)) {
    return "Ein unbekannter Fehler ist aufgetreten.";
  }

  const apiError = error as {
    response?: {
      status?: number;
      data?: Record<string, string | string[]>;
    };
  };

  const data = apiError.response?.data;
  const status = apiError.response?.status;

  if (!data) {
    if (status === 401) return "Nicht autorisiert. Bitte erneut anmelden.";
    if (status === 403) return "Keine Berechtigung für diese Aktion.";
    if (status === 404) return "Ressource nicht gefunden.";
    if (status && status >= 500) return "Serverfehler. Bitte später erneut versuchen.";
    return "Ein Fehler ist aufgetreten.";
  }

  let generalError: string | null = null;

  Object.entries(data).forEach(([key, messages]) => {
    const messageStr = Array.isArray(messages) ? messages[0] : String(messages);

    if (key === "non_field_errors" || key === "detail") {
      generalError = messageStr;
    } else {
      setError(key as Path<T>, {
        type: "server",
        message: messageStr,
      });
    }
  });

  return generalError;
}

/**
 * Formatiert einen API-Fehler als benutzerfreundliche Nachricht.
 */
export function getErrorMessage(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "Ein unbekannter Fehler ist aufgetreten.";
  }

  if ("response" in error) {
    const apiError = error as {
      response?: {
        status?: number;
        data?: { detail?: string; non_field_errors?: string[] };
      };
    };

    const data = apiError.response?.data;
    if (data?.detail) return data.detail;
    if (data?.non_field_errors) return data.non_field_errors[0];

    const status = apiError.response?.status;
    if (status === 400) return "Ungültige Eingabe. Bitte Daten prüfen.";
    if (status === 401) return "Nicht autorisiert. Bitte erneut anmelden.";
    if (status === 403) return "Keine Berechtigung für diese Aktion.";
    if (status === 404) return "Ressource nicht gefunden.";
    if (status === 409) return "Konflikt. Der Eintrag existiert bereits.";
    if (status && status >= 500) return "Serverfehler. Bitte später erneut versuchen.";
  }

  if ("message" in error) {
    return String((error as { message: string }).message);
  }

  return "Ein unbekannter Fehler ist aufgetreten.";
}

/**
 * Toast-kompatible Erfolgsmeldung.
 */
export function getSuccessMessage(
  action: "create" | "update" | "delete" | "approve" | "reject" | "cancel" | "upload",
  entity: string,
): string {
  const messages: Record<string, string> = {
    create: `${entity} wurde erfolgreich erstellt.`,
    update: `${entity} wurde erfolgreich aktualisiert.`,
    delete: `${entity} wurde erfolgreich gelöscht.`,
    approve: `${entity} wurde genehmigt.`,
    reject: `${entity} wurde abgelehnt.`,
    cancel: `${entity} wurde storniert.`,
    upload: `${entity} wurde erfolgreich hochgeladen.`,
  };
  return messages[action] || `${entity} wurde erfolgreich verarbeitet.`;
}
