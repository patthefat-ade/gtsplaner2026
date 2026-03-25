"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * JWT token payload interface (minimal, only what we need).
 */
interface JWTPayload {
  exp: number;
  iat: number;
}

/**
 * Parse a JWT token without a library.
 * Only decodes the payload – does NOT verify the signature.
 */
function parseJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Configuration for the session timeout warning.
 */
interface UseSessionTimeoutOptions {
  /** Seconds before expiry to show the warning dialog (default: 120 = 2 minutes) */
  warningBeforeExpiry?: number;
  /** Callback when the user clicks "Extend Session" */
  onExtendSession: () => Promise<void>;
  /** Callback when the session expires (user didn't extend) */
  onSessionExpired: () => void;
}

/**
 * Hook that monitors the JWT access token expiry and shows a warning dialog
 * before the token expires. Provides state and actions for a timeout dialog.
 *
 * The hook:
 * 1. Reads the access_token from localStorage
 * 2. Parses the JWT to get the `exp` claim
 * 3. Sets a timer to show a warning dialog N seconds before expiry
 * 4. Sets a timer to auto-logout when the token expires
 * 5. Provides `showWarning`, `remainingSeconds`, `extendSession`, `dismiss`
 */
export function useSessionTimeout({
  warningBeforeExpiry = 120,
  onExtendSession,
  onSessionExpired,
}: UseSessionTimeoutOptions) {
  const [showWarning, setShowWarning] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);
  const warningTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isExtendingRef = useRef(false);

  /**
   * Clear all timers.
   */
  const clearAllTimers = useCallback(() => {
    if (warningTimerRef.current) {
      clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }
    if (expiryTimerRef.current) {
      clearTimeout(expiryTimerRef.current);
      expiryTimerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  }, []);

  /**
   * Schedule warning and expiry timers based on the current access token.
   */
  const scheduleTimers = useCallback(() => {
    clearAllTimers();

    if (typeof window === "undefined") return;

    const token = localStorage.getItem("access_token");
    if (!token) return;

    const payload = parseJWT(token);
    if (!payload?.exp) return;

    const now = Math.floor(Date.now() / 1000);
    const secondsUntilExpiry = payload.exp - now;

    // Token already expired
    if (secondsUntilExpiry <= 0) {
      onSessionExpired();
      return;
    }

    // Schedule warning dialog
    const secondsUntilWarning = secondsUntilExpiry - warningBeforeExpiry;
    if (secondsUntilWarning > 0) {
      warningTimerRef.current = setTimeout(() => {
        setShowWarning(true);
        setRemainingSeconds(warningBeforeExpiry);

        // Start countdown
        countdownRef.current = setInterval(() => {
          setRemainingSeconds((prev) => {
            if (prev <= 1) {
              if (countdownRef.current) clearInterval(countdownRef.current);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }, secondsUntilWarning * 1000);
    } else {
      // Already within warning window
      setShowWarning(true);
      setRemainingSeconds(Math.max(0, secondsUntilExpiry));

      countdownRef.current = setInterval(() => {
        setRemainingSeconds((prev) => {
          if (prev <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    // Schedule auto-logout
    expiryTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      if (!isExtendingRef.current) {
        onSessionExpired();
      }
    }, secondsUntilExpiry * 1000);
  }, [clearAllTimers, warningBeforeExpiry, onSessionExpired]);

  /**
   * Extend the session by refreshing the token.
   */
  const extendSession = useCallback(async () => {
    isExtendingRef.current = true;
    try {
      await onExtendSession();
      setShowWarning(false);
      // Re-schedule timers with the new token
      scheduleTimers();
    } catch {
      onSessionExpired();
    } finally {
      isExtendingRef.current = false;
    }
  }, [onExtendSession, onSessionExpired, scheduleTimers]);

  /**
   * Dismiss the warning without extending.
   */
  const dismiss = useCallback(() => {
    setShowWarning(false);
  }, []);

  // Schedule timers on mount and when token changes
  useEffect(() => {
    scheduleTimers();

    // Listen for storage events (token refresh from another tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === "access_token") {
        scheduleTimers();
      }
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      clearAllTimers();
      window.removeEventListener("storage", handleStorage);
    };
  }, [scheduleTimers, clearAllTimers]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
    dismiss,
  };
}
