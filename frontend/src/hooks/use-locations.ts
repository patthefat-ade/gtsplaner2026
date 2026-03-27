"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  Location,
  LocationCreate,
  LocationStats,
  LocationGroupCompact,
  LocationUserCompact,
} from "@/types/models";

export const locationKeys = {
  locations: (params?: Record<string, unknown>) =>
    ["locations", "list", params] as const,
  location: (id: number) => ["locations", id] as const,
  locationGroups: (id: number) => ["locations", id, "groups"] as const,
  locationStats: (id: number) => ["locations", id, "stats"] as const,
  locationEducators: (id: number) => ["locations", id, "educators"] as const,
};

// ─── Locations ──────────────────────────────────────────────────────────────

export function useLocations(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: locationKeys.locations(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Location>>(
        "/locations/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useLocation(id: number) {
  return useQuery({
    queryKey: locationKeys.location(id),
    queryFn: async () => {
      const { data } = await api.get<Location>(`/locations/${id}/`);
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: LocationCreate) => {
      const { data } = await api.post<Location>("/locations/", payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations", "list"] });
    },
  });
}

export function useUpdateLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<LocationCreate> & { id: number }) => {
      const { data } = await api.patch<Location>(
        `/locations/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: locationKeys.location(vars.id) });
      qc.invalidateQueries({ queryKey: ["locations", "list"] });
    },
  });
}

export function useDeleteLocation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/locations/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["locations", "list"] });
    },
  });
}

// ─── Location Sub-Resources ─────────────────────────────────────────────────

export function useLocationGroups(id: number) {
  return useQuery({
    queryKey: locationKeys.locationGroups(id),
    queryFn: async () => {
      const { data } = await api.get<LocationGroupCompact[]>(
        `/locations/${id}/groups/`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useLocationStats(id: number) {
  return useQuery({
    queryKey: locationKeys.locationStats(id),
    queryFn: async () => {
      const { data } = await api.get<LocationStats>(
        `/locations/${id}/stats/`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useLocationEducators(id: number) {
  return useQuery({
    queryKey: locationKeys.locationEducators(id),
    queryFn: async () => {
      const { data } = await api.get<LocationUserCompact[]>(
        `/locations/${id}/educators/`
      );
      return data;
    },
    enabled: !!id,
  });
}
