"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateLeaveRequest, useLeaveTypes } from "@/hooks/use-timetracking";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { leaveRequestSchema, type LeaveRequestFormData } from "@/lib/validations";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Loader2, Send } from "lucide-react";

export default function CreateLeaveRequestPage() {
  const router = useRouter();
  const toast = useToast();
  const createMutation = useCreateLeaveRequest();
  const { data: leaveTypes } = useLeaveTypes();

  const form = useForm<LeaveRequestFormData>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leave_type: 0,
      start_date: "",
      end_date: "",
      reason: "",
    },
  });

  const handleSubmit = async (data: LeaveRequestFormData) => {
    createMutation.mutate(data, {
      onSuccess: () => {
        toast.success("Abwesenheitsantrag eingereicht");
        router.push("/timetracking/leave-requests");
      },
      onError: () => {
        toast.error("Fehler", "Antrag konnte nicht erstellt werden.");
      },
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neuer Abwesenheitsantrag"
        description="Stelle einen Antrag auf Urlaub, Krankheit oder Fortbildung."
      >
        <Button
          variant="outline"
          onClick={() => router.push("/timetracking/leave-requests")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Antragsdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="leave_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Abwesenheitstyp</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      value={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Typ wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {leaveTypes?.results
                          ?.filter((lt) => lt.is_active)
                          .map((lt) => (
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

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="start_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Startdatum</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_date"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Enddatum</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
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
                    <FormLabel>Begründung (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Grund für die Abwesenheit..."
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/timetracking/leave-requests")}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="mr-2 h-4 w-4" />
                  )}
                  Antrag einreichen
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
