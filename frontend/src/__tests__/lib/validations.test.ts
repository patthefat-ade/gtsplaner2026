import { describe, it, expect } from "vitest";
import {
  transactionSchema,
  transactionCategorySchema,
  timeEntrySchema,
  leaveRequestSchema,
  groupSchema,
  studentSchema,
  userCreateSchema,
  userEditSchema,
  profileSchema,
  passwordChangeSchema,
  schoolYearSchema,
} from "@/lib/validations";

// ─── Transaction Schema ─────────────────────────────────────────────────────

describe("transactionSchema", () => {
  it("should validate a correct transaction", () => {
    const result = transactionSchema.safeParse({
      group: 1,
      category: 1,
      transaction_type: "income",
      amount: 100,
      description: "Elternbeitrag",
      transaction_date: "2026-03-15",
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing description", () => {
    const result = transactionSchema.safeParse({
      group: 1,
      category: 1,
      transaction_type: "income",
      amount: 100,
      description: "",
      transaction_date: "2026-03-15",
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative amount", () => {
    const result = transactionSchema.safeParse({
      group: 1,
      category: 1,
      transaction_type: "expense",
      amount: -50,
      description: "Test",
      transaction_date: "2026-03-15",
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid transaction type", () => {
    const result = transactionSchema.safeParse({
      group: 1,
      category: 1,
      transaction_type: "transfer",
      amount: 100,
      description: "Test",
      transaction_date: "2026-03-15",
    });
    expect(result.success).toBe(false);
  });
});

// ─── Transaction Category Schema ────────────────────────────────────────────

describe("transactionCategorySchema", () => {
  it("should validate a correct category", () => {
    const result = transactionCategorySchema.safeParse({
      name: "Elternbeitrag",
      category_type: "income",
      description: "",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = transactionCategorySchema.safeParse({
      name: "",
      category_type: "income",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Time Entry Schema ──────────────────────────────────────────────────────

describe("timeEntrySchema", () => {
  it("should validate a correct time entry", () => {
    const result = timeEntrySchema.safeParse({
      group: 1,
      date: "2026-03-15",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: 30,
      notes: "",
    });
    expect(result.success).toBe(true);
  });

  it("should reject end time before start time", () => {
    const result = timeEntrySchema.safeParse({
      group: 1,
      date: "2026-03-15",
      start_time: "16:00",
      end_time: "08:00",
      break_minutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid time format", () => {
    const result = timeEntrySchema.safeParse({
      group: 1,
      date: "2026-03-15",
      start_time: "8:00",
      end_time: "16:00",
      break_minutes: 0,
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative break minutes", () => {
    const result = timeEntrySchema.safeParse({
      group: 1,
      date: "2026-03-15",
      start_time: "08:00",
      end_time: "16:00",
      break_minutes: -10,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Leave Request Schema ───────────────────────────────────────────────────

describe("leaveRequestSchema", () => {
  it("should validate a correct leave request", () => {
    const result = leaveRequestSchema.safeParse({
      leave_type: 1,
      start_date: "2026-04-01",
      end_date: "2026-04-05",
      reason: "Urlaub",
    });
    expect(result.success).toBe(true);
  });

  it("should reject end date before start date", () => {
    const result = leaveRequestSchema.safeParse({
      leave_type: 1,
      start_date: "2026-04-05",
      end_date: "2026-04-01",
      reason: "",
    });
    expect(result.success).toBe(false);
  });

  it("should allow same start and end date", () => {
    const result = leaveRequestSchema.safeParse({
      leave_type: 1,
      start_date: "2026-04-01",
      end_date: "2026-04-01",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Group Schema ───────────────────────────────────────────────────────────

describe("groupSchema", () => {
  it("should validate a correct group", () => {
    const result = groupSchema.safeParse({
      name: "Gruppe Sonnenschein",
      school_year: 1,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty name", () => {
    const result = groupSchema.safeParse({
      name: "",
      school_year: 1,
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("should allow optional fields", () => {
    const result = groupSchema.safeParse({
      name: "Test",
      school_year: 1,
      group_leader: 5,
      description: "Beschreibung",
      location: 2,
      max_children: 25,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Student Schema ─────────────────────────────────────────────────────────

describe("studentSchema", () => {
  it("should validate a correct student", () => {
    const result = studentSchema.safeParse({
      first_name: "Anna",
      last_name: "Berger",
      group: 1,
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject missing first name", () => {
    const result = studentSchema.safeParse({
      first_name: "",
      last_name: "Berger",
      group: 1,
      is_active: true,
    });
    expect(result.success).toBe(false);
  });
});

// ─── User Create Schema ────────────────────────────────────────────────────

describe("userCreateSchema", () => {
  it("should validate a correct user creation", () => {
    const result = userCreateSchema.safeParse({
      username: "maxm",
      email: "max@test.at",
      first_name: "Max",
      last_name: "Mustermann",
      role: "educator",
      password: "Test1234",
      password_confirm: "Test1234",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject mismatched passwords", () => {
    const result = userCreateSchema.safeParse({
      username: "maxm",
      email: "max@test.at",
      first_name: "Max",
      last_name: "Mustermann",
      role: "educator",
      password: "Test1234",
      password_confirm: "Test5678",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("should reject weak password", () => {
    const result = userCreateSchema.safeParse({
      username: "maxm",
      email: "max@test.at",
      first_name: "Max",
      last_name: "Mustermann",
      role: "educator",
      password: "test",
      password_confirm: "test",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("should reject short username", () => {
    const result = userCreateSchema.safeParse({
      username: "ab",
      email: "max@test.at",
      first_name: "Max",
      last_name: "Mustermann",
      role: "educator",
      password: "Test1234",
      password_confirm: "Test1234",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });

  it("should reject invalid email", () => {
    const result = userCreateSchema.safeParse({
      username: "maxm",
      email: "not-an-email",
      first_name: "Max",
      last_name: "Mustermann",
      role: "educator",
      password: "Test1234",
      password_confirm: "Test1234",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });
});

// ─── User Edit Schema ──────────────────────────────────────────────────────

describe("userEditSchema", () => {
  it("should validate a correct user edit", () => {
    const result = userEditSchema.safeParse({
      username: "maxm",
      email: "max@test.at",
      first_name: "Max",
      last_name: "Mustermann",
      role: "location_manager",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });
});

// ─── Profile Schema ────────────────────────────────────────────────────────

describe("profileSchema", () => {
  it("should validate a correct profile", () => {
    const result = profileSchema.safeParse({
      first_name: "Max",
      last_name: "Mustermann",
      email: "max@test.at",
      phone: "+43 123 456789",
    });
    expect(result.success).toBe(true);
  });

  it("should allow empty phone", () => {
    const result = profileSchema.safeParse({
      first_name: "Max",
      last_name: "Mustermann",
      email: "max@test.at",
    });
    expect(result.success).toBe(true);
  });
});

// ─── Password Change Schema ────────────────────────────────────────────────

describe("passwordChangeSchema", () => {
  it("should validate a correct password change", () => {
    const result = passwordChangeSchema.safeParse({
      old_password: "OldPass123",
      new_password: "NewPass456",
      new_password_confirm: "NewPass456",
    });
    expect(result.success).toBe(true);
  });

  it("should reject mismatched new passwords", () => {
    const result = passwordChangeSchema.safeParse({
      old_password: "OldPass123",
      new_password: "NewPass456",
      new_password_confirm: "NewPass789",
    });
    expect(result.success).toBe(false);
  });
});

// ─── School Year Schema ────────────────────────────────────────────────────

describe("schoolYearSchema", () => {
  it("should validate a correct school year", () => {
    const result = schoolYearSchema.safeParse({
      name: "2025/26",
      start_date: "2025-09-01",
      end_date: "2026-07-31",
      is_active: true,
    });
    expect(result.success).toBe(true);
  });

  it("should reject end date before start date", () => {
    const result = schoolYearSchema.safeParse({
      name: "2025/26",
      start_date: "2026-07-31",
      end_date: "2025-09-01",
      is_active: true,
    });
    expect(result.success).toBe(false);
  });
});
