import { z } from "zod";

// ============================================================
// Common Validators
// ============================================================

const requiredString = (field: string) =>
  z.string().min(1, `${field} ist erforderlich`);

const optionalString = () => z.string().optional().or(z.literal(""));

const positiveNumber = (field: string) =>
  z.number().positive(`${field} muss größer als 0 sein`);

const nonNegativeNumber = (field: string) =>
  z.number().min(0, `${field} darf nicht negativ sein`);

const dateString = (field: string) =>
  z.string().min(1, `${field} ist erforderlich`);

const timeString = (field: string) =>
  z.string().regex(/^\d{2}:\d{2}$/, `${field} muss im Format HH:MM sein`);

// ============================================================
// Finance Schemas
// ============================================================

export const transactionCategorySchema = z.object({
  name: requiredString("Name"),
  category_type: z.enum(["income", "expense"], {
    error: "Kategorie-Typ ist erforderlich",
  }),
  description: optionalString(),
  is_active: z.boolean(),
});

export type TransactionCategoryFormData = z.infer<typeof transactionCategorySchema>;

export const transactionSchema = z.object({
  group: z.number().positive("Gruppe ist erforderlich"),
  category: z.number().positive("Kategorie ist erforderlich"),
  transaction_type: z.enum(["income", "expense"], {
    error: "Transaktionstyp ist erforderlich",
  }),
  amount: positiveNumber("Betrag"),
  description: requiredString("Beschreibung"),
  transaction_date: dateString("Transaktionsdatum"),
  notes: optionalString(),
});

export type TransactionFormData = z.infer<typeof transactionSchema>;

export const receiptUploadSchema = z.object({
  file: z
    .instanceof(File, { message: "Datei ist erforderlich" })
    .refine((f) => f.size <= 10 * 1024 * 1024, "Datei darf max. 10 MB groß sein")
    .refine(
      (f) =>
        [
          "image/jpeg",
          "image/png",
          "image/webp",
          "application/pdf",
        ].includes(f.type),
      "Nur JPEG, PNG, WebP oder PDF erlaubt",
    ),
  description: optionalString(),
});

export type ReceiptUploadFormData = z.infer<typeof receiptUploadSchema>;

// ============================================================
// Timetracking Schemas
// ============================================================

export const timeEntrySchema = z
  .object({
    group: z.number().positive("Gruppe ist erforderlich"),
    date: dateString("Datum"),
    start_time: timeString("Startzeit"),
    end_time: timeString("Endzeit"),
    break_minutes: nonNegativeNumber("Pause"),
    notes: optionalString(),
  })
  .refine(
    (data) => {
      if (data.start_time && data.end_time) {
        return data.start_time < data.end_time;
      }
      return true;
    },
    {
      message: "Endzeit muss nach der Startzeit liegen",
      path: ["end_time"],
    },
  );

export type TimeEntryFormData = z.infer<typeof timeEntrySchema>;

export const leaveRequestSchema = z
  .object({
    leave_type: z.number().positive("Abwesenheitstyp ist erforderlich"),
    start_date: dateString("Startdatum"),
    end_date: dateString("Enddatum"),
    reason: optionalString(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.start_date <= data.end_date;
      }
      return true;
    },
    {
      message: "Enddatum muss nach dem Startdatum liegen",
      path: ["end_date"],
    },
  );

export type LeaveRequestFormData = z.infer<typeof leaveRequestSchema>;

// ============================================================
// Groups Schemas
// ============================================================

export const groupSchema = z.object({
  name: requiredString("Gruppenname"),
  school_year: z.number().positive("Schuljahr ist erforderlich"),
  group_leader: z.number().optional(),
  description: optionalString(),
  location: z.number().optional(),
  max_children: nonNegativeNumber("Max. Kinder").optional(),
  is_active: z.boolean(),
});

export type GroupFormData = z.infer<typeof groupSchema>;

export const studentSchema = z.object({
  first_name: requiredString("Vorname"),
  last_name: requiredString("Nachname"),
  group: z.number().positive("Gruppe ist erforderlich"),
  date_of_birth: optionalString(),
  enrollment_date: optionalString(),
  notes: optionalString(),
  is_active: z.boolean(),
});

