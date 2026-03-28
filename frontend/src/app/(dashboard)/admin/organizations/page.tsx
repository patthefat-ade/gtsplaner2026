"use client";

import * as React from "react";
import { useState } from "react";
import {
  useOrganizations,
  useCreateOrganization,
  useUpdateOrganization,
  useDeleteOrganization,
} from "@/hooks/use-admin";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
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
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { formatDate } from "@/lib/format";
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Organization, OrganizationType } from "@/types/models";
import {
  Plus,
  Building2,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Globe,
  Mail,
  Phone,
  Loader2,
} from "lucide-react";

const ORG_TYPE_LABELS: Record<OrganizationType, string> = {
  main_tenant: "Hauptmandant",
  sub_tenant: "Untermandant",
};

/* ───── Organization Form Dialog ───── */
function OrganizationFormDialog({
  open,
  onOpenChange,
  organization,
  organizations,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization | null;
  organizations: Organization[];
  onSubmit: (data: Partial<Organization>) => Promise<void>;
  isLoading: boolean;
}) {
  const isEdit = !!organization;
  const [name, setName] = useState(organization?.name || "");
  const [description, setDescription] = useState(organization?.description || "");
  const [orgType, setOrgType] = useState<OrganizationType>(
    organization?.org_type || "sub_tenant"
  );
  const [parent, setParent] = useState<number | null>(organization?.parent || null);
  const [email, setEmail] = useState(organization?.email || "");
  const [phone, setPhone] = useState(organization?.phone || "");
  const [website, setWebsite] = useState(organization?.website || "");
  const [street, setStreet] = useState(organization?.street || "");
  const [city, setCity] = useState(organization?.city || "");
  const [postalCode, setPostalCode] = useState(organization?.postal_code || "");
  const [country, setCountry] = useState(organization?.country || "AT");
  const [isActive, setIsActive] = useState(organization?.is_active ?? true);

  // Available parent organizations (only main tenants, excluding self)
  const parentOptions = organizations.filter(
    (o) => o.org_type === "main_tenant" && o.id !== organization?.id
  );

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(organization?.name || "");
      setDescription(organization?.description || "");
      setOrgType(organization?.org_type || "sub_tenant");
      setParent(organization?.parent || null);
      setEmail(organization?.email || "");
      setPhone(organization?.phone || "");
      setWebsite(organization?.website || "");
      setStreet(organization?.street || "");
      setCity(organization?.city || "");
      setPostalCode(organization?.postal_code || "");
      setCountry(organization?.country || "AT");
      setIsActive(organization?.is_active ?? true);
    }
  }, [open, organization]);

  // Clear parent when switching to main_tenant
  React.useEffect(() => {
    if (orgType === "main_tenant") {
      setParent(null);
    }
  }, [orgType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      description,
      org_type: orgType,
      parent: orgType === "sub_tenant" ? parent : null,
      email,
      phone,
      website,
      street,
      city,
      postal_code: postalCode,
      country,
      is_active: isActive,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Organisation bearbeiten" : "Neue Organisation"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="org-name">Name *</Label>
            <Input
              id="org-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organisationsname"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-type">Mandantentyp *</Label>
              <Select
                value={orgType}
                onValueChange={(v) => setOrgType(v as OrganizationType)}
              >
                <SelectTrigger id="org-type">
                  <SelectValue placeholder="Typ wählen" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main_tenant">Hauptmandant</SelectItem>
                  <SelectItem value="sub_tenant">Untermandant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {orgType === "sub_tenant" && (
              <div>
                <Label htmlFor="org-parent">Übergeordneter Mandant *</Label>
                <Select
                  value={parent ? String(parent) : ""}
                  onValueChange={(v) => setParent(v ? Number(v) : null)}
                >
                  <SelectTrigger id="org-parent">
                    <SelectValue placeholder="Hauptmandant wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {parentOptions.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div>
            <Label htmlFor="org-desc">Beschreibung</Label>
            <Textarea
              id="org-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung der Organisation"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-email">E-Mail</Label>
              <Input
                id="org-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@organisation.at"
              />
            </div>
            <div>
              <Label htmlFor="org-phone">Telefon</Label>
              <Input
                id="org-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+43 ..."
              />
            </div>
          </div>

          <div>
            <Label htmlFor="org-website">Website</Label>
            <Input
              id="org-website"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="org-street">Straße</Label>
              <Input
                id="org-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Straße und Hausnummer"
              />
            </div>
            <div>
              <Label htmlFor="org-postal">PLZ</Label>
              <Input
                id="org-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="1010"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="org-city">Stadt</Label>
              <Input
                id="org-city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Wien"
              />
            </div>
            <div>
              <Label htmlFor="org-country">Land</Label>
              <Input
                id="org-country"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="AT"
              />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <Label htmlFor="org-active" className="cursor-pointer">
              Aktiv
            </Label>
            <Switch
              id="org-active"
              checked={isActive}
              onCheckedChange={setIsActive}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Abbrechen
            </Button>
            <Button type="submit" disabled={isLoading || !name}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEdit ? "Speichern" : "Erstellen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ───── Organizations Page ───── */
export default function OrganizationsPage() {
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (debouncedSearch) params.search = debouncedSearch;
  if (typeFilter !== "all") params.org_type = typeFilter;

  const { data, isLoading, error, refetch } = useOrganizations(params);

  // Load all organizations for parent dropdown in form
  const { data: allOrgsData } = useOrganizations({ page_size: 200 });
  const allOrganizations = allOrgsData?.results ?? [];

  const createMutation = useCreateOrganization();
  const updateMutation = useUpdateOrganization();
  const deleteMutation = useDeleteOrganization();

  const handleCreate = () => {
    setEditOrg(null);
    setFormOpen(true);
  };

  const handleEdit = (org: Organization) => {
    setEditOrg(org);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: Partial<Organization>) => {
    if (editOrg) {
      await updateMutation.mutateAsync(
        { id: editOrg.id, ...formData } as { id: number } & Partial<Organization>,
        {
          onSuccess: () => {
            toast.success("Organisation aktualisiert");
            setFormOpen(false);
          },
          onError: () =>
            toast.error("Fehler", "Organisation konnte nicht aktualisiert werden."),
        }
      );
    } else {
      await createMutation.mutateAsync(formData, {
        onSuccess: () => {
          toast.success("Organisation erstellt");
          setFormOpen(false);
        },
        onError: () =>
          toast.error("Fehler", "Organisation konnte nicht erstellt werden."),
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Organisation gelöscht");
          setDeleteOpen(false);
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
        title="Organisationen"
        description="Verwalte alle Organisationen (Mandanten) im System."
      >
        <Button onClick={handleCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Neue Organisation
        </Button>
      </PageHeader>

      {/* Search & Filter */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Organisation suchen..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Select
              value={typeFilter}
              onValueChange={(v) => {
                setTypeFilter(v);
                setPage(1);
              }}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Mandantentyp" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Alle Typen</SelectItem>
                <SelectItem value="main_tenant">Hauptmandanten</SelectItem>
                <SelectItem value="sub_tenant">Untermandanten</SelectItem>
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
                  <TableHead>Typ</TableHead>
                  <TableHead className="hidden md:table-cell">Übergeordnet</TableHead>
                  <TableHead className="hidden md:table-cell">E-Mail</TableHead>
                  <TableHead className="hidden lg:table-cell">Stadt</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Erstellt am</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((org) => (
                  <TableRow key={org.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {org.name}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={org.org_type === "main_tenant" ? "default" : "outline"}
                      >
                        {ORG_TYPE_LABELS[org.org_type] || org.org_type}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {org.parent_name || "–"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {org.email ? (
                        <span className="flex items-center gap-1 text-sm">
                          <Mail className="h-3 w-3" />
                          {org.email}
                        </span>
                      ) : (
                        "–"
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {org.city || "–"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={org.is_active ? "success" : "secondary"}>
                        {org.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {formatDate(org.created_at)}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(org)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Bearbeiten
                          </DropdownMenuItem>
                          {org.website && (
                            <DropdownMenuItem asChild>
                              <a
                                href={org.website}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                <Globe className="mr-2 h-4 w-4" />
                                Website öffnen
                              </a>
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => {
                              setDeleteId(org.id);
                              setDeleteOpen(true);
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
          icon={Building2}
          title="Keine Organisationen"
          description={
            debouncedSearch
              ? "Keine Organisationen für diese Suche gefunden."
              : "Es wurden noch keine Organisationen angelegt."
          }
          actionLabel="Neue Organisation"
          onAction={handleCreate}
        />
      )}

      <OrganizationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        organization={editOrg}
        organizations={allOrganizations}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending || updateMutation.isPending}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Organisation löschen"
        description="Möchtest du diese Organisation wirklich löschen? Alle zugehörigen Standorte und Daten werden ebenfalls gelöscht."
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
