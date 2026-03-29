/**
 * React hooks for In-App Notifications API.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type { InAppNotification, PaginatedResponse } from "@/types/models";

/* ───── useNotifications (list) ──────────────────────────────────────────── */

export function useNotifications(page = 1) {
  const [data, setData] = useState<PaginatedResponse<InAppNotification> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<PaginatedResponse<InAppNotification>>(
        `/notifications/?page=${page}`
      );
      setData(res.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Fehler beim Laden der Benachrichtigungen"
      );
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  return { data, loading, error, refetch: fetchNotifications };
}

/* ───── useUnreadCount ───────────────────────────────────────────────────── */

export function useUnreadCount() {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchCount = useCallback(async () => {
    try {
      const res = await api.get<{ unread_count: number }>("/notifications/unread-count/");
      setCount(res.data.unread_count);
    } catch {
      // Silently fail – badge just shows 0
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCount();
    // Poll every 60 seconds for new notifications
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

  return { count, loading, refetch: fetchCount };
}

/* ───── Notification mutations ───────────────────────────────────────────── */

export function useMarkNotificationRead() {
  const markRead = useCallback(async (id: number): Promise<boolean> => {
    try {
      await api.patch(`/notifications/${id}/read/`);
      return true;
    } catch {
      return false;
    }
  }, []);

  return { markRead };
}

export function useMarkAllNotificationsRead() {
  const markAllRead = useCallback(async (): Promise<number> => {
    try {
      const res = await api.post<{ marked_read: number }>("/notifications/mark-all-read/");
      return res.data.marked_read;
    } catch {
      return 0;
    }
  }, []);

  return { markAllRead };
}
