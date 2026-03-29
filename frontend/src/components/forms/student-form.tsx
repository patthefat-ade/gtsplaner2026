"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse } from "date-fns";
import { studentSchema, type StudentFormData } from "@/lib/validations";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, ShieldAlert, ShieldOff } from "lucide-react";
import type { Student, Group, DataConsentStatus } from "@/types/models";
import { DATA_CONSENT_STATUS_LABELS, DATA_CONSENT_STATUS_COLORS } from "@/types/models";

interface StudentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  student?: Student | null;
  groups: Group[];
  onSubmit: (data: StudentFormData) => Promise<void>;
  isLoading?: boolean;
}

/** Parse a "YYYY-MM-DD" string into a Date, or return undefined. */
function parseDate(value: string | undefined | null): Date | undefined {
  if (!value) return undefined;
  try {
    return parse(value, "yyyy-MM-dd", new Date());
  } catch {
    return undefined;
  }
}

function ConsentStatusIcon({ status }: { status: DataConsentStatus }) {
  switch (status) {
    case "granted":
      return <ShieldCheck className="h-4 w-4" />;
    case "revoked":
      return <ShieldOff className="h-4 w-4" />;
    default:
      return <ShieldAlert className="h-4 w-4" />;
  }
}

export function StudentForm({
  open,
  onOpenChange,
  student,
  groups,
  onSubmit,
  isLoading = false,
}: StudentFormProps) {
  const isEdit = !!student;

  const form = useForm<StudentFormData>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      first_name: student?.first_name || "",
      last_name: student?.last_name || "",
      group: student?.group || 0,
      date_of_birth: student?.date_of_birth || "",
      enrollment_date: student?.enrollment_date || "",
      notes: student?.notes || "",
      is_active: student?.is_active ?? true,
      data_consent_status: student?.data_consent_status || "pending",
      data_consent_date: student?.data_consent_date || "",
      data_consent_guardian_name: student?.data_consent_guardian_name || "",
      processing_restricted: student?.processing_restricted ?? false,
      restriction_reason: student?.restriction_reason || "",
      restriction_date: student?.restriction_date || "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        first_name: student?.first_name || "",
        last_name: student?.last_name || "",
        group: student?.group || 0,
        date_of_birth: student?.date_of_birth || "",
        enrollment_date: student?.enrollment_date || "",
        notes: student?.notes || "",
        is_active: student?.is_active ?? true,
        data_consent_status: student?.data_consent_status || "pending",
        data_consent_date: student?.data_consent_date || "",
        data_consent_guardian_name: student?.data_consent_guardian_name || "",
        processing_restricted: student?.processing_restricted ?? false,
        restriction_reason: student?.restriction_reason || "",
        restriction_date: student?.restriction_date || "",
      });
    }
  }, [open, student, form]);

  const consentStatus = form.watch("data_consent_status");
  const processingRestricted = form.watch("processing_restricted");

  const handleSubmit = async (data: StudentFormData) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const apiError = error as { response?: { data?: Record<string, string[]> } };
        const errors = apiError.response?.data;
        if (errors) {
          Object.entries(errors).forEach(([key, messages]) => {
            form.setError(key as keyof StudentFormData, {
              type: "server",
              message: Array.isArray(messages) ? messages[0] : String(messages),
            });
          });
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Kind bearbeiten" : "Neues Kind"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {/* ── Stammdaten ── */}
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="first_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vorname</FormLabel>
                    <FormControl>
                      <Input placeholder="Vorname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="last_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nachname</FormLabel>
                    <FormControl>
                      <Input placeholder="Nachname" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="group"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gruppe</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Gruppe waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {groups.map((g) => (
                        <SelectItem key={g.id} value={String(g.id)}>
                          {g.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="date_of_birth"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Geburtsdatum (optional)</FormLabel>
                    <DatePicker
                      value={parseDate(field.value)}
                      onChange={(date) => {
                        field.onChange(
                          date ? format(date, "yyyy-MM-dd") : "",
                        );
                      }}
                      placeholder="Geburtsdatum"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="enrollment_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Eintrittsdatum (optional)</FormLabel>
                    <DatePicker
                      value={parseDate(field.value)}
                      onChange={(date) => {
                        field.onChange(
                          date ? format(date, "yyyy-MM-dd") : "",
                        );
                      }}
                      placeholder="Eintrittsdatum"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notizen (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Zusaetzliche Informationen..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_active"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <FormLabel className="cursor-pointer">Aktiv</FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {/* ── DSGVO Einwilligung (Art. 8) ── */}
            <Separator />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                <ConsentStatusIcon status={consentStatus as DataConsentStatus} />
                Einwilligung zur Datenverarbeitung (DSGVO Art. 8)
              </h4>
              <p className="text-xs text-muted-foreground">
                Fuer die Verarbeitung personenbezogener Daten von Minderjaehrigen ist die Einwilligung eines Erziehungsberechtigten erforderlich.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="data_consent_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Einwilligungsstatus</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status waehlen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="pending">
                          <span className="flex items-center gap-2">
                            <ShieldAlert className="h-3 w-3 text-yellow-400" />
                            Ausstehend
                          </span>
                        </SelectItem>
                        <SelectItem value="granted">
                          <span className="flex items-center gap-2">
                            <ShieldCheck className="h-3 w-3 text-green-400" />
                            Erteilt
                          </span>
                        </SelectItem>
                        <SelectItem value="revoked">
                          <span className="flex items-center gap-2">
                            <ShieldOff className="h-3 w-3 text-red-400" />
                            Widerrufen
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="data_consent_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Einwilligungsdatum</FormLabel>
                    <DatePicker
                      value={parseDate(field.value)}
                      onChange={(date) => {
                        field.onChange(
                          date ? format(date, "yyyy-MM-dd") : "",
                        );
                      }}
                      placeholder="Datum der Einwilligung"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="data_consent_guardian_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name des Erziehungsberechtigten</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Vor- und Nachname des Erziehungsberechtigten"
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Person, die die Einwilligung erteilt hat
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* ── Einschränkung der Verarbeitung (Art. 18) ── */}
            <Separator />
            <div className="space-y-1">
              <h4 className="text-sm font-semibold">
                Einschraenkung der Verarbeitung (DSGVO Art. 18)
              </h4>
              <p className="text-xs text-muted-foreground">
                Bei Einschraenkung duerfen die Daten nur gespeichert, aber nicht weiter verarbeitet werden.
              </p>
            </div>

            <FormField
              control={form.control}
              name="processing_restricted"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border border-destructive/30 p-3">
                  <div>
                    <FormLabel className="cursor-pointer">Verarbeitung eingeschraenkt</FormLabel>
                    <FormDescription>
                      Daten werden nur gespeichert, nicht verarbeitet
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />

            {processingRestricted && (
              <>
                <FormField
                  control={form.control}
                  name="restriction_reason"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grund der Einschraenkung</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Grund fuer die Einschraenkung der Verarbeitung..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="restriction_date"
                  render={({ field }) => (
                    <FormItem className="flex flex-col">
                      <FormLabel>Einschraenkung seit</FormLabel>
                      <DatePicker
                        value={parseDate(field.value)}
                        onChange={(date) => {
                          field.onChange(
                            date ? format(date, "yyyy-MM-dd") : "",
                          );
                        }}
                        placeholder="Datum der Einschraenkung"
                      />
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Abbrechen
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Speichern" : "Erstellen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
