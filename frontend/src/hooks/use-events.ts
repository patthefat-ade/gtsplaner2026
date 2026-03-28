/**
 * React hooks for Events/Veranstaltungen API.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type {
  Event,
  EventCreate,
  EventParticipant,
  EventStats,
  PaginatedResponse,
} from "@/types/models";

/* ───── useEvents (list) ─────────────────────────────────────────────────── */

interface UseEventsParams {
  page?: number;
  page_size?: number;
  event_type?: string;
  status?: string;
  location?: number;
  school_year?: number;
  search?: string;
  ordering?: string;
}

export function useEvents(params: UseEventsParams = {}) {
  const [data, setData] = useState<PaginatedResponse<Event> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set("page", String(params.page));
      if (params.page_size) queryParams.set("page_size", String(params.page_size));
      if (params.event_type) queryParams.set("event_type", params.event_type);
      if (params.status) queryParams.set("status", params.status);
      if (params.location) queryParams.set("location", String(params.location));
      if (params.school_year) queryParams.set("school_year", String(params.school_year));
      if (params.search) queryParams.set("search", params.search);
      if (params.ordering) queryParams.set("ordering", params.ordering);

      const qs = queryParams.toString();
      const res = await api.get<PaginatedResponse<Event>>(
        `/events/${qs ? `?${qs}` : ""}`
      );
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Veranstaltungen");
    } finally {
      setLoading(false);
    }
  }, [
    params.page,
    params.page_size,
    params.event_type,
    params.status,
    params.location,
    params.school_year,
    params.search,
    params.ordering,
  ]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return { data, loading, error, refetch: fetchEvents };
}

/* ───── useEvent (detail) ────────────────────────────────────────────────── */

export function useEvent(id: number | null) {
  const [event, setEvent] = useState<Event | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvent = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Event>(`/events/${id}/`);
      setEvent(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Veranstaltung");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchEvent();
  }, [fetchEvent]);

  return { event, loading, error, refetch: fetchEvent };
}

/* ───── useCreateEvent ───────────────────────────────────────────────────── */

export function useCreateEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createEvent = useCallback(async (data: EventCreate): Promise<Event | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<Event>("/events/", data);
      return res.data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen der Veranstaltung");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createEvent, loading, error };
}

/* ───── useUpdateEvent ───────────────────────────────────────────────────── */

export function useUpdateEvent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateEvent = useCallback(
    async (id: number, data: Partial<EventCreate>): Promise<Event | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await api.patch<Event>(`/events/${id}/`, data);
        return res.data;
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Fehler beim Aktualisieren");
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { updateEvent, loading, error };
}

/* ───── useDeleteEvent ───────────────────────────────────────────────────── */

export function useDeleteEvent() {
  const [loading, setLoading] = useState(false);

  const deleteEvent = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    try {
      await api.delete(`/events/${id}/`);
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteEvent, loading };
}

/* ───── useEventParticipants ─────────────────────────────────────────────── */

export function useEventParticipants(eventId: number | null) {
  const [participants, setParticipants] = useState<EventParticipant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchParticipants = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<EventParticipant[]>(
        `/events/${eventId}/participants/`
      );
      setParticipants(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Teilnehmer");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchParticipants();
  }, [fetchParticipants]);

  const addParticipants = useCallback(
    async (studentIds: number[]) => {
      if (!eventId) return;
      await api.post(`/events/${eventId}/participants/add/`, {
        student_ids: studentIds,
      });
      await fetchParticipants();
    },
    [eventId, fetchParticipants]
  );

  const removeParticipants = useCallback(
    async (studentIds: number[]) => {
      if (!eventId) return;
      await api.post(`/events/${eventId}/participants/remove/`, {
        student_ids: studentIds,
      });
      await fetchParticipants();
    },
    [eventId, fetchParticipants]
  );

  const updateConsent = useCallback(
    async (
      updates: Array<{
        id: number;
        consent_status: string;
        consent_given_by?: string;
        consent_notes?: string;
      }>
    ) => {
      if (!eventId) return;
      await api.post(`/events/${eventId}/participants/consent/`, {
        participants: updates,
      });
      await fetchParticipants();
    },
    [eventId, fetchParticipants]
  );

  return {
    participants,
    loading,
    error,
    refetch: fetchParticipants,
    addParticipants,
    removeParticipants,
    updateConsent,
  };
}

/* ───── useEventStats ────────────────────────────────────────────────────── */

export function useEventStats(eventId: number | null) {
  const [stats, setStats] = useState<EventStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    if (!eventId) return;
    setLoading(true);
    try {
      const res = await api.get<EventStats>(`/events/${eventId}/stats/`);
      setStats(res.data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, refetch: fetchStats };
}

/* ───── useEventTransactions ─────────────────────────────────────────────── */

export function useEventTransactions(eventId: number | null) {
  const linkTransactions = useCallback(
    async (transactionIds: number[]) => {
      if (!eventId) return;
      await api.post(`/events/${eventId}/transactions/link/`, {
        transaction_ids: transactionIds,
      });
    },
    [eventId]
  );

  const unlinkTransactions = useCallback(
    async (transactionIds: number[]) => {
      if (!eventId) return;
      await api.post(`/events/${eventId}/transactions/unlink/`, {
        transaction_ids: transactionIds,
      });
    },
    [eventId]
  );

  return { linkTransactions, unlinkTransactions };
}
