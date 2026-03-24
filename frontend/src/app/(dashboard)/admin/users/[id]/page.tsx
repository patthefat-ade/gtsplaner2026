"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useUser, useUpdateUser, useDeleteUser } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { UserForm } from "@/components/forms/user-form";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatDate } from "@/lib/format";
import type { User } from "@/types/models";
import {
  ArrowLeft,
  Pencil,
  Trash2,
  Mail,
  Phone,
  MapPin,
  Shield,
  Calendar,
  Clock,
} from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  educator: "Pädagog:in",
  location_manager: "Standortleitung",
  admin: "Admin",
  super_admin: "Super-Admin",
};

export default function UserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const toast = useToast();
  const userId = Number(params.id);

  const { data: user, isLoading, error, refetch } = useUser(userId);
  const updateMutation = useUpdateUser();
  const deleteMutation = useDeleteUser();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const handleUpdate = async (formData: Record<string, unknown>) => {
    await updateMutation.mutateAsync(
      { id: userId, ...formData } as { id: number } & Partial<User>,
      {
        onSuccess: () => {
          toast.success("Benutzer aktualisiert");
          setEditOpen(false);
          refetch();
        },
        onError: () => {
          toast.error("Fehler", "Benutzer konnte nicht aktualisiert werden.");
        },
      }
    );
  };

  const handleDelete = () => {
    deleteMutation.mutate(userId, {
      onSuccess: () => {
        toast.success("Benutzer gelöscht");
        router.push("/admin/users");
      },
      onError: () => toast.error("Fehler", "Löschen fehlgeschlagen."),
    });
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading || !user) return <PageSkeleton rows={4} columns={2} />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${user.first_name} ${user.last_name}`}
        description={`Benutzerdetails – ${ROLE_LABELS[user.role] || user.role}`}
      >
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/users")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurück
          </Button>
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Bearbeiten
          </Button>
          <Button
            variant="destructive"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Löschen
          </Button>
        </div>
      </PageHeader>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persönliche Daten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary">
                <span className="text-lg font-bold text-primary-foreground">
                  {user.first_name?.[0]}
                  {user.last_name?.[0]}
                </span>
              </div>
              <div>
                <p className="font-medium">
                  {user.first_name} {user.last_name}
                </p>
                <p className="text-sm text-muted-foreground">@{user.username}</p>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span>{user.email}</span>
              </div>
              {user.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{user.phone}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{user.location_name || "Kein Standort zugewiesen"}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Role & Status */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rolle & Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rolle</span>
              <Badge variant="outline" className="gap-1">
                <Shield className="h-3 w-3" />
                {ROLE_LABELS[user.role] || user.role}
              </Badge>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Status</span>
              <Badge variant={user.is_active ? "success" : "secondary"}>
                {user.is_active ? "Aktiv" : "Inaktiv"}
              </Badge>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  Erstellt am
                </span>
                <span>{formatDate(user.date_joined)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  Letzter Login
                </span>
                <span>
                  {user.last_login ? formatDate(user.last_login) : "Noch nie"}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Edit Dialog */}
      <UserForm
        open={editOpen}
        onOpenChange={setEditOpen}
        user={user}
        onSubmit={handleUpdate}
        isLoading={updateMutation.isPending}
      />

      {/* Delete Dialog */}
      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Benutzer löschen"
        description={`Möchtest du ${user.first_name} ${user.last_name} wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmLabel="Löschen"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}
