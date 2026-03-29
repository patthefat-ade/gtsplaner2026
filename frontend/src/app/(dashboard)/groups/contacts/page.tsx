"use client";

import { useState } from "react";
import {
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
} from "@/hooks/use-contacts";
import { useStudents } from "@/hooks/use-groups";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type {
  StudentContact,
  StudentContactCreate,
  StudentContactRelationship,
} from "@/types/models";
import { RELATIONSHIP_LABELS } from "@/types/models";
import {
  Plus,
  Contact,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Phone,
  Mail,
  Star,
  MessageCircle,
} from "lucide-react";

export default function ContactsPage() {
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_students");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const [relationshipFilter, setRelationshipFilter] = useState<string>("all");
  const debouncedSearch = useDebounce(search, 300);

  // Form dialog state
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<StudentContact | null>(null);
  const [formData, setFormData] = useState<Partial<StudentContactCreate>>({
    is_primary: false,
    whatsapp_available: false,
  });

  // Delete dialog state
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = {
    page,
    page_size: pageSize,
    ordering: "-is_primary,-created_at",
  };
  if (debouncedSearch) params.search = debouncedSearch;
  if (relationshipFilter && relationshipFilter !== "all")
    params.relationship = relationshipFilter;

  const { data, isLoading, error, refetch } = useContacts(params);
  const { data: studentsData } = useStudents({ page_size: 500 });

  const createMutation = useCreateContact();
  const updateMutation = useUpdateContact();
  const deleteMutation = useDeleteContact();

  const students = studentsData?.results ?? [];

  const openCreate = () => {
    setEditContact(null);
    setFormData({ is_primary: false, whatsapp_available: false });
    setFormOpen(true);
  };

  const openEdit = (c: StudentContact) => {
    setEditContact(c);
    setFormData({
      student: c.student,
      is_primary: c.is_primary,
      relationship: c.relationship,
      first_name: c.first_name,
      last_name: c.last_name,
      phone: c.phone,
      email: c.email,
      whatsapp_available: c.whatsapp_available,
      notes: c.notes,
    });
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (
      !formData.student ||
      !formData.relationship ||
      !formData.first_name ||
      !formData.last_name
    ) {
      toast.error("Bitte alle Pflichtfelder ausfüllen.");
      return;
    }
    try {
      if (editContact) {
        await updateMutation.mutateAsync({
          id: editContact.id,
          ...formData,
        } as StudentContactCreate & { id: number });
        toast.success("Kontaktperson aktualisiert.");
      } else {
        await createMutation.mutateAsync(formData as StudentContactCreate);
        toast.success("Kontaktperson hinzugefügt.");
      }
      setFormOpen(false);
      setEditContact(null);
      setFormData({ is_primary: false, whatsapp_available: false });
    } catch {
      toast.error("Fehler beim Speichern der Kontaktperson.");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteMutation.mutateAsync(deleteId);
      toast.success("Kontaktperson gelöscht.");
      setDeleteOpen(false);
      setDeleteId(null);
    } catch {
      toast.error("Fehler beim Löschen.");
    }
  };

  if (isLoading) return <PageSkeleton />;
  if (error) return <QueryError error={error} onRetry={refetch} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Kontaktpersonen"
        description="Hauptansprechpersonen und Abholberechtigte der Schüler:innen"
      >
        {canManage && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neue Kontaktperson
          </Button>
        )}
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name oder Schüler:in suchen..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-10"
              />
            </div>
            <Select
              value={relationshipFilter}
              onValueChange={(v) => {
                setRelationshipFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Beziehung" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Beziehungen</SelectItem>
                {Object.entries(RELATIONSHIP_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      {!data?.results?.length ? (
        <EmptyState
          icon={Contact}
          title="Keine Kontaktpersonen"
          description="Es wurden noch keine Kontaktpersonen erfasst."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Schüler:in</TableHead>
                  <TableHead>Beziehung</TableHead>
                  <TableHead>Kontakt</TableHead>
                  <TableHead>WhatsApp</TableHead>
                  <TableHead className="w-[60px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((c: StudentContact) => (
                  <TableRow key={c.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {c.is_primary && (
                          <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        )}
                        <span className="font-medium">
                          {c.first_name} {c.last_name}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.student_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {c.relationship_display}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1 text-sm">
                        {c.phone && (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3 text-muted-foreground" />
                            {c.phone}
                          </span>
                        )}
                        {c.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3 text-muted-foreground" />
                            {c.email}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {c.whatsapp_available ? (
                        <MessageCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {canManage && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(c)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bearbeiten
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() => {
                                setDeleteId(c.id);
                                setDeleteOpen(true);
                              }}
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Löschen
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {data && data.count > pageSize && (
        <Pagination
          currentPage={page}
          totalPages={Math.ceil(data.count / pageSize)}
          totalItems={data.count}
          pageSize={pageSize}
          onPageChange={setPage}
        />
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editContact ? "Kontaktperson bearbeiten" : "Neue Kontaktperson"}
            </DialogTitle>
            <DialogDescription>
              {editContact
                ? "Aktualisieren Sie die Kontaktdaten."
                : "Erfassen Sie eine neue Kontaktperson für eine:n Schüler:in."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            {/* Zeile 1: Schüler + Beziehung */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {!editContact ? (
                <div className="grid gap-2">
                  <Label>Schüler:in *</Label>
                  <Select
                    value={formData.student?.toString() ?? ""}
                    onValueChange={(v) =>
                      setFormData((prev) => ({ ...prev, student: Number(v) }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Schüler:in auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {students.map((s) => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          {s.first_name} {s.last_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
              <div className={`grid gap-2 ${editContact ? "sm:col-span-2" : ""}`}>
                <Label>Beziehung *</Label>
                <Select
                  value={formData.relationship ?? ""}
                  onValueChange={(v) =>
                    setFormData((prev) => ({
                      ...prev,
                      relationship: v as StudentContactRelationship,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Beziehung auswählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(RELATIONSHIP_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Zeile 2: Vorname + Nachname */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Vorname *</Label>
                <Input
                  value={formData.first_name ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      first_name: e.target.value,
                    }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>Nachname *</Label>
                <Input
                  value={formData.last_name ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      last_name: e.target.value,
                    }))
                  }
                />
              </div>
            </div>

            {/* Zeile 3: Telefon + E-Mail */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label>Telefon</Label>
                <Input
                  type="tel"
                  value={formData.phone ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, phone: e.target.value }))
                  }
                />
              </div>
              <div className="grid gap-2">
                <Label>E-Mail</Label>
                <Input
                  type="email"
                  value={formData.email ?? ""}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, email: e.target.value }))
                  }
                />
              </div>
            </div>

            {/* Zeile 4: Switches nebeneinander */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>WhatsApp verfügbar</Label>
                  <p className="text-sm text-muted-foreground">
                    Über WhatsApp erreichbar
                  </p>
                </div>
                <Switch
                  checked={formData.whatsapp_available ?? false}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, whatsapp_available: v }))
                  }
                />
              </div>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="space-y-0.5">
                  <Label>Hauptansprechperson</Label>
                  <p className="text-sm text-muted-foreground">
                    Primäre Kontaktperson
                  </p>
                </div>
                <Switch
                  checked={formData.is_primary ?? false}
                  onCheckedChange={(v) =>
                    setFormData((prev) => ({ ...prev, is_primary: v }))
                  }
                />
              </div>
            </div>

            {/* Zeile 5: Notizen (volle Breite) */}
            <div className="grid gap-2">
              <Label>Notizen</Label>
              <Textarea
                placeholder="Zusätzliche Informationen..."
                value={formData.notes ?? ""}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, notes: e.target.value }))
                }
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending
                ? "Wird gespeichert..."
                : editContact
                  ? "Aktualisieren"
                  : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Kontaktperson löschen"
        description="Möchten Sie diese Kontaktperson wirklich löschen?"
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
