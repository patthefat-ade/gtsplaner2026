"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  StudentContact,
  StudentContactCreate,
} from "@/types/models";

export const contactsKeys = {
  list: (params?: Record<string, unknown>) =>
    ["contacts", "list", params] as const,
  detail: (id: number) => ["contacts", id] as const,
};

export function useContacts(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: contactsKeys.list(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<StudentContact>>(
        "/groups/contacts/",
        { params }
      );
      return data;
    },
  });
}

export function useContact(id: number) {
  return useQuery({
    queryKey: contactsKeys.detail(id),
    queryFn: async () => {
      const { data } = await api.get<StudentContact>(
        `/groups/contacts/${id}/`
      );
      return data;
    },
    enabled: id > 0,
  });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: StudentContactCreate) => {
      const { data } = await api.post<StudentContact>(
        "/groups/contacts/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<StudentContactCreate> & { id: number }) => {
      const { data } = await api.patch<StudentContact>(
        `/groups/contacts/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}

export function useDeleteContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/groups/contacts/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contacts"] });
    },
  });
}
