/**
 * TypeScript type definitions for the GTS Planer data models.
 * These types mirror the Django REST Framework serializers.
 *
 * IMPORTANT: Keep in sync with backend serializers.
 * Last synced: Sprint 34 (2026-03-27)
 */

// ─── Enums ───────────────────────────────────────────────────────────────────

export type UserRole = "educator" | "location_manager" | "admin" | "super_admin";
export type TransactionType = "income" | "expense";
export type TransactionStatus = "pending" | "approved" | "rejected";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";
export type CategoryType = "income" | "expense";
export type GroupMemberRole = "educator" | "assistant" | "substitute";

// ─── Core ────────────────────────────────────────────────────────────────────

export interface User {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  role_display?: string;
  organization: number | null;
  organization_detail?: { id: number; name: string } | null;
  location: number | null;
  location_detail?: { id: number; name: string; city: string } | null;
  location_name?: string;
  phone: string;
  profile_picture: string | null;
  is_active: boolean;
  is_deleted: boolean;
  last_login: string | null;
  date_joined: string;
}

export interface UserCompact {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  role: UserRole;
}

export type OrganizationType = "main_tenant" | "sub_tenant";

export interface Organization {
  id: number;
  name: string;
  description: string;
  org_type: OrganizationType;
  parent: number | null;
  parent_name?: string;
  email: string;
  phone: string;
  website: string;
  street: string;
  city: string;
  postal_code: string;
  country: string;
  logo: string | null;
  is_active: boolean;
  children_count?: number;
  location_count?: number;
  created_at: string;
  updated_at: string;
}

export interface LocationUserCompact {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
}

export interface LocationGroupCompact {
  id: number;
  name: string;
  leader_name: string | null;
  leader_id: number | null;
  student_count: number;
  member_count: number;
  is_active: boolean;
}

