"use client";

import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState, type ReactNode } from "react";
import { useToast } from "@/components/ui/toast";

/**
 * Inner component that has access to ToastContext.
 * Creates the QueryClient with a global MutationCache onError handler
 * that shows toast notifications for all failed mutations.
 */
function QueryProviderInner({ children }: { children: ReactNode }) {
  const { error: showError } = useToast();

  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
        mutationCache: new MutationCache({
          onError: (error: Error) => {
            // Extract a user-friendly error message
            let message = "Ein unerwarteter Fehler ist aufgetreten.";

            // Axios error with response data
            const axiosError = error as { response?: { data?: { detail?: string; message?: string }; status?: number } };
            if (axiosError.response?.data?.detail) {
              message = axiosError.response.data.detail;
            } else if (axiosError.response?.data?.message) {
              message = axiosError.response.data.message;
            } else if (axiosError.response?.status === 403) {
              message = "Sie haben keine Berechtigung für diese Aktion.";
            } else if (axiosError.response?.status === 404) {
              message = "Die angeforderte Ressource wurde nicht gefunden.";
            } else if (axiosError.response?.status === 500) {
              message = "Serverfehler – bitte versuchen Sie es später erneut.";
            } else if (error.message) {
              message = error.message;
            }

            showError("Fehler", message);
          },
        }),
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

/**
 * React Query provider that wraps the application
 * and provides data fetching capabilities with global error handling.
 *
 * IMPORTANT: This component must be rendered inside <ToastProvider>
 * so that the MutationCache onError handler can show toast notifications.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return <QueryProviderInner>{children}</QueryProviderInner>;
}
