"use client";

import { useState, useMemo, useEffect } from "react";
import {
  KanbanSquare,
  List,
  Plus,
  Calendar,
  User,
  AlertCircle,
  CheckCircle2,
  Clock,
  Trash2,
  Edit,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/toast";
import { usePermissions } from "@/hooks/use-permissions";
import { useAuth } from "@/hooks/use-auth";
import { useLocations } from "@/hooks/use-locations";
import {
  useTaskBoard,
  useTasks,
  useCreateTask,
  useUpdateTask,
  useChangeTaskStatus,
  useDeleteTask,
} from "@/hooks/use-tasks";
import type {
  Task,
  TaskCreate,
  TaskStatus,
  TaskPriority,
} from "@/types/models";
import {
  TASK_STATUS_LABELS,
  TASK_PRIORITY_LABELS,
  TASK_PRIORITY_COLORS,
} from "@/types/models";
import api from "@/lib/api";
import type { User as UserType, PaginatedResponse } from "@/types/models";

/* ───── Helper Components ────────────────────────────────────────────────── */

function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const colors: Record<TaskPriority, string> = {
    low: "bg-green-500/20 text-green-400 border-green-500/30",
    medium: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    high: "bg-red-500/20 text-red-400 border-red-500/30",
  };
  return (
    <Badge variant="outline" className={colors[priority]}>
      {TASK_PRIORITY_LABELS[priority]}
    </Badge>
  );
}

function StatusBadge({ status }: { status: TaskStatus }) {
  const colors: Record<TaskStatus, string> = {
    open: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    in_progress: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    done: "bg-green-500/20 text-green-400 border-green-500/30",
  };
  return (
    <Badge variant="outline" className={colors[status]}>
      {TASK_STATUS_LABELS[status]}
    </Badge>
  );
}

function DueDateDisplay({ date, isOverdue }: { date: string; isOverdue: boolean }) {
  const formatted = new Date(date).toLocaleDateString("de-AT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  return (
    <span className={`flex items-center gap-1 text-sm ${isOverdue ? "text-red-400 font-medium" : "text-muted-foreground"}`}>
      <Calendar className="h-3.5 w-3.5" />
      {formatted}
      {isOverdue && <AlertCircle className="h-3.5 w-3.5" />}
    </span>
  );
}

/* ───── Kanban Card ──────────────────────────────────────────────────────── */

function TaskCard({
  task,
  onStatusChange,
  onEdit,
  canManage,
}: {
  task: Task;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  canManage: boolean;
}) {
  const nextStatus: Record<TaskStatus, TaskStatus | null> = {
    open: "in_progress",
    in_progress: "done",
    done: null,
  };
  const nextLabel: Record<TaskStatus, string> = {
    open: "Starten",
    in_progress: "Erledigen",
    done: "",
  };
  const next = nextStatus[task.status];

  return (
    <Card
      className={`mb-3 cursor-pointer transition-all hover:ring-1 hover:ring-primary/50 ${
        task.is_overdue ? "border-red-500/50" : ""
      }`}
      onClick={() => onEdit(task)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
          <PriorityBadge priority={task.priority} />
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="flex items-center gap-2 mb-3">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {task.assigned_to_name}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <DueDateDisplay date={task.due_date} isOverdue={task.is_overdue} />
          {next && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                onStatusChange(task.id, next);
              }}
            >
              {task.status === "open" ? (
                <Clock className="h-3 w-3 mr-1" />
              ) : (
                <CheckCircle2 className="h-3 w-3 mr-1" />
              )}
              {nextLabel[task.status]}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

/* ───── Kanban Column ────────────────────────────────────────────────────── */

function KanbanColumn({
  title,
  icon,
  tasks,
  color,
  onStatusChange,
  onEdit,
  canManage,
}: {
  title: string;
  icon: React.ReactNode;
  tasks: Task[];
  color: string;
  onStatusChange: (id: number, status: TaskStatus) => void;
  onEdit: (task: Task) => void;
  canManage: boolean;
}) {
  return (
    <div className={`flex-1 min-w-[280px] border-t-2 ${color} rounded-lg bg-muted/30 p-3`}>
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
        <Badge variant="secondary" className="ml-auto">
          {tasks.length}
        </Badge>
      </div>
      <div className="space-y-0">
        {tasks.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">
            Keine Aufgaben
          </p>
        ) : (
          tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onStatusChange={onStatusChange}
              onEdit={onEdit}
              canManage={canManage}
            />
          ))
        )}
      </div>
    </div>
  );
}

