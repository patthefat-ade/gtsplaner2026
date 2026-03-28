"use client";

import * as React from "react";
import { useState, useMemo } from "react";
import Link from "next/link";
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from "@/hooks/use-locations";
import { useOrganizations } from "@/hooks/use-admin";
import { usePermissions } from "@/hooks/use-permissions";
import { useDebounce } from "@/hooks/use-debounce";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { EmptyState } from "@/components/common/empty-state";
import { Pagination } from "@/components/common/pagination";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { LocationFormDialog } from "@/components/forms/location-form-dialog";
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
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Location, LocationCreate } from "@/types/models";
import {
  Plus,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Users,
  GraduationCap,
  Eye,
  X,
  Filter,
} from "lucide-react";

/* ───── Locations Page ───── */
export default function LocationsPage() {
  const toast = useToast();
  const { hasPermission, hasRole } = usePermissions();
  const canManage = hasPermission("manage_locations");
  const canCreate = hasRole("admin");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);

  // Extended filters
  const [filterOrg, setFilterOrg] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterCity, setFilterCity] = useState("");
  const debouncedCity = useDebounce(filterCity, 300);
  const [showFilters, setShowFilters] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Fetch organizations for filter dropdown
  const { data: orgsData } = useOrganizations({ page_size: 100 });

  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (debouncedSearch) params.search = debouncedSearch;
  if (filterOrg !== "all") params.organization = filterOrg;
  if (filterStatus !== "all") params.is_active = filterStatus;
  if (debouncedCity) params.city = debouncedCity;

  const { data, isLoading, error, refetch } = useLocations(params);
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();

  const organizations = orgsData?.results ?? [];

  const hasActiveFilters =
    filterOrg !== "all" || filterStatus !== "all" || filterCity !== "";

  const clearFilters = () => {
    setFilterOrg("all");
    setFilterStatus("all");
    setFilterCity("");
    setPage(1);
  };

  const handleCreate = () => {
    setEditLocation(null);
    setFormOpen(true);
  };

  const handleEdit = (loc: Location) => {
    setEditLocation(loc);
    setFormOpen(true);
  };

  const handleSubmit = async (formData: LocationCreate) => {
    if (editLocation) {
      await updateMutation.mutateAsync(
        { id: editLocation.id, ...formData },
        {
          onSuccess: () => {
            toast.success("Standort aktualisiert");
            setFormOpen(false);
          },
          onError: () =>
            toast.error("Fehler", "Standort konnte nicht aktualisiert werden."),
        }
      );
    } else {
      await createMutation.mutateAsync(formData, {
        onSuccess: () => {
          toast.success("Standort erstellt");
          setFormOpen(false);
        },
        onError: () =>
          toast.error("Fehler", "Standort konnte nicht erstellt werden."),
      });
    }
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId, {
        onSuccess: () => {
          toast.success("Standort gelöscht");
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
        title="Standorte"
        description="Übersicht aller GTS-Schulstandorte mit Gruppen und Pädagog:innen."
      >
        {canCreate && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            Neuer Standort
          </Button>
        )}
      </PageHeader>

      {/* Search & Filters */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          {/* Search Row */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Standort suchen..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="pl-9"
              />
            </div>
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="icon"
              onClick={() => setShowFilters(!showFilters)}
              className="shrink-0"
            >
              <Filter className="h-4 w-4" />
            </Button>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="shrink-0 text-muted-foreground"
              >
                <X className="mr-1 h-3 w-3" />
                Filter zurücksetzen
              </Button>
            )}
          </div>

          {/* Extended Filters */}
          {showFilters && (
            <div className="grid gap-4 sm:grid-cols-3">
              {/* Organization Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Organisation
                </label>
                <Select
                  value={filterOrg}
                  onValueChange={(v) => {
                    setFilterOrg(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Organisationen" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Organisationen</SelectItem>
                    {organizations.map((org) => (
                      <SelectItem key={org.id} value={String(org.id)}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Status
                </label>
                <Select
                  value={filterStatus}
                  onValueChange={(v) => {
                    setFilterStatus(v);
                    setPage(1);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Alle Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Alle Status</SelectItem>
                    <SelectItem value="true">Aktiv</SelectItem>
                    <SelectItem value="false">Inaktiv</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* City Filter */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-muted-foreground">
                  Stadt
                </label>
                <Input
                  placeholder="Stadt filtern..."
                  value={filterCity}
                  onChange={(e) => {
                    setFilterCity(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {data?.results && data.results.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Standort</TableHead>
                  <TableHead className="hidden md:table-cell">Organisation</TableHead>
                  <TableHead className="hidden md:table-cell">Standortleitung</TableHead>
                  <TableHead className="text-center">Gruppen</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Schüler:innen</TableHead>
                  <TableHead className="text-center hidden sm:table-cell">Pädagog:innen</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.results.map((loc) => (
                  <TableRow key={loc.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/admin/locations/${loc.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <div>{loc.name}</div>
                          {loc.city && (
                            <div className="text-xs text-muted-foreground">
                              {loc.postal_code} {loc.city}
                            </div>
                          )}
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {loc.organization_name || "–"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {loc.manager ? (
                        <span className="text-sm">
                          {loc.manager.first_name} {loc.manager.last_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">–</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Users className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{loc.group_count ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      <div className="flex items-center justify-center gap-1">
                        <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>{loc.student_count ?? 0}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center hidden sm:table-cell">
                      {loc.educator_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant={loc.is_active ? "success" : "secondary"}>
                        {loc.is_active ? "Aktiv" : "Inaktiv"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/admin/locations/${loc.id}`}>
                              <Eye className="mr-2 h-4 w-4" />
                              Details anzeigen
                            </Link>
                          </DropdownMenuItem>
                          {canManage && (
                            <DropdownMenuItem onClick={() => handleEdit(loc)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Bearbeiten
                            </DropdownMenuItem>
                          )}
                          {canCreate && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => {
                                  setDeleteId(loc.id);
                                  setDeleteOpen(true);
                                }}
                                className="text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Löschen
                              </DropdownMenuItem>
                            </>
                          )}
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
          icon={MapPin}
          title="Keine Standorte"
          description={
            debouncedSearch || hasActiveFilters
              ? "Keine Standorte für diese Suche/Filter gefunden."
              : "Es wurden noch keine Standorte angelegt."
          }
          actionLabel={canCreate ? "Neuer Standort" : undefined}
          onAction={canCreate ? handleCreate : undefined}
        />
      )}

      {canManage && (
        <>
          <LocationFormDialog
            open={formOpen}
            onOpenChange={setFormOpen}
            location={editLocation}
            organizations={organizations}
            onSubmit={handleSubmit}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />

          <ConfirmDialog
            open={deleteOpen}
            onOpenChange={setDeleteOpen}
            title="Standort löschen"
            description="Möchtest du diesen Standort wirklich löschen? Alle zugehörigen Gruppen und Daten werden ebenfalls gelöscht."
            confirmLabel="Löschen"
            variant="destructive"
            onConfirm={handleDelete}
            isLoading={deleteMutation.isPending}
          />
        </>
      )}
    </div>
  );
}
