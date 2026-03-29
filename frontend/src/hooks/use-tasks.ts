/**
 * React hooks for Task Management API.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import api from "@/lib/api";
import type {
  Task,
  TaskCreate,
  TaskBoard,
  TaskStatus,
  PaginatedResponse,
} from "@/types/models";

/* ───── useTasks (paginated list) ────────────────────────────────────────── */

interface UseTasksParams {
  page?: number;
  page_size?: number;
  status?: string;
  priority?: string;
  assigned_to?: number;
  location?: number;
  search?: string;
  ordering?: string;
}

export function useTasks(params: UseTasksParams = {}) {
  const [data, setData] = useState<PaginatedResponse<Task> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params.page) queryParams.set("page", String(params.page));
      if (params.page_size) queryParams.set("page_size", String(params.page_size));
      if (params.status) queryParams.set("status", params.status);
      if (params.priority) queryParams.set("priority", params.priority);
      if (params.assigned_to) queryParams.set("assigned_to", String(params.assigned_to));
      if (params.location) queryParams.set("location", String(params.location));
      if (params.search) queryParams.set("search", params.search);
      if (params.ordering) queryParams.set("ordering", params.ordering);

      const qs = queryParams.toString();
      const res = await api.get<PaginatedResponse<Task>>(
        `/tasks/${qs ? `?${qs}` : ""}`
      );
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden der Aufgaben");
    } finally {
      setLoading(false);
    }
  }, [
    params.page,
    params.page_size,
    params.status,
    params.priority,
    params.assigned_to,
    params.location,
    params.search,
    params.ordering,
  ]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  return { data, loading, error, refetch: fetchTasks };
}

/* ───── useTaskBoard (Kanban board data) ─────────────────────────────────── */

interface UseTaskBoardParams {
  assigned_to?: number;
  priority?: string;
  location?: number;
}

export function useTaskBoard(params: UseTaskBoardParams = {}) {
  const [data, setData] = useState<TaskBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const queryParams = new URLSearchParams();
      if (params.assigned_to) queryParams.set("assigned_to", String(params.assigned_to));
      if (params.priority) queryParams.set("priority", params.priority);
      if (params.location) queryParams.set("location", String(params.location));

      const qs = queryParams.toString();
      const res = await api.get<TaskBoard>(
        `/tasks/board/${qs ? `?${qs}` : ""}`
      );
      setData(res.data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Laden des Boards");
    } finally {
      setLoading(false);
    }
  }, [params.assigned_to, params.priority, params.location]);

  useEffect(() => {
    fetchBoard();
  }, [fetchBoard]);

  return { data, loading, error, refetch: fetchBoard };
}

/* ───── Task mutations ───────────────────────────────────────────────────── */

export function useCreateTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createTask = useCallback(async (data: TaskCreate): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<Task>("/tasks/", data);
      return res.data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Erstellen der Aufgabe");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { createTask, loading, error };
}

export function useUpdateTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateTask = useCallback(async (id: number, data: Partial<TaskCreate>): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.patch<Task>(`/tasks/${id}/`, data);
      return res.data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Aktualisieren der Aufgabe");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { updateTask, loading, error };
}

export function useChangeTaskStatus() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const changeStatus = useCallback(async (id: number, status: TaskStatus): Promise<Task | null> => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.patch<Task>(`/tasks/${id}/status/`, { status });
      return res.data;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Ändern des Status");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { changeStatus, loading, error };
}

export function useDeleteTask() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deleteTask = useCallback(async (id: number): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await api.delete(`/tasks/${id}/`);
      return true;
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fehler beim Löschen der Aufgabe");
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteTask, loading, error };
}
