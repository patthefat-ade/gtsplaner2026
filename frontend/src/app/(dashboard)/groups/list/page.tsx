"use client";

import { useState } from "react";
import Link from "next/link";
import {
  useGroups,
  useCreateGroup,
  useUpdateGroup,
  useDeleteGroup,
  useSchoolYears,
} from "@/hooks/use-groups";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { GroupForm } from "@/components/forms/group-form";
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
import { formatCurrency } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Group, GroupCreate } from "@/types/models";
import type { GroupFormData } from "@/lib/validations";
import {
  Plus,
  Users,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
  Search,
} from "lucide-react";

export default function GroupsListPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
  };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading, error, refetch } = useGroups(params);
  const { data: schoolYearsData } = useSchoolYears({ page_size: 100 });

  const createMutation = useCreateGroup();
  const updateMutation = useUpdateGroup();
  const deleteMutation = useDeleteGroup();

  const handleCreate = () => {
    setEditGroup(null);
    setFormOpen(true);
  };

  const handleEdit = (group: Group) => {
    setEditGroup(group);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: GroupFormData) => {
    if (editGroup) {
      await updateMutation.mutateAsync(
        { id: editGroup.id, ...formData },
        {
          onSuccess: () => {
            toast.success("Gruppe aktualisiert");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Gruppe konnte nicht aktualisiert werden.");
            throw err;
          },
        }
      );
    } else {
      await createMutation.mutateAsync(
        { ...formData, location: 1 } as GroupCreate,  // TODO: location aus Auth-Context
        {
          onSuccess: () => {
            toast.success("Gruppe erstellt");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Gruppe konnte nicht erstellt werden.");
            throw err;
          },
        }
      );
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Gruppe gelöscht");
          setDeleteDialogOpen(false);
          setDeleteId(null);
        },
        onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={6} columns={6} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gruppen"
        description="Verwalte alle Gruppen und deren Mitglieder."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Gruppe
        </Button>
      </PageHeader>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Gruppe suchen..."
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
                  <TableHead>Leitung</TableHead>
                  <TableHead className="text-right">Kontostand</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Schuljahr
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((group) => (
                  <TableRow key={group.id}>
                    <TableCell>
                      <Link
                        href={`/groups/${group.id}`}
                        className="font-medium hover:underline"
                      >
                        {group.name}
                      </Link>
                    </TableCell>
                    <TableCell>
                      {group.group_leader_name || "Nicht zugewiesen"}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      <span
                        className={
                          Number(group.balance) >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }
                      >
                        {formatCurrency(group.balance)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {group.school_year_name || "–"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={group.is_active ? "success" : "secondary"}
                      >
                        {group.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/groups/${group.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Details
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleEdit(group)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(group.id);
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
          icon={Users}
          title="Keine Gruppen"
          description={
            debouncedSearch
              ? "Keine Gruppen für diese Suche gefunden."
              : "Es wurden noch keine Gruppen angelegt."
          }
          actionLabel="Neue Gruppe"
          onAction={handleCreate}
        />
      )}

      {/* Group Create/Edit Dialog */}
      <GroupForm
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editGroup}
        schoolYears={schoolYearsData?.results || []}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Gruppe löschen"
        description="Möchtest du diese Gruppe wirklich löschen? Alle zugehörigen Daten gehen verloren."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
