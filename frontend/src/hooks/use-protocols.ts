"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  BulkDailyProtocolPayload,
  DailyProtocol,
  DailyProtocolCreate,
  PaginatedResponse,
} from "@/types/models";

/* ─── Query Keys ─────────────────────────────────────────────────────── */

export const protocolKeys = {
  list: (params?: Record<string, unknown>) =>
    ["daily-protocols", "list", params] as const,
  detail: (id: number) => ["daily-protocols", id] as const,
  byStudent: (studentId: number, params?: Record<string, unknown>) =>
    ["daily-protocols", "by-student", studentId, params] as const,
};

/* ─── List / Filter ──────────────────────────────────────────────────── */

interface ProtocolFilters {
  group_id?: number;
  student_id?: number;
  date?: string;
  date_from?: string;
  date_to?: string;
  incident_severity?: string;
  school_year_id?: number;
  has_incidents?: boolean;
  page?: number;
}

export function useDailyProtocols(filters: ProtocolFilters = {}) {
  const params: Record<string, string | number> = {};
  Object.entries(filters).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") {
      params[k] = v as string | number;
    }
  });

  return useQuery({
    queryKey: protocolKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<DailyProtocol>>(
        "/groups/daily-protocols/",
        { params }
      );
      return data;
    },
  });
}

/* ─── By Student ─────────────────────────────────────────────────────── */

export function useProtocolsByStudent(
  studentId: number | null,
  dateFrom?: string,
  dateTo?: string
) {
  const params: Record<string, string> = {};
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  return useQuery({
    queryKey: protocolKeys.byStudent(studentId ?? 0, params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<DailyProtocol>>(
        `/groups/daily-protocols/by-student/${studentId}/`,
        { params }
      );
      return data;
    },
    enabled: !!studentId,
  });
}

/* ─── Single ─────────────────────────────────────────────────────────── */

export function useDailyProtocol(id: number | null) {
  return useQuery({
    queryKey: protocolKeys.detail(id ?? 0),
    queryFn: async () => {
      const { data } = await api.get<DailyProtocol>(
        `/groups/daily-protocols/${id}/`
      );
      return data;
    },
    enabled: !!id,
  });
}

/* ─── Create ─────────────────────────────────────────────────────────── */

export function useCreateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: DailyProtocolCreate) => {
      const { data } = await api.post<DailyProtocol>(
        "/groups/daily-protocols/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-protocols"] });
    },
  });
}

/* ─── Update ─────────────────────────────────────────────────────────── */

export function useUpdateProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      data: payload,
    }: {
      id: number;
      data: Partial<DailyProtocolCreate>;
    }) => {
      const { data } = await api.patch<DailyProtocol>(
        `/groups/daily-protocols/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-protocols"] });
    },
  });
}

/* ─── Delete ─────────────────────────────────────────────────────────── */

export function useDeleteProtocol() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/daily-protocols/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-protocols"] });
    },
  });
}

/* ─── Bulk Create/Update ─────────────────────────────────────────────── */

export function useBulkProtocols() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: BulkDailyProtocolPayload) => {
      const { data } = await api.post<{ created: number; updated: number }>(
        "/groups/daily-protocols/bulk/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["daily-protocols"] });
    },
  });
}
