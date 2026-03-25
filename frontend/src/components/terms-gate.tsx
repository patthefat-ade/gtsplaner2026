"use client";

import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/lib/auth-api";
import { TermsAcceptanceDialog } from "@/components/terms-acceptance-dialog";

/**
 * Wraps dashboard content and shows a terms acceptance dialog
 * if the user has not yet accepted privacy policy and terms.
 */
export function TermsGate({ children }: { children: React.ReactNode }) {
  const { user, refreshProfile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  const handleAccept = useCallback(async () => {
    setIsLoading(true);
    try {
      await authApi.acceptTerms();
      await refreshProfile();
    } catch (error) {
      console.error("Failed to accept terms:", error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshProfile]);

  // Show dialog if user hasn't accepted terms yet
  if (user && !user.has_accepted_terms) {
    return (
      <>
        {children}
        <TermsAcceptanceDialog onAccept={handleAccept} isLoading={isLoading} />
      </>
    );
  }

  return <>{children}</>;
}
