"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  PaginatedResponse,
  Transaction,
  TransactionCreate,
  TransactionCategory,
  GroupBalance,
  Receipt,
} from "@/types/models";

// ─── Query Keys ──────────────────────────────────────────────────────────────

export const financeKeys = {
  all: ["finance"] as const,
  transactions: (params?: Record<string, unknown>) =>
    ["finance", "transactions", params] as const,
  transaction: (id: number) => ["finance", "transactions", id] as const,
  categories: (params?: Record<string, unknown>) =>
    ["finance", "categories", params] as const,
  category: (id: number) => ["finance", "categories", id] as const,
  balance: (groupId: number) => ["finance", "balance", groupId] as const,
  receipts: (transactionId: number) =>
    ["finance", "receipts", transactionId] as const,
};

// ─── Transactions ────────────────────────────────────────────────────────────

export function useTransactions(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: financeKeys.transactions(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<Transaction>>(
        "/finance/transactions/",
        { params }
      );
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useTransaction(id: number) {
  return useQuery({
    queryKey: financeKeys.transaction(id),
    queryFn: async () => {
      const { data } = await api.get<Transaction>(
        `/finance/transactions/${id}/`
      );
      return data;
    },
    enabled: !!id,
  });
}

export function useCreateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TransactionCreate) => {
      const { data } = await api.post<Transaction>(
        "/finance/transactions/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      qc.invalidateQueries({ queryKey: ["finance", "balance"] });
    },
  });
}

export function useUpdateTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<TransactionCreate> & { id: number }) => {
      const { data } = await api.patch<Transaction>(
        `/finance/transactions/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.transaction(vars.id) });
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      qc.invalidateQueries({ queryKey: ["finance", "balance"] });
    },
  });
}

export function useDeleteTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/finance/transactions/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      qc.invalidateQueries({ queryKey: ["finance", "balance"] });
    },
  });
}

export function useApproveTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const { data } = await api.post<Transaction>(
        `/finance/transactions/${id}/approve/`
      );
      return data;
    },
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: financeKeys.transaction(id) });
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
      qc.invalidateQueries({ queryKey: ["finance", "balance"] });
    },
  });
}

export function useRejectTransaction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      reason,
    }: {
      id: number;
      reason: string;
    }) => {
      const { data } = await api.post<Transaction>(
        `/finance/transactions/${id}/reject/`,
        { rejection_reason: reason }
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.transaction(vars.id) });
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
  });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export function useCategories(params?: Record<string, string | number>) {
  return useQuery({
    queryKey: financeKeys.categories(params),
    queryFn: async () => {
      const { data } = await api.get<PaginatedResponse<TransactionCategory>>(
        "/finance/categories/",
        { params }
      );
      return data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

export function useCreateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      payload: Omit<TransactionCategory, "id" | "created_at" | "updated_at" | "location">
    ) => {
      const { data } = await api.post<TransactionCategory>(
        "/finance/categories/",
        payload
      );
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "categories"] });
    },
  });
}

export function useUpdateCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...payload
    }: Partial<TransactionCategory> & { id: number }) => {
      const { data } = await api.patch<TransactionCategory>(
        `/finance/categories/${id}/`,
        payload
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: financeKeys.category(vars.id) });
      qc.invalidateQueries({ queryKey: ["finance", "categories"] });
    },
  });
}

export function useDeleteCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      await api.delete(`/finance/categories/${id}/`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["finance", "categories"] });
    },
  });
}

// ─── Receipts ───────────────────────────────────────────────────────────────

export function useUploadReceipt() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      transactionId,
      file,
    }: {
      transactionId: number;
      file: File;
    }) => {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("file_name", file.name);
      formData.append("file_size", String(file.size));
      formData.append("file_type", file.type);
      const { data } = await api.post<Receipt>(
        `/finance/transactions/${transactionId}/upload_receipt/`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return data;
    },
    onSuccess: (_, vars) => {
      qc.invalidateQueries({
        queryKey: financeKeys.transaction(vars.transactionId),
      });
      qc.invalidateQueries({ queryKey: ["finance", "transactions"] });
    },
  });
}

// ─── Balance ─────────────────────────────────────────────────────────────────

export function useGroupBalance(groupId: number) {
  return useQuery({
    queryKey: financeKeys.balance(groupId),
    queryFn: async () => {
      const { data } = await api.get<GroupBalance>(
        `/finance/transactions/balance/${groupId}/`
      );
      return data;
    },
    enabled: !!groupId,
  });
}
