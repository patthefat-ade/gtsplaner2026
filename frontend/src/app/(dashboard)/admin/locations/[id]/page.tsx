"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  useLocation,
  useLocationGroups,
  useLocationStats,
  useLocationEducators,
} from "@/hooks/use-locations";
import { usePermissions } from "@/hooks/use-permissions";
import { PageHeader } from "@/components/common/page-header";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  MapPin,
  Users,
  GraduationCap,
  UserCheck,
  Mail,
  Phone,
  Building2,
  Pencil,
} from "lucide-react";

/* ───── Stats Cards ───── */
function StatsCards({ locationId }: { locationId: number }) {
  const { data: stats, isLoading } = useLocationStats(locationId);

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="h-16 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) return null;

  const cards = [
    {
      title: "Gruppen",
      value: stats.active_groups,
      total: stats.total_groups,
      icon: Users,
      color: "text-blue-500",
    },
    {
      title: "Schüler:innen",
      value: stats.active_students,
      total: stats.total_students,
      icon: GraduationCap,
      color: "text-green-500",
    },
    {
      title: "Pädagog:innen",
      value: stats.educators,
      total: stats.total_educators,
      icon: UserCheck,
      color: "text-purple-500",
    },
    {
      title: "Standortleitungen",
      value: stats.location_managers,
      total: stats.location_managers,
      icon: Building2,
      color: "text-orange-500",
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{card.title}</p>
                <p className="text-2xl font-bold">{card.value}</p>
                {card.total !== card.value && (
                  <p className="text-xs text-muted-foreground">
                    von {card.total} gesamt
                  </p>
                )}
              </div>
              <card.icon className={`h-8 w-8 ${card.color}`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ───── Groups Tab ───── */
function GroupsTab({ locationId }: { locationId: number }) {
  const { data: groups, isLoading, error } = useLocationGroups(locationId);

  if (isLoading) return <div className="h-32 animate-pulse rounded bg-muted" />;
  if (error) return <p className="text-destructive">Fehler beim Laden der Gruppen.</p>;
  if (!groups || groups.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Users className="mb-2 h-8 w-8" />
        <p>Keine Gruppen an diesem Standort.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Gruppenname</TableHead>
          <TableHead>Gruppenleitung</TableHead>
          <TableHead className="text-center">Schüler:innen</TableHead>
          <TableHead className="text-center">Pädagog:innen</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {groups.map((group) => (
          <TableRow key={group.id}>
            <TableCell className="font-medium">
              <Link
                href={`/groups/${group.id}`}
                className="hover:underline"
              >
                {group.name}
              </Link>
            </TableCell>
            <TableCell>
              {group.leader_name || (
                <span className="text-muted-foreground">Nicht zugewiesen</span>
              )}
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1">
                <GraduationCap className="h-3.5 w-3.5 text-muted-foreground" />
                {group.student_count}
              </div>
            </TableCell>
            <TableCell className="text-center">
              <div className="flex items-center justify-center gap-1">
                <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                {group.member_count}
              </div>
            </TableCell>
            <TableCell>
              <Badge variant={group.is_active ? "success" : "secondary"}>
                {group.is_active ? "Aktiv" : "Inaktiv"}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ───── Educators Tab ───── */
function EducatorsTab({ locationId }: { locationId: number }) {
  const { data: educators, isLoading, error } = useLocationEducators(locationId);

  if (isLoading) return <div className="h-32 animate-pulse rounded bg-muted" />;
  if (error) return <p className="text-destructive">Fehler beim Laden der Pädagog:innen.</p>;
  if (!educators || educators.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <UserCheck className="mb-2 h-8 w-8" />
        <p>Keine Pädagog:innen an diesem Standort.</p>
      </div>
    );
  }

  const roleLabels: Record<string, string> = {
    educator: "Pädagog:in",
    location_manager: "Standortleitung",
    admin: "Admin",
    super_admin: "Super Admin",
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>E-Mail</TableHead>
          <TableHead>Rolle</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {educators.map((edu) => (
          <TableRow key={edu.id}>
            <TableCell className="font-medium">
              {edu.first_name} {edu.last_name}
            </TableCell>
            <TableCell>
              <span className="flex items-center gap-1 text-sm">
                <Mail className="h-3 w-3" />
                {edu.email}
              </span>
            </TableCell>
            <TableCell>
              <Badge variant="outline">
                {roleLabels[edu.role] || edu.role}
              </Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

/* ───── Location Detail Page ───── */
export default function LocationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission("manage_locations");

  const locationId = Number(params.id);
  const { data: location, isLoading, error, refetch } = useLocation(locationId);

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (isLoading) return <PageSkeleton rows={8} columns={4} />;
  if (!location) return <p>Standort nicht gefunden.</p>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/admin/locations")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader
          title={location.name}
          description={
            location.organization_name
              ? `Organisation: ${location.organization_name}`
              : "Standort-Details"
          }
        >
          {canManage && (
            <Button variant="outline">
              <Pencil className="mr-2 h-4 w-4" />
              Bearbeiten
            </Button>
          )}
        </PageHeader>
      </div>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Standort-Informationen
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              {location.street && (
                <div>
                  <p className="text-sm text-muted-foreground">Adresse</p>
                  <p className="font-medium">
                    {location.street}
                    <br />
                    {location.postal_code} {location.city}
                  </p>
                </div>
              )}
              {location.description && (
                <div>
                  <p className="text-sm text-muted-foreground">Beschreibung</p>
                  <p>{location.description}</p>
                </div>
              )}
            </div>
            <div className="space-y-3">
              {location.manager && (
                <div>
                  <p className="text-sm text-muted-foreground">Standortleitung</p>
                  <p className="font-medium">
                    {location.manager.first_name} {location.manager.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {location.manager.email}
                  </p>
                </div>
              )}
              <div className="flex gap-4">
                {location.email && (
                  <div className="flex items-center gap-1 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    {location.email}
                  </div>
                )}
                {location.phone && (
                  <div className="flex items-center gap-1 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    {location.phone}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <StatsCards locationId={locationId} />

      {/* Tabs: Gruppen & Pädagog:innen */}
      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="groups">
            <TabsList>
              <TabsTrigger value="groups">
                <Users className="mr-2 h-4 w-4" />
                Gruppen
              </TabsTrigger>
              <TabsTrigger value="educators">
                <UserCheck className="mr-2 h-4 w-4" />
                Pädagog:innen
              </TabsTrigger>
            </TabsList>
            <TabsContent value="groups" className="mt-4">
              <GroupsTab locationId={locationId} />
            </TabsContent>
            <TabsContent value="educators" className="mt-4">
              <EducatorsTab locationId={locationId} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
