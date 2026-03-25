"use client";

import { useCallback } from "react";
import { useAuth } from "@/hooks/use-auth";
import { authApi } from "@/lib/auth-api";
import { useSessionTimeout } from "@/hooks/use-session-timeout";
import { SessionTimeoutDialog } from "@/components/session-timeout-dialog";

/**
 * Wrapper component that monitors JWT token expiry and shows
 * a warning dialog 2 minutes before the session expires.
 *
 * Place this inside the dashboard layout (within AuthProvider).
 */
export function SessionTimeoutWrapper() {
  const { logout, isAuthenticated } = useAuth();

  /**
   * Extend the session by refreshing the JWT token.
   */
  const handleExtendSession = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    if (!refreshToken) {
      await logout();
      return;
    }

    try {
      const data = await authApi.refreshToken(refreshToken);
      localStorage.setItem("access_token", data.access);
      if (data.refresh) {
        localStorage.setItem("refresh_token", data.refresh);
      }
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