/* ───── Task Form Modal ──────────────────────────────────────────────────── */

function TaskFormModal({
  open,
  onOpenChange,
  task,
  onSave,
  onDelete,
  canManage,
  canEditAssignment,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  onSave: (data: TaskCreate, id?: number) => Promise<void>;
  onDelete?: (id: number) => Promise<void>;
  canManage: boolean;
  canEditAssignment: boolean;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = useState("");
  const [assignedTo, setAssignedTo] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // Load users for assignment dropdown
  const [users, setUsers] = useState<UserType[]>([]);
  useEffect(() => {
    api
      .get<PaginatedResponse<UserType>>("/users/?page_size=200&is_active=true")
      .then((res) => setUsers(res.data.results))
      .catch(() => {
        // Educators don't have access to /users/ - load colleagues via tasks
        // They can still see the current assignee
      });
  }, []);

  const { data: locationsData } = useLocations();
  const locations = locationsData?.results || [];

  // Pre-fill form when editing
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setPriority(task.priority);
      setDueDate(task.due_date);
      setAssignedTo(String(task.assigned_to));
      setLocationId(task.location ? String(task.location) : "");
    } else {
      setTitle("");
      setDescription("");
      setPriority("medium");
      setDueDate("");
      setAssignedTo("");
      setLocationId("");
    }
  }, [task, open]);

  const handleSubmit = async () => {
    if (!title.trim() || !dueDate || !assignedTo) return;
    setSaving(true);
    try {
      await onSave(
        {
          title: title.trim(),
          description: description.trim(),
          priority,
          due_date: dueDate,
          assigned_to: Number(assignedTo),
          location: locationId ? Number(locationId) : null,
        },
        task?.id
      );
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  // Determine if this is a read-only view (educator viewing task they can't edit)
  const isEditing = !!task;
  const canEditFields = canManage || canEditAssignment;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {task ? "Aufgabe bearbeiten" : "Neue Aufgabe"}
          </DialogTitle>
          <DialogDescription>
            {task
              ? canEditFields
                ? "Bearbeiten Sie die Aufgabendetails."
                : "Aufgabendetails anzeigen."
              : "Erstellen Sie eine neue Aufgabe und weisen Sie sie zu."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label htmlFor="task-title">Titel *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Aufgabentitel eingeben"
              disabled={isEditing && !canManage}
            />
          </div>

          <div>
            <Label htmlFor="task-desc">Beschreibung</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optionale Beschreibung"
              rows={3}
              disabled={isEditing && !canManage}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="task-priority">Priorität</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as TaskPriority)}
                disabled={isEditing && !canManage}
              >
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Niedrig</SelectItem>
                  <SelectItem value="medium">Mittel</SelectItem>
                  <SelectItem value="high">Hoch</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="task-due">Stichtag *</Label>
              <Input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                disabled={isEditing && !canManage}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="task-assigned">Zuweisen an *</Label>
            <Select
              value={assignedTo}
              onValueChange={setAssignedTo}
              disabled={isEditing && !canEditFields}
            >
              <SelectTrigger id="task-assigned">
                <SelectValue placeholder="Person auswählen" />
              </SelectTrigger>
              <SelectContent>
                {users.length > 0 ? (
                  users.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.first_name} {u.last_name} ({u.role === "educator" ? "Pädagogin" : u.role === "location_manager" ? "Standortleitung" : u.role_display || u.role})
                    </SelectItem>
                  ))
                ) : (
                  // Fallback: show current assignee when user list is not available
                  task && (
                    <SelectItem value={String(task.assigned_to)}>
                      {task.assigned_to_name}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="task-location">Standort</Label>
            <Select
              value={locationId || "__none__"}
              onValueChange={(v) => setLocationId(v === "__none__" ? "" : v)}
              disabled={isEditing && !canManage}
            >
              <SelectTrigger id="task-location">
                <SelectValue placeholder="Optional" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Kein Standort</SelectItem>
                {locations.map((loc) => (
                  <SelectItem key={loc.id} value={String(loc.id)}>
                    {loc.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          {task && canManage && onDelete && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                onDelete(task.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" />
              Löschen
            </Button>
          )}
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {canEditFields ? "Abbrechen" : "Schließen"}
            </Button>
            {canEditFields && (
              <Button
                onClick={handleSubmit}
                disabled={saving || !title.trim() || !dueDate || !assignedTo}
              >
                {saving ? "Speichern..." : task ? "Aktualisieren" : "Erstellen"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ───── Main Page ────────────────────────────────────────────────────────── */

export default function TasksPage() {
  const toast = useToast();
  const { hasPermission } = usePermissions();
  const { user } = useAuth();
  const canManage = hasPermission("manage_tasks");

  // Educators can edit assignment on their own tasks (reassign)
  const isEducator = user?.role === "educator";
  const isLocationManager = user?.role === "location_manager";
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  const [view, setView] = useState<"board" | "list">("board");
  const [filterPriority, setFilterPriority] = useState<string>("");
  const [filterLocation, setFilterLocation] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  // Kanban tab for LocationManager: "location" (default) or "mine"
  const [kanbanTab, setKanbanTab] = useState<"location" | "mine">("location");

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Data hooks
  const boardParams = useMemo(
    () => ({
      priority: filterPriority || undefined,
      location: filterLocation ? Number(filterLocation) : undefined,
      // For LocationManager "mine" tab, filter by own user ID
      assigned_to: (isLocationManager && kanbanTab === "mine" && user?.id) ? user.id : undefined,
    }),
    [filterPriority, filterLocation, isLocationManager, kanbanTab, user?.id]
  );

  const listParams = useMemo(
    () => ({
      page,
      page_size: 20,
      priority: filterPriority || undefined,
      location: filterLocation ? Number(filterLocation) : undefined,
      search: searchQuery || undefined,
      ordering: "-created_at",
    }),
    [page, filterPriority, filterLocation, searchQuery]
  );

  const {
    data: boardData,
    loading: boardLoading,
    refetch: refetchBoard,
  } = useTaskBoard(boardParams);

  const {
    data: listData,
    loading: listLoading,
    refetch: refetchList,
  } = useTasks(listParams);

  const { createTask } = useCreateTask();
  const { updateTask } = useUpdateTask();
  const { changeStatus } = useChangeTaskStatus();
  const { deleteTask } = useDeleteTask();

  const { data: locationsData } = useLocations();
  const locations = locationsData?.results || [];

  const refetchAll = () => {
    refetchBoard();
    refetchList();
  };

  const handleStatusChange = async (taskId: number, newStatus: TaskStatus) => {
    const result = await changeStatus(taskId, newStatus);
    if (result) {
      toast.success("Status geändert", `Aufgabe auf "${TASK_STATUS_LABELS[newStatus]}" gesetzt.`);
      refetchAll();
    }
  };

  const handleSave = async (data: TaskCreate, id?: number) => {
    if (id) {
      const result = await updateTask(id, data);
      if (result) {
        toast.success("Aufgabe aktualisiert");
        refetchAll();
      }
    } else {
      const result = await createTask(data);
      if (result) {
        toast.success("Aufgabe erstellt");
        refetchAll();
      }
    }
  };

  const handleDelete = async (id: number) => {
    const success = await deleteTask(id);
    if (success) {
      toast.success("Aufgabe gelöscht");
      refetchAll();
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setModalOpen(true);
  };

  const handleCreate = () => {
    setEditingTask(null);
    setModalOpen(true);
  };

  // Determine if the current user can edit the assignment of the editing task
  const canEditAssignment = useMemo(() => {
    if (canManage) return true;
    // Educators can reassign tasks that are assigned to them
    if (isEducator && editingTask && editingTask.assigned_to === user?.id) {
      return true;
    }
    return false;
  }, [canManage, isEducator, editingTask, user?.id]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aufgaben</h1>
          <p className="text-muted-foreground">
            Aufgaben verwalten und im Kanban-Board organisieren
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggle */}
          <div className="flex border rounded-md">
            <Button
              variant={view === "board" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("board")}
              className="rounded-r-none"
            >
              <KanbanSquare className="h-4 w-4 mr-1" />
              Board
            </Button>
            <Button
              variant={view === "list" ? "default" : "ghost"}
              size="sm"
              onClick={() => setView("list")}
              className="rounded-l-none"
            >
              <List className="h-4 w-4 mr-1" />
              Liste
            </Button>
          </div>

          {canManage && (
            <Button onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" />
              Neue Aufgabe
            </Button>
          )}
        </div>
      </div>

      {/* Kanban Tab for LocationManager */}
      {(isLocationManager || isAdmin) && view === "board" && (
        <div className="flex border rounded-md w-fit">
          <Button
            variant={kanbanTab === "location" ? "default" : "ghost"}
            size="sm"
            onClick={() => setKanbanTab("location")}
            className="rounded-r-none"
          >
            Standort-Aufgaben
          </Button>
          <Button
            variant={kanbanTab === "mine" ? "default" : "ghost"}
            size="sm"
            onClick={() => setKanbanTab("mine")}
            className="rounded-l-none"
          >
            Meine Aufgaben
          </Button>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        {view === "list" && (
          <Input
            placeholder="Aufgaben suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-xs"
          />
        )}
        <Select value={filterPriority || "__all__"} onValueChange={(v) => setFilterPriority(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Alle Prioritäten" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Prioritäten</SelectItem>
            <SelectItem value="high">Hoch</SelectItem>
            <SelectItem value="medium">Mittel</SelectItem>
            <SelectItem value="low">Niedrig</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterLocation || "__all__"} onValueChange={(v) => setFilterLocation(v === "__all__" ? "" : v)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Alle Standorte" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Alle Standorte</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc.id} value={String(loc.id)}>
                {loc.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Separator />

      {/* Board View */}
      {view === "board" && (
        <div className="flex gap-6 overflow-x-auto pb-4">
          <KanbanColumn
            title="Offen"
            icon={<AlertCircle className="h-5 w-5 text-blue-400" />}
            tasks={boardData?.open || []}
            color="border-blue-500"
            onStatusChange={handleStatusChange}
            onEdit={handleEdit}
            canManage={canManage}
          />
          <KanbanColumn
            title="In Arbeit"
            icon={<Clock className="h-5 w-5 text-yellow-400" />}
            tasks={boardData?.in_progress || []}
            color="border-yellow-500"
            onStatusChange={handleStatusChange}
            onEdit={handleEdit}
            canManage={canManage}
          />
          <KanbanColumn
            title="Erledigt"
            icon={<CheckCircle2 className="h-5 w-5 text-green-400" />}
            tasks={boardData?.done || []}
            color="border-green-500"
            onStatusChange={handleStatusChange}
            onEdit={handleEdit}
            canManage={canManage}
          />
        </div>
      )}

      {/* List View */}
      {view === "list" && (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Titel</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priorität</TableHead>
                  <TableHead>Zugewiesen an</TableHead>
                  <TableHead>Stichtag</TableHead>
                  <TableHead>Erstellt von</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {listData?.results.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Keine Aufgaben gefunden
                    </TableCell>
                  </TableRow>
                ) : (
                  listData?.results.map((task) => (
                    <TableRow
                      key={task.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleEdit(task)}
                    >
                      <TableCell className="font-medium">
                        {task.title}
                        {task.is_overdue && (
                          <AlertCircle className="inline h-4 w-4 text-red-400 ml-1" />
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={task.status} />
                      </TableCell>
                      <TableCell>
                        <PriorityBadge priority={task.priority} />
                      </TableCell>
                      <TableCell>{task.assigned_to_name}</TableCell>
                      <TableCell>
                        <DueDateDisplay
                          date={task.due_date}
                          isOverdue={task.is_overdue}
                        />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {task.created_by_name}
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {listData && listData.total_pages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t">
                <span className="text-sm text-muted-foreground">
                  {listData.count} Aufgaben insgesamt
                </span>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Zurück
                  </Button>
                  <span className="flex items-center text-sm px-2">
                    Seite {page} von {listData.total_pages}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= listData.total_pages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Weiter
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Task Form Modal */}
      <TaskFormModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        task={editingTask}
        onSave={handleSave}
        onDelete={canManage ? handleDelete : undefined}
        canManage={canManage}
        canEditAssignment={canEditAssignment}
      />
    </div>
  );
}
