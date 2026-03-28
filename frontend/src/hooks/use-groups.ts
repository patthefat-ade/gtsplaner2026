"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  Group,
  GroupCreate,
  GroupMember,
  Student,
  StudentCreate,
  SchoolYear,
} from "@/types/models";

export const groupsKeys = {
  groups: (params?: Record<string, unknown>) =>
    ["groups", "list", params] as const,
  group: (id: number) => ["groups", id] as const,
  members: (groupId: number) => ["groups", groupId, "members"] as const,
  students: (params?: Record<string, unknown>) =>
    ["groups", "students", params] as const,
  schoolYears: (params?: Record<string, unknown>) =>
    ["groups", "school-years", params] as const,
};

// ─── Groups ──────────────────────────────────────────────────────────────────

export function useGroups(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: groupsKeys.groups(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Group>>(
        "/groups/groups/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGroup(id: number) {
  return useQuery({
    queryKey: groupsKeys.group(id),
    queryFn: async () => {
      const { data } = await api.get<Group>(`/groups/groups/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GroupCreate) => {
      const { data } = await api.post<Group>("/groups/groups/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}

export function useUpdateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<GroupCreate> & { id: number }) => {
      const { data } = await api.patch<Group>(
        `/groups/groups/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupsKeys.group(vars.id) });
      qc.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/groups/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "list"] });
    },
  });
}

// ─── Group Members ───────────────────────────────────────────────────────────

export function useGroupMembers(groupId: number) {
  return useQuery({
    queryKey: groupsKeys.members(groupId),
    queryFn: async () => {
      const { data } = await api.get<GroupMember[]>(
        `/groups/groups/${groupId}/members/`
      );
      return data;
    },
    enabled: !!groupId,
  });
}

export function useAddGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
      role,
    }: {
      groupId: number;
      userId: number;
      role: string;
    }) => {
      const { data } = await api.post<GroupMember>(
        `/groups/groups/${groupId}/add_member/`,
        { user_id: userId, role }
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupsKeys.members(vars.groupId) });
    },
  });
}

export function useRemoveGroupMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      groupId,
      userId,
    }: {
      groupId: number;
      userId: number;
    }) => {
      await api.post(`/groups/groups/${groupId}/remove_member/`, {
        user_id: userId,
      });
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: groupsKeys.members(vars.groupId) });
    },
  });
}

// ─── Students ────────────────────────────────────────────────────────────────

export function useStudents(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: groupsKeys.students(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Student>>(
        "/groups/students/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useCreateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StudentCreate) => {
      const { data } = await api.post<Student>("/groups/students/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "students"] });
    },
  });
}

export function useUpdateStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<StudentCreate> & { id: number }) => {
      const { data } = await api.patch<Student>(
        `/groups/students/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "students"] });
    },
  });
}

export function useDeleteStudent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/students/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "students"] });
    },
  });
}

// ─── School Years ────────────────────────────────────────────────────────────

export function useSchoolYears(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: groupsKeys.schoolYears(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<SchoolYear>>(
        "/groups/school-years/",
        { params }
      );
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

// ─── School Calendar (Holidays & Autonomous Days) ───────────────────────────

import type { HolidayPeriod, AutonomousDay } from "@/types/models";

export const calendarKeys = {
  holidays: (schoolYearId: number) =>
    ["calendar", "holidays", schoolYearId] as const,
  autonomousDays: (schoolYearId: number) =>
    ["calendar", "autonomous-days", schoolYearId] as const,
};

export function useHolidays(schoolYearId: number) {
  return useQuery({
    queryKey: calendarKeys.holidays(schoolYearId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<HolidayPeriod>>(
        `/groups/holidays/`,
        { params: { school_year: schoolYearId, page_size: 100 } }
      );
      return data;
    },
    enabled: !!schoolYearId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<HolidayPeriod, "id" | "created_at" | "updated_at">) => {
      const { data } = await api.post<HolidayPeriod>("/groups/holidays/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "holidays"] });
    },
  });
}

export function useDeleteHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/holidays/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "holidays"] });
    },
  });
}

export function useAutonomousDays(schoolYearId: number) {
  return useQuery({
    queryKey: calendarKeys.autonomousDays(schoolYearId),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<AutonomousDay>>(
        `/groups/autonomous-days/`,
        { params: { school_year: schoolYearId, page_size: 100 } }
      );
      return data;
    },
    enabled: !!schoolYearId,
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateAutonomousDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Omit<AutonomousDay, "id" | "created_at" | "updated_at">) => {
      const { data } = await api.post<AutonomousDay>("/groups/autonomous-days/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "autonomous-days"] });
    },
  });
}

export function useDeleteAutonomousDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/autonomous-days/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calendar", "autonomous-days"] });
    },
  });
}

export function useCreateSchoolYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { name: string; location: number; start_date: string; end_date: string; is_active?: boolean }) => {
      const { data } = await api.post<SchoolYear>("/groups/school-years/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "school-years"] });
    },
  });
}

export function useUpdateSchoolYear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...payload }: { id: number; name?: string; start_date?: string; end_date?: string; is_active?: boolean }) => {
      const { data } = await api.patch<SchoolYear>(`/groups/school-years/${id}/`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["groups", "school-years"] });
    },
  });
}