export type StudentFormData = z.infer<typeof studentSchema>;

export const groupMemberSchema = z.object({
  user: z.number().positive("Benutzer ist erforderlich"),
  role: z.enum(["educator", "assistant", "substitute"], {
    error: "Rolle ist erforderlich",
  }),
});

export type GroupMemberFormData = z.infer<typeof groupMemberSchema>;

// ============================================================
// School Year Schema
// ============================================================

export const schoolYearSchema = z
  .object({
    name: requiredString("Name"),
    start_date: dateString("Startdatum"),
    end_date: dateString("Enddatum"),
    is_active: z.boolean(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.start_date < data.end_date;
      }
      return true;
    },
    {
      message: "Enddatum muss nach dem Startdatum liegen",
      path: ["end_date"],
    },
  );

export type SchoolYearFormData = z.infer<typeof schoolYearSchema>;

// ============================================================
// Admin / User Schemas
// ============================================================

export const userCreateSchema = z
  .object({
    username: requiredString("Benutzername")
      .min(3, "Benutzername muss mind. 3 Zeichen haben")
      .max(150, "Benutzername darf max. 150 Zeichen haben"),
    email: z.string().email("Ungültige E-Mail-Adresse"),
    first_name: requiredString("Vorname"),
    last_name: requiredString("Nachname"),
    role: z.enum(["educator", "location_manager", "admin", "super_admin"], {
      error: "Rolle ist erforderlich",
    }),
    location: z.number().optional(),
    password: z
      .string()
      .min(8, "Passwort muss mind. 8 Zeichen haben")
      .regex(/[A-Z]/, "Passwort muss mind. einen Großbuchstaben enthalten")
      .regex(/[a-z]/, "Passwort muss mind. einen Kleinbuchstaben enthalten")
      .regex(/[0-9]/, "Passwort muss mind. eine Zahl enthalten"),
    password_confirm: z.string().min(1, "Passwort-Bestätigung ist erforderlich"),
    is_active: z.boolean(),
  })
  .refine((data) => data.password === data.password_confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["password_confirm"],
  });

export type UserCreateFormData = z.infer<typeof userCreateSchema>;

export const userEditSchema = z.object({
  username: requiredString("Benutzername")
    .min(3, "Benutzername muss mind. 3 Zeichen haben")
    .max(150, "Benutzername darf max. 150 Zeichen haben"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  first_name: requiredString("Vorname"),
  last_name: requiredString("Nachname"),
  role: z.enum(["educator", "location_manager", "admin", "super_admin"], {
    error: "Rolle ist erforderlich",
  }),
  location: z.number().optional(),
  is_active: z.boolean(),
});

export type UserEditFormData = z.infer<typeof userEditSchema>;

// ============================================================
// Profile Schema
// ============================================================

export const profileSchema = z.object({
  first_name: requiredString("Vorname"),
  last_name: requiredString("Nachname"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  phone: optionalString(),
});

export type ProfileFormData = z.infer<typeof profileSchema>;

export const passwordChangeSchema = z
  .object({
    old_password: requiredString("Aktuelles Passwort"),
    new_password: z
      .string()
      .min(8, "Passwort muss mind. 8 Zeichen haben")
      .regex(/[A-Z]/, "Passwort muss mind. einen Großbuchstaben enthalten")
      .regex(/[a-z]/, "Passwort muss mind. einen Kleinbuchstaben enthalten")
      .regex(/[0-9]/, "Passwort muss mind. eine Zahl enthalten"),
    new_password_confirm: z.string().min(1, "Passwort-Bestätigung ist erforderlich"),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["new_password_confirm"],
  });

export type PasswordChangeFormData = z.infer<typeof passwordChangeSchema>;

// ============================================================
// System Settings Schema
// ============================================================

export const systemSettingSchema = z.object({
  value: requiredString("Wert"),
});

export type SystemSettingFormData = z.infer<typeof systemSettingSchema>;
