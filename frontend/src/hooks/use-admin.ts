"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  User,
  AuditLogEntry,
  SystemSetting,
  Organization,
  Location,
} from "@/types/models";

export const adminKeys = {
  users: (params?: Record<string, unknown>) =>
    ["admin", "users", params] as const,
  user: (id: number) => ["admin", "users", id] as const,
  auditLog: (params?: Record<string, unknown>) =>
    ["admin", "audit-log", params] as const,
  settings: () => ["admin", "settings"] as const,
  organizations: (params?: Record<string, unknown>) =>
    ["admin", "organizations", params] as const,
  organization: (id: number) => ["admin", "organizations", id] as const,
  locations: (params?: Record<string, unknown>) =>
    ["admin", "locations", params] as const,
};

// ─── Users ───────────────────────────────────────────────────────────────────

export function useUsers(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: adminKeys.users(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<User>>(
        "/users/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUser(id: number) {
  return useQuery({
    queryKey: adminKeys.user(id),
    queryFn: async () => {
      const { data } = await api.get<User>(`/users/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<User> & { password: string }) => {
      const { data } = await api.post<User>("/users/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<User> & { id: number }) => {
      const { data } = await api.patch<User>(`/users/${id}/`, payload);
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.user(vars.id) });
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/users/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "users"] });
    },
  });
}

// ─── Audit Log ───────────────────────────────────────────────────────────────

export function useAuditLog(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: adminKeys.auditLog(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<AuditLogEntry>>(
        "/admin/audit-logs/",
        { params }
      );
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });
}

// ─── System Settings ─────────────────────────────────────────────────────────

export function useSystemSettings() {
  return useQuery({
    queryKey: adminKeys.settings(),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<SystemSetting>>(
        "/admin/system-settings/"
      );
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useUpdateSystemSetting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<SystemSetting> & { id: number }) => {
      const { data } = await api.patch<SystemSetting>(
        `/admin/system-settings/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminKeys.settings() });
    },
  });
}

// ─── Organizations ──────────────────────────────────────────────────────────

export function useOrganizations(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: adminKeys.organizations(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Organization>>(
        "/admin/organizations/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useOrganization(id: number) {
  return useQuery({
    queryKey: adminKeys.organization(id),
    queryFn: async () => {
      const { data } = await api.get<Organization>(
        `/admin/organizations/${id}/`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<Organization>) => {
      const { data } = await api.post<Organization>(
        "/admin/organizations/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useUpdateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<Organization> & { id: number }) => {
      const { data } = await api.patch<Organization>(
        `/admin/organizations/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: adminKeys.organization(vars.id) });
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

export function useDeleteOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/admin/organizations/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "organizations"] });
    },
  });
}

// ─── Locations ──────────────────────────────────────────────────────────────

export function useLocations(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: adminKeys.locations(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Location>>(
        "/admin/locations/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}
