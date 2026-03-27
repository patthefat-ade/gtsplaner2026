"use client";

import * as React from "react";
import { useState } from "react";
import Link from "next/link";
import {
  useLocations,
  useCreateLocation,
  useUpdateLocation,
  useDeleteLocation,
} from "@/hooks/use-locations";
import { usePermissions } from "@/hooks/use-permissions";
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
import { DEFAULT_PAGE_SIZE } from "@/lib/constants";
import type { Location, LocationCreate } from "@/types/models";
import {
  Plus,
  MapPin,
  MoreHorizontal,
  Pencil,
  Trash2,
  Search,
  Mail,
  Phone,
  Users,
  GraduationCap,
  Eye,
  Loader2,
} from "lucide-react";

/* ───── Location Form Dialog ───── */
function LocationFormDialog({
  open,
  onOpenChange,
  location,
  onSubmit,
  isLoading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  location: Location | null;
  onSubmit: (data: LocationCreate) => Promise<void>;
  isLoading: boolean;
}) {
  const isEdit = !!location;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");

  React.useEffect(() => {
    if (open) {
      setName(location?.name || "");
      setDescription(location?.description || "");
      setEmail(location?.email || "");
      setPhone(location?.phone || "");
      setStreet(location?.street || "");
      setCity(location?.city || "");
      setPostalCode(location?.postal_code || "");
    }
  }, [open, location]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      name,
      description,
      email,
      phone,
      street,
      city,
      postal_code: postalCode,
      organization: location?.organization || 0,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Standort bearbeiten" : "Neuer Standort"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="loc-name">Name *</Label>
            <Input
              id="loc-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z.B. VS Annabichl"
              required
            />
          </div>

          <div>
            <Label htmlFor="loc-desc">Beschreibung</Label>
            <Textarea
              id="loc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Beschreibung des Standorts"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="loc-email">E-Mail</Label>
              <Input
                id="loc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="standort@hilfswerk.at"
              />
            </div>
            <div>
              <Label htmlFor="loc-phone">Telefon</Label>
              <Input
                id="loc-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+43 ..."
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <Label htmlFor="loc-street">Straße</Label>
              <Input
                id="loc-street"
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="Straße und Hausnummer"
              />
            </div>
            <div>
              <Label htmlFor="loc-postal">PLZ</Label>
              <Input
                id="loc-postal"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="9020"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="loc-city">Stadt</Label>
            <Input
              id="loc-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Klagenfurt"
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

  const [formOpen, setFormOpen] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const params: Record<string, string | number> = { page, page_size: pageSize };
  if (debouncedSearch) params.search = debouncedSearch;

  const { data, isLoading, error, refetch } = useLocations(params);
  const createMutation = useCreateLocation();
  const updateMutation = useUpdateLocation();
  const deleteMutation = useDeleteLocation();

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

      {/* Search */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
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
            debouncedSearch
              ? "Keine Standorte für diese Suche gefunden."
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
