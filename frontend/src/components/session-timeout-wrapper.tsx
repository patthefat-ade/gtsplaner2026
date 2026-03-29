"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/lib/auth-api";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutDialog } from "@/components/session-timeout-dialog";

/**
 * Wrapper component that monitors session activity and shows
 * a warning dialog before the session expires.
 *
 * Since JWT tokens are now in httpOnly cookies (not accessible via JS),
 * the timeout is based on a configurable session duration rather than
 * parsing the JWT expiry directly.
 *
 * Place this inside the dashboard layout (within AuthProvider).
 */
export function SessionTimeoutWrapper() {
  const { logout, isAuthenticated } = useAuth();

  /**
   * Extend the session by refreshing the JWT token via the cookie-based endpoint.
   */
  const handleExtendSession = useCallback(async () => {
    try {
      await authApi.refreshToken();
    } catch {
      await logout();
    }
  }, [logout]);

  /**
   * Handle session expiry – log the user out.
   */
  const handleSessionExpired = useCallback(async () => {
    await logout();
  }, [logout]);

  const { showWarning, remainingSeconds, extendSession, dismiss } =
    useSessionTimeout({
      warningBeforeExpiry: 120, // 2 minutes
      onExtendSession: handleExtendSession,
      onSessionExpired: handleSessionExpired,
    });

  // Only render when authenticated
  if (!isAuthenticated) return null;

  return (
    <SessionTimeoutDialog
      open={showWarning}
      remainingSeconds={remainingSeconds}
      onExtend={extendSession}
      onLogout={async () => {
        dismiss();
        await logout();
      }}
    />
  );
}
