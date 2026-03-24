"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  TimeEntry,
  TimeEntryCreate,
  LeaveType,
  LeaveRequest,
  LeaveRequestCreate,
} from "@/types/models";

export const timetrackingKeys = {
  entries: (params?: Record<string, unknown>) =>
    ["timetracking", "entries", params] as const,
  entry: (id: number) => ["timetracking", "entries", id] as const,
  leaveTypes: () => ["timetracking", "leave-types"] as const,
  leaveRequests: (params?: Record<string, unknown>) =>
    ["timetracking", "leave-requests", params] as const,
  leaveRequest: (id: number) =>
    ["timetracking", "leave-requests", id] as const,
};

// ─── Time Entries ────────────────────────────────────────────────────────────

export function useTimeEntries(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: timetrackingKeys.entries(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<TimeEntry>>(
        "/timetracking/entries/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TimeEntryCreate) => {
      const { data } = await api.post<TimeEntry>(
        "/timetracking/entries/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "entries"] });
    },
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<TimeEntryCreate> & { id: number }) => {
      const { data } = await api.patch<TimeEntry>(
        `/timetracking/entries/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "entries"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/timetracking/entries/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "entries"] });
    },
  });
}

// ─── Leave Types ─────────────────────────────────────────────────────────────

export function useLeaveTypes() {
  return useQuery({
    queryKey: timetrackingKeys.leaveTypes(),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<LeaveType>>(
        "/timetracking/leave-types/"
      );
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── Leave Requests ──────────────────────────────────────────────────────────

export function useLeaveRequests(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: timetrackingKeys.leaveRequests(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<LeaveRequest>>(
        "/timetracking/leave-requests/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LeaveRequestCreate) => {
      const { data } = await api.post<LeaveRequest>(
        "/timetracking/leave-requests/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "leave-requests"] });
    },
  });
}

export function useApproveLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<LeaveRequest>(
        `/timetracking/leave-requests/${id}/approve/`
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "leave-requests"] });
    },
  });
}

export function useRejectLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: number;
      reason: string;
    }) => {
      const { data } = await api.post<LeaveRequest>(
        `/timetracking/leave-requests/${id}/reject/`,
        { rejection_reason: reason }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "leave-requests"] });
    },
  });
}

export function useCancelLeaveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<LeaveRequest>(
        `/timetracking/leave-requests/${id}/cancel/`
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["timetracking", "leave-requests"] });
    },
  });
}
