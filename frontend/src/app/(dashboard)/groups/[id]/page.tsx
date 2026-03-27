"use client";

import { use, useState } from "react";
import {
  useGroup,
  useGroupMembers,
  useAddGroupMember,
  useRemoveGroupMember,
  useStudents,
  useCreateStudent,
  useDeleteStudent,
} from "@/hooks/use-groups";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { StatusBadge } from "@/components/common/status-badge";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { QueryError } from "@/components/common/error-boundary";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { StudentForm } from "@/components/forms/student-form";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDate } from "@/lib/format";
import type { StudentFormData } from "@/lib/validations";
import {
  ArrowLeft,
  Users,
  GraduationCap,
  Wallet,
  Plus,
  UserPlus,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export default function GroupDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const groupId = parseInt(id, 10);
  const toast = useToast();

  // Add member dialog state
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberUserId, setMemberUserId] = useState("");
  const [memberRole, setMemberRole] = useState("educator");

  // Add student dialog state
  const [studentFormOpen, setStudentFormOpen] = useState(false);

  // Remove member dialog state
  const [removeMemberOpen, setRemoveMemberOpen] = useState(false);
  const [removeMemberId, setRemoveMemberId] = useState<number | null>(null);

  // Delete student dialog state
  const [deleteStudentOpen, setDeleteStudentOpen] = useState(false);
  const [deleteStudentId, setDeleteStudentId] = useState<number | null>(null);

  const { data: group, isLoading: loadingGroup, error, refetch } = useGroup(groupId);
  const { data: members, isLoading: loadingMembers } = useGroupMembers(groupId);
  const { data: students, isLoading: loadingStudents } = useStudents({
    group: groupId,
  });

  const addMemberMutation = useAddGroupMember();
  const removeMemberMutation = useRemoveGroupMember();
  const createStudentMutation = useCreateStudent();
  const deleteStudentMutation = useDeleteStudent();

  const handleAddMember = () => {
    if (memberUserId) {
      addMemberMutation.mutate(
        { groupId, userId: parseInt(memberUserId, 10), role: memberRole },
        {
          onSuccess: () => {
            toast.success("Mitglied hinzugefügt");
            setAddMemberOpen(false);
            setMemberUserId("");
            setMemberRole("educator");
          },
          onError: () => toast.error("Fehler", "Mitglied konnte nicht hinzugefügt werden."),
        }
      );
    }
  };

  const handleRemoveMember = () => {
    if (removeMemberId) {
      removeMemberMutation.mutate(
        { groupId, userId: removeMemberId },
        {
          onSuccess: () => {
            toast.success("Mitglied entfernt");
            setRemoveMemberOpen(false);
            setRemoveMemberId(null);
          },
          onError: () => toast.error("Fehler", "Mitglied konnte nicht entfernt werden."),
        }
      );
    }
  };

  const handleCreateStudent = async (formData: StudentFormData) => {
    await createStudentMutation.mutateAsync(
      { ...formData, group: groupId },
      {
        onSuccess: () => {
          toast.success("Kind hinzugefügt");
          setStudentFormOpen(false);
        },
        onError: (err) => {
          toast.error("Fehler", "Kind konnte nicht hinzugefügt werden.");
          throw err;
        },
      }
    );
  };

  const handleDeleteStudent = () => {
    if (deleteStudentId) {
      deleteStudentMutation.mutate(deleteStudentId, {
        onSuccess: () => {
          toast.success("Kind entfernt");
          setDeleteStudentOpen(false);
          setDeleteStudentId(null);
        },
        onError: () => toast.error("Fehler", "Kind konnte nicht entfernt werden."),
      });
    }
  };

  if (error) return <QueryError error={error} onRetry={() => refetch()} />;
  if (loadingGroup) return <PageSkeleton rows={4} columns={4} />;
  if (!group) return <div>Gruppe nicht gefunden.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/groups/list">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <PageHeader
          title={group.name}
          description={group.description || "Keine Beschreibung"}
        >
          <Badge variant={group.is_active ? "success" : "secondary"}>
            {group.is_active ? "Aktiv" : "Inaktiv"}
          </Badge>
        </PageHeader>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kontostand
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                Number(group.balance) >= 0
                  ? "text-green-600 dark:text-green-400"
                  : "text-red-600 dark:text-red-400"
              }`}
            >
              {formatCurrency(group.balance)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Mitglieder
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {members?.length ?? 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Kinder
            </CardTitle>
            <GraduationCap className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {students?.count ?? 0}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="members" className="space-y-4">
        <TabsList>
          <TabsTrigger value="members">
            <Users className="mr-2 h-4 w-4" />
            Mitglieder
          </TabsTrigger>
          <TabsTrigger value="students">
            <GraduationCap className="mr-2 h-4 w-4" />
            Kinder
          </TabsTrigger>
          <TabsTrigger value="info">Info</TabsTrigger>
        </TabsList>

        {/* Members Tab */}
        <TabsContent value="members">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Gruppenmitglieder</CardTitle>
                <CardDescription>
                  Pädagog:innen und Assistent:innen in dieser Gruppe.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setAddMemberOpen(true)}>
                <UserPlus className="mr-2 h-4 w-4" />
                Mitglied hinzufügen
              </Button>
            </CardHeader>
            <CardContent>
              {loadingMembers ? (
                <p className="text-sm text-muted-foreground">Laden...</p>
              ) : members && members.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Rolle</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Seit
                      </TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          {m.first_name && m.last_name
                            ? `${m.first_name} ${m.last_name}`
                            : m.user_name || `Benutzer #${m.user_id}`}
                        </TableCell>
                        <TableCell>
                          <StatusBadge status={m.role} />
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {formatDate(m.joined_at)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setRemoveMemberId(m.id);
                              setRemoveMemberOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Keine Mitglieder in dieser Gruppe.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Students Tab */}
        <TabsContent value="students">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Kinder</CardTitle>
                <CardDescription>
                  Kinder, die dieser Gruppe zugeordnet sind.
                </CardDescription>
              </div>
              <Button size="sm" onClick={() => setStudentFormOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Kind hinzufügen
              </Button>
            </CardHeader>
            <CardContent>
              {loadingStudents ? (
                <p className="text-sm text-muted-foreground">Laden...</p>
              ) : students?.results && students.results.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vorname</TableHead>
                      <TableHead>Nachname</TableHead>
                      <TableHead className="hidden sm:table-cell">
                        Geburtsdatum
                      </TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="w-[50px]" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {students.results.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell className="font-medium">
                          {s.first_name}
                        </TableCell>
                        <TableCell>{s.last_name}</TableCell>
                        <TableCell className="hidden sm:table-cell">
                          {s.date_of_birth
                            ? formatDate(s.date_of_birth)
                            : "–"}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={s.is_active ? "success" : "secondary"}
                          >
                            {s.is_active ? "Aktiv" : "Inaktiv"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive"
                            onClick={() => {
                              setDeleteStudentId(s.id);
                              setDeleteStudentOpen(true);
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Keine Kinder in dieser Gruppe.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Info Tab */}
        <TabsContent value="info">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Gruppendetails</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Gruppenleitung
                  </p>
                  <p className="mt-1 text-sm">
                    {group.leader
                      ? `${group.leader.first_name} ${group.leader.last_name}`
                      : "Nicht zugewiesen"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Schuljahr
                  </p>
                  <p className="mt-1 text-sm">
                    {group.school_year_name || "–"}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Erstellt am
                  </p>
                  <p className="mt-1 text-sm">{formatDate(group.created_at)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Zuletzt aktualisiert
                  </p>
                  <p className="mt-1 text-sm">
                    {formatDate(group.updated_at)}
                  </p>
                </div>
              </div>
              {group.description && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">
                      Beschreibung
                    </p>
                    <p className="mt-1 text-sm">{group.description}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Member Dialog */}
      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitglied hinzufügen</DialogTitle>
            <DialogDescription>
              Füge ein neues Mitglied zu dieser Gruppe hinzu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-user-id">Benutzer-ID</Label>
              <Input
                id="member-user-id"
                type="number"
                value={memberUserId}
                onChange={(e) => setMemberUserId(e.target.value)}
                placeholder="Benutzer-ID eingeben"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Rolle</Label>
              <Select value={memberRole} onValueChange={setMemberRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="educator">Pädagog:in</SelectItem>
                  <SelectItem value="assistant">Assistent:in</SelectItem>
                  <SelectItem value="substitute">Vertretung</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddMemberOpen(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleAddMember}
              disabled={!memberUserId || addMemberMutation.isPending}
            >
              {addMemberMutation.isPending ? "Wird hinzugefügt..." : "Hinzufügen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Create Dialog */}
      <StudentForm
        open={studentFormOpen}
        onOpenChange={setStudentFormOpen}
        groups={[group]}
        onSubmit={handleCreateStudent}
        isLoading={createStudentMutation.isPending}
      />

      {/* Remove Member Dialog */}
      <ConfirmDialog
        open={removeMemberOpen}
        onOpenChange={setRemoveMemberOpen}
        title="Mitglied entfernen"
        description="Möchtest du dieses Mitglied wirklich aus der Gruppe entfernen?"
        confirmLabel="Entfernen"
        variant="destructive"
        onConfirm={handleRemoveMember}
        isLoading={removeMemberMutation.isPending}
      />

      {/* Delete Student Dialog */}
      <ConfirmDialog
        open={deleteStudentOpen}
        onOpenChange={setDeleteStudentOpen}
        title="Kind entfernen"
        description="Möchtest du dieses Kind wirklich aus der Gruppe entfernen?"
        confirmLabel="Entfernen"
        variant="destructive"
        onConfirm={handleDeleteStudent}
        isLoading={deleteStudentMutation.isPending}
      />
    </div>
  );
}
