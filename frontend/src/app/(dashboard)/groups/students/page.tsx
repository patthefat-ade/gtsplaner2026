"use client";

import { useState } from "react";
import {
  useStudents,
  useCreateStudent,
  useUpdateStudent,
  useDeleteStudent,
  useGroups,
} from "@/hooks/use-groups";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ExportButtons } from "@/components/common/export-buttons";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { StudentForm } from "@/components/forms/student-form";
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
import type { Student } from "@/types/models";
import type { StudentFormData } from "@/lib/validations";
import {
  Plus,
  GraduationCap,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Contact,
  Phone,
  Mail,
  Star,
  MessageCircle,
} from "lucide-react";
import { usePermissions } from "@/hooks/use-permissions";
import { useContacts } from "@/hooks/use-contacts";
import Link from "next/link";

export default function StudentsPage() {
  const toast = useToast();
  const { canCreate } = usePermissions();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editStudent, setEditStudent] = useState<Student | null>(null);

  // Delete dialog state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
  };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading, error, refetch } = useStudents(params);
  const { data: groupsData } = useGroups({ page_size: 100 });

  const createMutation = useCreateStudent();
  const updateMutation = useUpdateStudent();
  const deleteMutation = useDeleteStudent();

  const handleCreate = () => {
    setEditStudent(null);
    setFormOpen(true);
  };

  const handleEdit = (student: Student) => {
    setEditStudent(student);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: StudentFormData) => {
    if (editStudent) {
      await updateMutation.mutateAsync(
        { id: editStudent.id, ...formData },
        {
          onSuccess: () => {
            toast.success("Kind aktualisiert");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Kind konnte nicht aktualisiert werden.");
            throw err;
          },
        }
      );
    } else {
      await createMutation.mutateAsync(
        formData as StudentFormData & { group: number },
        {
          onSuccess: () => {
            toast.success("Kind erstellt");
            setFormOpen(false);
          },
          onError: (err) => {
            toast.error("Fehler", "Kind konnte nicht erstellt werden.");
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
          toast.success("Kind gelöscht");
          setDeleteDialogOpen(false);
          setDeleteId(null);
        },
        onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={6} columns={5} />;

  const totalPages = data?.total_pages ?? (data ? Math.ceil(data.count / pageSize) : 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kinder"
        description="Verwalte alle Kinder und deren Gruppenzuordnung."
      >
        <div className="flex gap-2">
          <ExportButtons
            basePath="/groups/students"
            params={debouncedSearch ? { search: debouncedSearch } : {}}
          />
          {canCreate("student") && (
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Neues Kind
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Kind suchen..."
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
                  <TableHead>Vorname</TableHead>
                  <TableHead>Nachname</TableHead>
                  <TableHead className="hidden sm:table-cell">
                    Geburtsdatum
                  </TableHead>
                  <TableHead className="hidden md:table-cell">
                    Gruppe
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Kontakte
                  </TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">
                      {student.first_name}
                    </TableCell>
                    <TableCell>{student.last_name}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {student.date_of_birth
                        ? formatDate(student.date_of_birth)
                        : "–"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {student.group_name || `#${student.group}`}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={student.is_active ? "success" : "secondary"}
                      >
                        {student.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <Link
                        href={`/groups/contacts?search=${encodeURIComponent(student.first_name + " " + student.last_name)}`}
                        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      >
                        <Contact className="h-3.5 w-3.5" />
                        Kontakte
                      </Link>
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
                            onClick={() => handleEdit(student)}
                          >
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(student.id);
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
          icon={GraduationCap}
          title="Keine Kinder"
          description={
            debouncedSearch
              ? "Keine Kinder für diese Suche gefunden."
              : "Es wurden noch keine Kinder erfasst."
          }
          actionLabel={canCreate("student") ? "Neues Kind" : undefined}
          onAction={canCreate("student") ? handleCreate : undefined}
        />
      )}

      {/* Student Create/Edit Dialog */}
      <StudentForm
        open={formOpen}
        onOpenChange={setFormOpen}
        student={editStudent}
        groups={groupsData?.results || []}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Kind löschen"
        description="Möchtest du dieses Kind wirklich löschen?"
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
