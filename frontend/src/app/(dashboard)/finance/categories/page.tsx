"use client";

import { useState } from "react";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from "@/hooks/use-finance";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { CategoryForm } from "@/components/forms/category-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { TransactionCategory } from "@/types/models";
import type { TransactionCategoryFormData } from "@/lib/validations";
import {
  Plus,
  Receipt,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";

export default function CategoriesPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<TransactionCategory | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
  };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading, error, refetch } = useCategories(params);
  const createMutation = useCreateCategory();
  const updateMutation = useUpdateCategory();
  const deleteMutation = useDeleteCategory();

  const handleCreate = () => {
    setEditCategory(null);
    setFormOpen(true);
  };

  const handleEdit = (cat: TransactionCategory) => {
    setEditCategory(cat);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: TransactionCategoryFormData) => {
    if (editCategory) {
      await updateMutation.mutateAsync(
        { id: editCategory.id, ...formData },
        {
          onSuccess: () => {
            toast.success("Kategorie aktualisiert");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Kategorie konnte nicht aktualisiert werden.");
            throw err;
          },
        }
      );
    } else {
      await createMutation.mutateAsync({ ...formData, description: formData.description || "" } as Omit<TransactionCategory, "id" | "created_at" | "updated_at" | "location">, {
        onSuccess: () => {
          toast.success("Kategorie erstellt");
          setFormOpen(false);
        },
        onError: (err) => {
          toast.error("Fehler", "Kategorie konnte nicht erstellt werden.");
          throw err;
        },
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Kategorie gelöscht");
          setDeleteDialogOpen(false);
          setDeleteId(null);
        },
        onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={6} columns={5} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kategorien"
        description="Verwalte Einnahme- und Ausgabe-Kategorien."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Kategorie
        </Button>
      </PageHeader>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Kategorie suchen..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        </CardContent>
      </Card>

      {data?.results && data.results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Typ</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Beschreibung
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Erstellt am
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((cat) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell>
                      <StatusBadge status={cat.category_type} />
                    </TableCell>
                    <TableCell className="hidden max-w-[300px] truncate md:table-cell">
                      {cat.description || "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={cat.is_active ? "success" : "secondary"}>
                        {cat.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {formatDate(cat.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(cat)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(cat.id);
                              setDeleteDialogOpen(true);
                            }}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={data.count}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(s) => {
              setPageSize(s);
              setPage(1);
            }}
          />
        </Card>
      ) : (
        <EmptyState
          icon={Receipt}
          title="Keine Kategorien"
          description={
            debouncedSearch
              ? "Keine Kategorien für diese Suche gefunden."
              : "Es wurden noch keine Kategorien angelegt."
          }
          actionLabel="Neue Kategorie"
          onAction={handleCreate}
        />
      )}

      {/* Category Create/Edit Dialog */}
      <CategoryForm
        open={formOpen}
        onOpenChange={setFormOpen}
        category={editCategory}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Kategorie löschen"
        description="Möchtest du diese Kategorie wirklich löschen? Alle zugehörigen Transaktionen verlieren ihre Kategorie-Zuordnung."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
