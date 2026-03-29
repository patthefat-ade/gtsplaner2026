"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * Session duration in seconds.
 *
 * Since JWT tokens are now in httpOnly cookies and cannot be parsed client-side,
 * we use a fixed session duration that matches the backend ACCESS_TOKEN_LIFETIME.
 * The backend default is 60 minutes.
 */
const SESSION_DURATION_SECONDS = 60 * 60; // 60 minutes

/**
 * Hook that monitors user activity and shows a warning dialog
 * before the session expires. Provides state and actions for a timeout dialog.
 *
 * The hook:
 * 1. Tracks the last user activity timestamp
 * 2. Sets a timer to show a warning dialog N seconds before session expiry
 * 3. Sets a timer to auto-logout when the session expires
 * 4. Resets timers on user activity (mouse, keyboard, touch)
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
  const lastActivityRef = useRef<number>(Date.now());

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
   * Schedule warning and expiry timers based on last activity.
   */
  const scheduleTimers = useCallback(() => {
    clearAllTimers();

    if (typeof window === "undefined") return;

    const now = Date.now();
    lastActivityRef.current = now;

    const sessionExpiresAt = now + SESSION_DURATION_SECONDS * 1000;
    const warningAt = sessionExpiresAt - warningBeforeExpiry * 1000;

    const msUntilWarning = warningAt - now;
    const msUntilExpiry = sessionExpiresAt - now;

    // Schedule warning dialog
    if (msUntilWarning > 0) {
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
      }, msUntilWarning);
    }

    // Schedule auto-logout
    expiryTimerRef.current = setTimeout(() => {
      clearAllTimers();
      setShowWarning(false);
      if (!isExtendingRef.current) {
        onSessionExpired();
      }
    }, msUntilExpiry);
  }, [clearAllTimers, warningBeforeExpiry, onSessionExpired]);

  /**
   * Extend the session by refreshing the token.
   */
  const extendSession = useCallback(async () => {
    isExtendingRef.current = true;
    try {
      await onExtendSession();
      setShowWarning(false);
      // Re-schedule timers with fresh session
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

  // Schedule timers on mount
  useEffect(() => {
    scheduleTimers();

    return () => {
      clearAllTimers();
    };
  }, [scheduleTimers, clearAllTimers]);

  return {
    showWarning,
    remainingSeconds,
    extendSession,
    dismiss,
  };
}
