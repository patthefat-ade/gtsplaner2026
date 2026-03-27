"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format, parse } from "date-fns";
import {
  leaveRequestSchema,
  type LeaveRequestFormData,
} from "@/lib/validations";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
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
import { Loader2 } from "lucide-react";
import type { LeaveRequest, LeaveType } from "@/types/models";

interface LeaveRequestFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leaveRequest?: LeaveRequest | null;
  leaveTypes: LeaveType[];
  onSubmit: (data: LeaveRequestFormData) => Promise<void>;
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

export function LeaveRequestForm({
  open,
  onOpenChange,
  leaveRequest,
  leaveTypes,
  onSubmit,
  isLoading = false,
}: LeaveRequestFormProps) {
  const isEdit = !!leaveRequest;

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leave_type: leaveRequest?.leave_type
        ? (typeof leaveRequest.leave_type === "object" ? leaveRequest.leave_type.id : leaveRequest.leave_type)
        : 0,
      start_date:
        leaveRequest?.start_date || new Date().toISOString().split("T")[0],
      end_date:
        leaveRequest?.end_date || new Date().toISOString().split("T")[0],
      reason: leaveRequest?.reason || "",
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        leave_type: leaveRequest?.leave_type
          ? (typeof leaveRequest.leave_type === "object" ? leaveRequest.leave_type.id : leaveRequest.leave_type)
          : 0,
        start_date:
          leaveRequest?.start_date || new Date().toISOString().split("T")[0],
        end_date:
          leaveRequest?.end_date || new Date().toISOString().split("T")[0],
        reason: leaveRequest?.reason || "",
      });
    }
  }, [open, leaveRequest, form]);

  const handleSubmit = async (data: LeaveRequestFormData) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const apiError = error as { response?: { data?: Record<string, string[]> } };
        const errors = apiError.response?.data;
        if (errors) {
          Object.entries(errors).forEach(([key, messages]) => {
            form.setError(key as keyof LeaveRequestFormData, {
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit
              ? "Abwesenheitsantrag bearbeiten"
              : "Neuer Abwesenheitsantrag"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="leave_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Abwesenheitstyp</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leaveTypes.map((lt) => (
                        <SelectItem key={lt.id} value={String(lt.id)}>
                          {lt.name}
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
                name="start_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Von</FormLabel>
                    <DatePicker
                      value={parseDate(field.value)}
                      onChange={(date) => {
                        field.onChange(
                          date ? format(date, "yyyy-MM-dd") : "",
                        );
                      }}
                      placeholder="Startdatum"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="end_date"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Bis</FormLabel>
                    <DatePicker
                      value={parseDate(field.value)}
                      onChange={(date) => {
                        field.onChange(
                          date ? format(date, "yyyy-MM-dd") : "",
                        );
                      }}
                      placeholder="Enddatum"
                    />
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Begruendung (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Grund fuer die Abwesenheit..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                {isEdit ? "Speichern" : "Einreichen"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
