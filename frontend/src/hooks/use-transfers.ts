"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  GroupTransfer,
  GroupTransferCreate,
} from "@/types/models";

export const transfersKeys = {
  list: (params?: Record<string, unknown>) =>
    ["transfers", "list", params] as const,
  detail: (id: number) => ["transfers", id] as const,
};

export function useTransfers(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: transfersKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<GroupTransfer>>(
        "/groups/transfers/",
        { params }
      );
      return data;
    },
  });
}

export function useTransfer(id: number) {
  return useQuery({
    queryKey: transfersKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<GroupTransfer>(
        `/groups/transfers/${id}/`
      );
      return data;
    },
    enabled: id > 0,
  });
}

export function useCreateTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: GroupTransferCreate) => {
      const { data } = await api.post<GroupTransfer>(
        "/groups/transfers/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}

export function useConfirmTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<GroupTransfer>(
        `/groups/transfers/${id}/confirm/`
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}

export function useRejectTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const { data } = await api.post<GroupTransfer>(
        `/groups/transfers/${id}/reject/`,
        { notes }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}

export function useCompleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, notes }: { id: number; notes?: string }) => {
      const { data } = await api.post<GroupTransfer>(
        `/groups/transfers/${id}/complete/`,
        { notes }
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}

export function useDeleteTransfer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/transfers/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["transfers"] });
    },
  });
}
