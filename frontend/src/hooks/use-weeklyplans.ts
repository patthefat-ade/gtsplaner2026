"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { WeeklyPlan, WeeklyPlanCreate, PaginatedResponse } from "@/types/models";

const BASE = "/weeklyplans";

interface WeeklyPlanFilters {
  group?: number;
  location?: number;
  status?: string;
  is_template?: boolean;
  week_start_date_after?: string;
  week_start_date_before?: string;
  search?: string;
  page?: number;
  page_size?: number;
}

// ── List ────────────────────────────────────────────────────────────────────

export function useWeeklyPlans(filters: WeeklyPlanFilters = {}) {
  const params = new URLSearchParams();
  if (filters.group) params.set("group", String(filters.group));
  if (filters.location) params.set("location", String(filters.location));
  if (filters.status) params.set("status", filters.status);
  if (filters.is_template !== undefined) params.set("is_template", String(filters.is_template));
  if (filters.week_start_date_after) params.set("week_start_date_after", filters.week_start_date_after);
  if (filters.week_start_date_before) params.set("week_start_date_before", filters.week_start_date_before);
  if (filters.search) params.set("search", filters.search);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.page_size) params.set("page_size", String(filters.page_size));

  const qs = params.toString();
  const url = qs ? `${BASE}/?${qs}` : `${BASE}/`;

  return useQuery<PaginatedResponse<WeeklyPlan>>({
    queryKey: ["weeklyplans", filters],
    queryFn: () => api.get(url).then((r) => r.data),
  });
}

// ── Templates ───────────────────────────────────────────────────────────────

export function useWeeklyPlanTemplates() {
  return useQuery<WeeklyPlan[]>({
    queryKey: ["weeklyplans", "templates"],
    queryFn: () => api.get(`${BASE}/templates/`).then((r) => r.data),
  });
}

// ── Detail ──────────────────────────────────────────────────────────────────

export function useWeeklyPlan(id: number | null) {
  return useQuery<WeeklyPlan>({
    queryKey: ["weeklyplans", id],
    queryFn: () => api.get(`${BASE}/${id}/`).then((r) => r.data),
    enabled: !!id,
  });
}

// ── Create ──────────────────────────────────────────────────────────────────

export function useCreateWeeklyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: WeeklyPlanCreate) =>
      api.post(`${BASE}/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyplans"] });
    },
  });
}

// ── Update ──────────────────────────────────────────────────────────────────

export function useUpdateWeeklyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<WeeklyPlanCreate> }) =>
      api.patch(`${BASE}/${id}/`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyplans"] });
    },
  });
}

// ── Delete ──────────────────────────────────────────────────────────────────

export function useDeleteWeeklyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.delete(`${BASE}/${id}/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyplans"] });
    },
  });
}

// ── Duplicate ───────────────────────────────────────────────────────────────

export function useDuplicateWeeklyPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      api.post(`${BASE}/${id}/duplicate/`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyplans"] });
    },
  });
}

// ── Create from Template ────────────────────────────────────────────────────

export function useCreateFromTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      templateId,
      data,
    }: {
      templateId: number;
      data: { group: number; week_start_date: string; title?: string };
    }) =>
      api
        .post(`${BASE}/${templateId}/create_from_template/`, data)
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyplans"] });
    },
  });
}

// ── PDF Export ───────────────────────────────────────────────────────────────

export function useExportPdf() {
  return useMutation({
    mutationFn: async (id: number) => {
      const response = await api.get(`${BASE}/${id}/pdf/`, {
        responseType: "blob",
      });
      // Create download link
      const blob = new Blob([response.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `wochenplan_${id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    },
  });
}

// ── Duplicate Entry ─────────────────────────────────────────────────────────
export function useDuplicateEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      planId,
      entryId,
      targetDay,
    }: {
      planId: number;
      entryId: number;
      targetDay: number;
    }) =>
      api
        .post(`${BASE}/${planId}/duplicate-entry/`, {
          entry_id: entryId,
          target_day: targetDay,
        })
        .then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["weeklyplans"] });
    },
  });
}