export interface Location {
  id: number;
  organization: number;
  organization_name?: string;
  name: string;
  description: string;
  email: string;
  phone: string;
  street: string;
  city: string;
  postal_code: string;
  manager: LocationUserCompact | null;
  groups?: LocationGroupCompact[];
  group_count?: number;
  student_count?: number;
  educator_count?: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

export interface LocationCreate {
  name: string;
  description?: string;
  organization: number;
  manager?: number | null;
  street?: string;
  city?: string;
  postal_code?: string;
  email?: string;
  phone?: string;
}

export interface LocationStats {
  location_id: number;
  location_name: string;
  total_groups: number;
  active_groups: number;
  total_students: number;
  active_students: number;
  total_educators: number;
  location_managers: number;
  educators: number;
}

// ─── Finance ─────────────────────────────────────────────────────────────────

export interface TransactionCategory {
  id: number;
  name: string;
  description: string;
  category_type: CategoryType;
  /** Color hex code for UI display */
  color?: string;
  /** Icon identifier */
  icon?: string;
  /** Whether this is a system-defined category */
  is_system_category?: boolean;
  is_active: boolean;
  created_at: string;
}

export interface Transaction {
  id: number;
  group: number;
  group_name?: string;
  category: number;
  category_name?: string;
  description: string;
  amount: string;
  transaction_type: TransactionType;
  transaction_date: string;
  status: TransactionStatus;
  created_by: UserCompact | null;
  approved_by: UserCompact | null;
  approved_at: string | null;
  rejection_reason: string;
  notes: string;
  receipts?: Receipt[];
  created_at: string;
  updated_at: string;
}

export interface TransactionCreate {
  group: number;
  category: number;
  description: string;
  amount: number;
  transaction_type: TransactionType;
  transaction_date: string;
  notes?: string;
}

export interface Receipt {
  id: number;
  /** URL to the receipt file (from backend file_url field) */
  file_url: string;
  file_name: string;
  file_size: number;
  file_type: string;
  /** Description of the receipt */
  description?: string;
  uploaded_by: UserCompact | null;
  created_at: string;
}

export interface GroupBalance {
  group_id: number;
  group_name: string;
  total_income: string;
  total_expenses: string;
  balance: string;
}

// ─── Timetracking ────────────────────────────────────────────────────────────

export interface TimeEntry {
  id: number;
  user: number;
  user_name?: string;
  group: number;
  group_name?: string;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes: number;
  duration_minutes: number;
  /** Duration in hours (calculated by backend) */
  duration_hours?: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface TimeEntryCreate {
  group: number;
  date: string;
  start_time: string;
  end_time: string;
  break_minutes?: number;
  notes?: string;
}

export interface LeaveType {
  id: number;
  name: string;
  description: string;
  /** Whether leave of this type requires manager approval */
  requires_approval?: boolean;
  /** Maximum days per year for this leave type */
  max_days_per_year?: number | null;
  /** Whether this is a system-defined leave type */
  is_system_type?: boolean;
  is_active: boolean;
  created_at: string;
}

export interface LeaveRequest {
  id: number;
  user: { id: number; first_name: string; last_name: string } | number;
  user_name?: string;
  leave_type: { id: number; name: string } | number;
  leave_type_name?: string;
  start_date: string;
  end_date: string;
  total_days: number;
  reason: string;
  status: LeaveRequestStatus;
  approved_by: UserCompact | null;
  approved_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface LeaveRequestCreate {
  leave_type: number;
  start_date: string;
  end_date: string;
  reason?: string;
}

// ─── Groups ──────────────────────────────────────────────────────────────────

export interface SchoolYear {
  id: number;
  name: string;
  location: number;
  /** Location name (from backend location_name field) */
  location_name?: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  semesters?: Semester[];
  created_at: string;
}

export interface Semester {
  id: number;
  school_year: number;
  name: string;
  /** Display name (e.g. "1. Semester") */
  name_display?: string;
  start_date: string;
  end_date: string;
  /** Whether this semester is currently active */
  is_active?: boolean;
  created_at?: string;
}

export interface Group {
  id: number;
  name: string;
  description: string;
  location: number;
  location_name?: string;
  school_year: number;
  school_year_name?: string;
  /** Leader as nested object from GroupListSerializer / GroupDetailSerializer */
  leader?: UserCompact | null;
  /** @deprecated Use leader.id instead */
  group_leader?: number | null;
  /** @deprecated Use leader.first_name + leader.last_name instead */
  group_leader_name?: string;
  balance: string;
  currency?: string;
  max_children?: number | null;
  is_active: boolean;
  member_count?: number;
  student_count?: number;
  /** Members array (only in detail view) */
  members?: GroupMember[];
  /** Students array (only in detail view) */
  students?: Student[];
  created_at: string;
  updated_at: string;
}

export interface GroupCreate {
  name: string;
  description?: string;
  location: number;
  school_year: number;
  group_leader?: number;
}

export interface GroupMember {
  id: number;
  /** User ID from the backend GroupMemberSerializer */
  user_id: number;
  /** User's first name */
  first_name: string;
  /** User's last name */
  last_name: string;
  /** User's system role */
  user_role?: UserRole;
  /** @deprecated Use user_id instead */
  user?: number | UserCompact;
  /** @deprecated Use first_name + last_name instead */
  user_name?: string;
  group?: number;
  /** Role within the group (educator, assistant, substitute) */
  role: GroupMemberRole;
  is_active?: boolean;
  joined_at: string;
  left_at?: string | null;
}

export interface Student {
  id: number;
  first_name: string;
  last_name: string;
  group: number;
  group_name?: string;
  date_of_birth: string | null;
  enrollment_date: string | null;
  notes: string;
  is_active: boolean;
  created_at: string;
}

export interface StudentCreate {
  first_name: string;
  last_name: string;
  group: number;
  date_of_birth?: string;
  enrollment_date?: string;
  notes?: string;
}

// ─── Weekly Plans ───────────────────────────────────────────────────────────

export type WeeklyPlanStatus = "draft" | "published";

export type DayOfWeek = 0 | 1 | 2 | 3 | 4;

export const DAY_NAMES: Record<DayOfWeek, string> = {
  0: "Montag",
  1: "Dienstag",
  2: "Mittwoch",
  3: "Donnerstag",
  4: "Freitag",
};

export const ENTRY_CATEGORIES = [
  { value: "lernen", label: "Lernen", color: "#3B82F6" },
  { value: "bewegung", label: "Bewegung", color: "#22C55E" },
  { value: "kreativ", label: "Kreativ", color: "#A855F7" },
  { value: "essen", label: "Essen", color: "#F97316" },
  { value: "freizeit", label: "Freizeit", color: "#EAB308" },
  { value: "musik", label: "Musik", color: "#EC4899" },
  { value: "natur", label: "Natur", color: "#14B8A6" },
  { value: "sozial", label: "Soziales Lernen", color: "#6366F1" },
  { value: "ruhe", label: "Ruhezeit", color: "#94A3B8" },
  { value: "sonstiges", label: "Sonstiges", color: "#78716C" },
] as const;

export interface DailyActivity {
  id?: number;
  day_of_week: DayOfWeek;
  day_name?: string;
  content: string;
}

export interface WeeklyPlanEntry {
  id?: number;
  day_of_week: DayOfWeek;
  day_name?: string;
  start_time: string;
  end_time: string;
  activity: string;
  description: string;
  color: string;
  category: string;
  sort_order: number;
}

export interface WeeklyPlan {
  id: number;
  group: number;
  group_name: string;
  location_name: string;
  week_start_date: string;
  week_end_date?: string;
  calendar_week: number;
  title: string;
  weekly_theme?: string;
  notes?: string;
  school_year?: number;
  school_year_name?: string;
  leader_name?: string;
  status: WeeklyPlanStatus;
  is_template: boolean;
  template_name?: string;
  created_by: number;
  created_by_name: string;
  entry_count?: number;
  entries?: WeeklyPlanEntry[];
  daily_activities?: DailyActivity[];
  weekly_theme_preview?: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlanCreate {
  group: number;
  week_start_date: string;
  title: string;
  weekly_theme?: string;
  notes?: string;
  school_year?: number;
  status?: WeeklyPlanStatus;
  is_template?: boolean;
  template_name?: string;
  entries?: Omit<WeeklyPlanEntry, "id" | "day_name">[];
  daily_activities?: Omit<DailyActivity, "id" | "day_name">[];
}

// ─── System ──────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: number;
  user: number | null;
  user_name?: string;
  action: string;
  model_name: string;
  object_id: string;
  changes: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string;
  created_at: string;
}

export interface SystemSetting {
  id: number;
  key: string;
  value: string;
  description: string;
  created_at: string;
  updated_at: string;
}

// ─── API Response Types ──────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  count: number;
  total_pages: number;
  current_page: number;
  page_size: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface ApiError {
  detail: string;
  code?: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  role: string;
  locations_count: number;
  groups_count: number;
  students_count: number;
  transactions_count: number;
  time_entries_count: number;
  weeklyplans_count: number;
  educators_count: number;
  pending_leave_requests: number;
  pending_transactions: number;
  total_income: number;
  total_expense: number;
  recent_time_entries: DashboardRecentTimeEntry[];
  recent_transactions: DashboardRecentTransaction[];
  recent_leave_requests: DashboardRecentLeaveRequest[];
}

export interface DashboardRecentTimeEntry {
  id: number;
  date: string;
  duration_minutes: number;
  notes: string | null;
  start_time: string;
  end_time: string;
  user__first_name: string;
  user__last_name: string;
  group__name: string;
}

export interface DashboardRecentTransaction {
  id: number;
  transaction_date: string;
  amount: string;
  description: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  created_by__first_name: string;
  created_by__last_name: string;
  group__name: string;
}

export interface DashboardRecentLeaveRequest {
  id: number;
  start_date: string;
  end_date: string;
  status: LeaveRequestStatus;
  user__first_name: string;
  user__last_name: string;
  leave_type__name: string;
}

/* ───── Attendance ─────────────────────────────────────────────────────────── */

export type AttendanceStatus = "present" | "absent" | "sick" | "excused";

export interface Attendance {
  id: number;
  student: number;
  group: number;
  date: string;
  status: AttendanceStatus;
  status_display: string;
  notes: string;
  recorded_by: number | null;
  recorded_by_name: string | null;
  student_name: string;
  protocol_id: number | null;
  created_at: string;
  updated_at: string;
}

/* ───── Group Transfers ──────────────────────────────────────────────────── */

export type GroupTransferStatus =
  | "pending"
  | "confirmed"
  | "rejected"
  | "completed"
  | "cancelled";

export interface GroupTransfer {
  id: number;
  student: number;
  student_name: string;
  source_group: number;
  source_group_name: string;
  target_group: number;
  target_group_name: string;
  transfer_date: string;
  start_time: string;
  end_time: string | null;
  reason: string;
  notes: string;
  status: GroupTransferStatus;
  status_display: string;
  requested_by: number;
  requested_by_name: string;
  confirmed_by: number | null;
  confirmed_by_name: string;
  confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupTransferCreate {
  student: number;
  source_group: number;
  target_group: number;
  transfer_date: string;
  start_time: string;
  end_time?: string;
  reason?: string;
  notes?: string;
}

/* ───── Student Contacts ─────────────────────────────────────────────────── */

export type StudentContactRelationship =
  | "parent"
  | "uncle"
  | "aunt"
  | "grandparent"
  | "relative"
  | "authorized";

export const RELATIONSHIP_LABELS: Record<StudentContactRelationship, string> = {
  parent: "Elternteil",
  uncle: "Onkel",
  aunt: "Tante",
  grandparent: "Oma/Opa",
  relative: "Verwandter",
  authorized: "Abholberechtigte Person",
};

export interface StudentContact {
  id: number;
  student: number;
  student_name: string;
  is_primary: boolean;
  relationship: StudentContactRelationship;
  relationship_display: string;
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  whatsapp_available: boolean;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface StudentContactCreate {
  student: number;
  is_primary: boolean;
  relationship: StudentContactRelationship;
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  whatsapp_available?: boolean;
  notes?: string;
}

/* ───── School Calendar ────────────────────────────────────────────────── */

export interface HolidayPeriod {
  id: number;
  school_year: number;
  name: string;
  start_date: string;
  end_date: string;
  created_at: string;
  updated_at: string;
}

export interface AutonomousDay {
  id: number;
  school_year: number;
  name: string;
  date: string;
  description: string;
  created_at: string;
  updated_at: string;
}

/* ───── Daily Protocol ─────────────────────────────────────────────────── */

export type IncidentSeverity = "normal" | "important" | "urgent";

export const SEVERITY_LABELS: Record<IncidentSeverity, string> = {
  normal: "Normal",
  important: "Wichtig",
  urgent: "Dringend",
};

export const SEVERITY_COLORS: Record<IncidentSeverity, string> = {
  normal: "#22C55E",
  important: "#F97316",
  urgent: "#EF4444",
};

export interface DailyProtocol {
  id: number;
  student: number;
  student_name: string;
  date: string;
  group: number;
  group_name: string;
  effective_group: number | null;
  effective_group_name: string;
  transfer: number | null;
  has_transfer: boolean;
  school_year: number | null;
  school_year_name: string;
  arrival_time: string | null;
  arrival_notes: string;
  incidents: string;
  incident_severity: IncidentSeverity;
  pickup_time: string | null;
  picked_up_by: number | null;
  picked_up_by_name: string;
  pickup_notes: string;
  recorded_by: number | null;
  recorded_by_name: string;
  attendance_status: AttendanceStatus | "";
  created_at: string;
  updated_at: string;
}

export interface DailyProtocolCreate {
  student: number;
  date: string;
  group?: number;
  effective_group?: number | null;
  transfer?: number | null;
  school_year?: number | null;
  arrival_time?: string | null;
  arrival_notes?: string;
  incidents?: string;
  incident_severity?: IncidentSeverity;
  pickup_time?: string | null;
  picked_up_by?: number | null;
  pickup_notes?: string;
}

export interface BulkDailyProtocolRecord {
  student_id: number;
  arrival_time?: string | null;
  arrival_notes?: string;
  incidents?: string;
  incident_severity?: IncidentSeverity;
  pickup_time?: string | null;
  picked_up_by_id?: number | null;
  pickup_notes?: string;
}

export interface BulkDailyProtocolPayload {
  group_id: number;
  date: string;
  school_year_id?: number | null;
  records: BulkDailyProtocolRecord[];
}

/* ───── Events / Veranstaltungen ─────────────────────────────────────────── */

export type EventType = "excursion" | "celebration" | "workshop" | "sports" | "cultural" | "other";
export type EventStatus = "draft" | "planned" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type ConsentStatus = "pending" | "granted" | "denied" | "not_required";
export type AttendanceEventStatus = "registered" | "attended" | "absent" | "cancelled";

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  excursion: "Ausflug",
  celebration: "Feier",
  workshop: "Workshop",
  sports: "Sport",
  cultural: "Kulturell",
  other: "Sonstiges",
};

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  draft: "Entwurf",
  planned: "Geplant",
  confirmed: "Bestätigt",
  in_progress: "Laufend",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
};

export const CONSENT_STATUS_LABELS: Record<ConsentStatus, string> = {
  pending: "Ausstehend",
  granted: "Erteilt",
  denied: "Verweigert",
  not_required: "Nicht erforderlich",
};

export interface Event {
  id: number;
  title: string;
  description: string;
  event_type: EventType;
  status: EventStatus;
  start_date: string;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string;
  meeting_point: string;
  requires_consent: boolean;
  consent_deadline: string | null;
  estimated_cost: string | null;
  total_cost: string | null;
  max_participants: number | null;
  notes: string;
  location: number;
  location_name?: string;
  school_year: number | null;
  school_year_name?: string;
  groups: number[];
  group_names?: string[];
  created_by: number;
  created_by_name?: string;
  participant_count?: number;
  consent_count?: number;
  transactions?: Transaction[];
  created_at: string;
  updated_at: string;
}

export interface EventCreate {
  title: string;
  description?: string;
  event_type: EventType;
  status?: EventStatus;
  start_date: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  venue?: string;
  meeting_point?: string;
  requires_consent?: boolean;
  consent_deadline?: string;
  estimated_cost?: number;
  max_participants?: number;
  notes?: string;
  location: number;
  school_year?: number;
  groups?: number[];
}

export interface EventParticipant {
  id: number;
  event: number;
  student: number;
  student_name: string;
  student_group_name?: string;
  consent_status: ConsentStatus;
  consent_date: string | null;
  consent_given_by: string;
  consent_notes: string;
  attendance_status: AttendanceEventStatus;
  notes: string;
}

export interface EventStats {
  total_participants: number;
  consent_granted: number;
  consent_denied: number;
  consent_pending: number;
  attended: number;
  consent_rate: number;
  attendance_rate: number;
  total_cost: string | null;
}

/* ───── Finance Monthly Summary ──────────────────────────────────────────── */

export interface MonthlyFinanceSummary {
  month: string;
  month_label: string;
  income: number;
  expenses: number;
  net: number;
  transaction_count: number;
  opening_balance: number;
  closing_balance: number;
}


/* ───── Task Management ──────────────────────────────────────────────────── */

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Offen",
  in_progress: "In Arbeit",
  done: "Erledigt",
};

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  low: "Niedrig",
  medium: "Mittel",
  high: "Hoch",
};

export const TASK_PRIORITY_COLORS: Record<TaskPriority, string> = {
  low: "#22C55E",
  medium: "#F97316",
  high: "#EF4444",
};

export interface Task {
  id: number;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_date: string;
  created_by: number;
  created_by_name: string;
  assigned_to: number;
  assigned_to_name: string;
  location: number | null;
  location_name: string | null;
  group: number | null;
  group_name: string | null;
  is_overdue: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface TaskCreate {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  due_date: string;
  assigned_to: number;
  location?: number | null;
  group?: number | null;
}

export interface TaskBoard {
  open: Task[];
  in_progress: Task[];
  done: Task[];
}

/* ───── In-App Notifications ─────────────────────────────────────────────── */

export type NotificationType = "task_status_changed" | "task_assigned" | "task_overdue";

export interface InAppNotification {
  id: number;
  title: string;
  message: string;
  notification_type: NotificationType;
  related_task: number | null;
  related_task_title: string | null;
  is_read: boolean;
  created_at: string;
}
