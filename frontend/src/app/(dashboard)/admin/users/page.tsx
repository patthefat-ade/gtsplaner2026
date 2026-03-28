"use client";

import { useState } from "react";
import {
  useUsers,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useLocations,
  useOrganizations,
} from "@/hooks/use-admin";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { UserForm } from "@/components/forms/user-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import type { User } from "@/types/models";

import {
  Plus,
  UserCog,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Shield,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  educator: "Pädagog:in",
  location_manager: "Standortleitung",
  admin: "Admin",
  super_admin: "Super-Admin",
};

export default function UsersPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [roleFilter, setRoleFilter] = useState<string>("all");

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editUser, setEditUser] = useState<User | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (roleFilter !== "all") params.role = roleFilter;

  const { data, isLoading, error, refetch } = useUsers(params);

  // Load locations and organizations for the user form
  const { data: locationsData } = useLocations({ page_size: 200 });
  const { data: orgsData } = useOrganizations({ page_size: 200 });
  const locations = locationsData?.results ?? [];
  const organizations = orgsData?.results ?? [];

  const createMutation = useCreateUser();
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const handleCreate = () => {
    setEditUser(null);
    setFormOpen(true);
  };

  const handleEdit = (user: User) => {
    setEditUser(user);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: Record<string, unknown>) => {
    if (editUser) {
      await updateMutation.mutateAsync(
        { id: editUser.id, ...formData } as { id: number } & Partial<User>,
        {
          onSuccess: () => {
            toast.success("Benutzer aktualisiert");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Benutzer konnte nicht aktualisiert werden.");
            throw err;
          },
        }
      );
    } else {
      await createMutation.mutateAsync(formData as Partial<User> & { password: string }, {
        onSuccess: () => {
          toast.success("Benutzer erstellt");
          setFormOpen(false);
        },
        onError: (err) => {
          toast.error("Fehler", "Benutzer konnte nicht erstellt werden.");
          throw err;
        },
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Benutzer gelöscht");
          setDeleteDialogOpen(false);
          setDeleteId(null);
        },
        onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={6} columns={7} />;

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Benutzerverwaltung"
        description="Verwalte alle Benutzer und deren Rollen."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neuer Benutzer
        </Button>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name oder E-Mail suchen..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={roleFilter}
              onValueChange={(v) => {
                setRoleFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Rolle" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Rollen</SelectItem>
                <SelectItem value="educator">Pädagog:in</SelectItem>
                <SelectItem value="location_manager">Standortleitung</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="super_admin">Super-Admin</SelectItem>
              </SelectContent>
            </Select>
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
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Organisation
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Standort
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Erstellt am
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">
                      {u.first_name} {u.last_name}
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="gap-1">
                        <Shield className="h-3 w-3" />
                        {ROLE_LABELS[u.role] || u.role}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.organization_detail?.name || "–"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {u.location_detail?.name || u.location_name || "–"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={u.is_active ? "success" : "secondary"}
                      >
                        {u.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDate(u.date_joined)}
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
                          <DropdownMenuItem
                            onClick={() => handleEdit(u)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(u.id);
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
          icon={UserCog}
          title="Keine Benutzer"
          description={
            debouncedSearch || roleFilter !== "all"
              ? "Keine Benutzer für diese Filter gefunden."
              : "Es wurden noch keine Benutzer angelegt."
          }
          actionLabel="Neuer Benutzer"
          onAction={handleCreate}
        />
      )}

      {/* User Create/Edit Dialog */}
      <UserForm
        open={formOpen}
        onOpenChange={setFormOpen}
        user={editUser}
        locations={locations}
        organizations={organizations}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Benutzer löschen"
        description="Möchtest du diesen Benutzer wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
