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
  location: number | null;
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
  { value: "learning", label: "Lernzeit", color: "#3B82F6" },
  { value: "sports", label: "Sport & Bewegung", color: "#EF4444" },
  { value: "creative", label: "Kreativ", color: "#8B5CF6" },
  { value: "social", label: "Sozial", color: "#F59E0B" },
  { value: "outdoor", label: "Outdoor", color: "#10B981" },
  { value: "meal", label: "Mahlzeit", color: "#78716C" },
  { value: "free_time", label: "Freizeit", color: "#06B6D4" },
] as const;

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
  calendar_week: number;
  title: string;
  notes?: string;
  status: WeeklyPlanStatus;
  is_template: boolean;
  template_name?: string;
  created_by: number;
  created_by_name: string;
  entry_count?: number;
  entries?: WeeklyPlanEntry[];
  created_at: string;
  updated_at: string;
}

export interface WeeklyPlanCreate {
  group: number;
  week_start_date: string;
  title: string;
  notes?: string;
  status?: WeeklyPlanStatus;
  is_template?: boolean;
  template_name?: string;
  entries?: Omit<WeeklyPlanEntry, "id" | "day_name">[];
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
  created_at: string;
  updated_at: string;
}
