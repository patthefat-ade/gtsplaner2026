"use client";

import * as React from "react";
import { AlertCircle, RefreshCw, ShieldOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <Card className="mx-auto mt-8 max-w-lg">
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <div>
              <h3 className="text-lg font-semibold">
                Etwas ist schiefgelaufen
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {this.state.error?.message ||
                  "Ein unerwarteter Fehler ist aufgetreten."}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => this.setState({ hasError: false, error: null })}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

// Hook-based error fallback for query errors
interface QueryErrorProps {
  error: Error | null;
  onRetry?: () => void;
  message?: string;
}

/**
 * Extract HTTP status code from an Axios error object.
 */
function getErrorStatus(error: Error | null): number | null {
  if (!error) return null;
  const axiosError = error as unknown as { response?: { status?: number } };
  return axiosError?.response?.status ?? null;
}

/**
 * Query error display component with user-friendly messages
 * for common HTTP errors (403 Forbidden, 404 Not Found).
 */
export function QueryError({
  error,
  onRetry,
  message = "Daten konnten nicht geladen werden.",
}: QueryErrorProps) {
  const status = getErrorStatus(error);
  const is403 = status === 403;
  const is404 = status === 404;

  const displayTitle = is403
    ? "Zugriff verweigert"
    : is404
      ? "Nicht gefunden"
      : message;

  const displayMessage = is403
    ? "Sie haben nicht die erforderliche Berechtigung, um auf diesen Bereich zuzugreifen. Bitte wenden Sie sich an Ihren Administrator."
    : is404
      ? "Die angeforderte Ressource wurde nicht gefunden oder ist noch nicht eingerichtet."
      : error?.message || null;

  return (
    <Card className="mx-auto mt-8 max-w-lg">
      <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
        {is403 ? (
          <ShieldOff className="h-12 w-12 text-orange-500" />
        ) : (
          <AlertCircle className="h-12 w-12 text-destructive" />
        )}
        <div>
          <h3 className="text-lg font-semibold">{displayTitle}</h3>
          {displayMessage && (
            <p className="mt-1 text-sm text-muted-foreground">
              {displayMessage}
            </p>
          )}
        </div>
        {is403 ? (
          <Button variant="outline" onClick={() => window.history.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
        ) : (
          onRetry && (
            <Button variant="outline" onClick={onRetry}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Erneut versuchen
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}
