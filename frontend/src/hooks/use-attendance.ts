"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

/* ───── Types ─────────────────────────────────────────────────────────────── */

export interface Attendance {
  id: number;
  student: number;
  group: number;
  date: string;
  status: "present" | "absent" | "sick" | "excused";
  status_display: string;
  notes: string;
  recorded_by: number | null;
  recorded_by_name: string | null;
  student_name: string;
  created_at: string;
  updated_at: string;
}

export interface AttendanceSummary {
  group_id: number;
  start_date: string;
  end_date: string;
  total_records: number;
  by_status: Record<
    string,
    { count: number; label: string; percentage: number }
  >;
}

export interface BulkAttendanceRecord {
  student_id: number;
  status: "present" | "absent" | "sick" | "excused";
  notes?: string;
}

export interface BulkAttendancePayload {
  group_id: number;
  date: string;
  records: BulkAttendanceRecord[];
}

export interface PaginatedAttendance {
  count: number;
  next: string | null;
  previous: string | null;
  results: Attendance[];
}

/* ───── Query Keys ────────────────────────────────────────────────────────── */

export const attendanceKeys = {
  all: ["attendance"] as const,
  list: (params?: Record<string, unknown>) =>
    ["attendance", "list", params] as const,
  detail: (id: number) => ["attendance", id] as const,
  summary: (params?: Record<string, unknown>) =>
    ["attendance", "summary", params] as const,
};

/* ───── Queries ───────────────────────────────────────────────────────────── */

export function useAttendance(
  params?: Record<string, string | number>
) {
  return useQuery({
    queryKey: attendanceKeys.list(params),
    queryFn: async () => {
      const res = await api.get<PaginatedAttendance>(
        "/groups/attendance/",
        { params }
      );
      return res.data;
    },
    enabled: !!params?.group_id && !!params?.date,
  });
}

export function useAttendanceSummary(
  params?: Record<string, string | number>
) {
  return useQuery({
    queryKey: attendanceKeys.summary(params),
    queryFn: async () => {
      const res = await api.get<AttendanceSummary>(
        "/groups/attendance/summary/",
        { params }
      );
      return res.data;
    },
    enabled: !!params?.group_id,
  });
}

/* ───── Mutations ─────────────────────────────────────────────────────────── */

export function useBulkAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: BulkAttendancePayload) => {
      const res = await api.post("/groups/attendance/bulk/", payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}

export function useDeleteAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/attendance/${id}/`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: attendanceKeys.all });
    },
  });
}
