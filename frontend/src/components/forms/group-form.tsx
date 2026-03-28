"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { groupSchema, type GroupFormData } from "@/lib/validations";
import {
  Form,
  FormControl,
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
import { Loader2 } from "lucide-react";
import type { Group, SchoolYear, UserCompact, Location } from "@/types/models";

interface GroupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: Group | null;
  schoolYears: SchoolYear[];
  users?: UserCompact[];
  locations?: Location[];
  showLocationField?: boolean;
  onSubmit: (data: GroupFormData) => Promise<void>;
  isLoading?: boolean;
}

export function GroupForm({
  open,
  onOpenChange,
  group,
  schoolYears,
  users = [],
  locations = [],
  showLocationField = false,
  onSubmit,
  isLoading = false,
}: GroupFormProps) {
  const isEdit = !!group;

  const form = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: group?.name || "",
      location: group?.location || 0,
      school_year: group?.school_year || 0,
      group_leader: group?.group_leader || undefined,
      description: group?.description || "",
      max_children: group?.max_children || undefined,
      is_active: group?.is_active ?? true,
    },
  });

  React.useEffect(() => {
    if (open) {
      form.reset({
        name: group?.name || "",
        location: group?.location || 0,
        school_year: group?.school_year || 0,
        group_leader: group?.group_leader || undefined,
        description: group?.description || "",
        max_children: group?.max_children || undefined,
        is_active: group?.is_active ?? true,
      });
    }
  }, [open, group, form]);

  const handleSubmit = async (data: GroupFormData) => {
    try {
      await onSubmit(data);
      onOpenChange(false);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const apiError = error as { response?: { data?: Record<string, string[]> } };
        const errors = apiError.response?.data;
        if (errors) {
          Object.entries(errors).forEach(([key, messages]) => {
            form.setError(key as keyof GroupFormData, {
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
            {isEdit ? "Gruppe bearbeiten" : "Neue Gruppe"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Gruppenname</FormLabel>
                  <FormControl>
                    <Input placeholder="z.B. Schmetterlinge" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Location dropdown for admins who need to select a location */}
            {showLocationField && locations.length > 0 && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standort *</FormLabel>
                    <Select
                      onValueChange={(val) => field.onChange(Number(val))}
                      defaultValue={field.value ? String(field.value) : undefined}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Standort wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {locations.map((loc) => (
                          <SelectItem key={loc.id} value={String(loc.id)}>
                            {loc.name} ({loc.city})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="school_year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Schuljahr</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value ? String(field.value) : undefined}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Schuljahr wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {schoolYears.map((sy) => (
                        <SelectItem key={sy.id} value={String(sy.id)}>
                          {sy.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {users.length > 0 && (
              <FormField
                control={form.control}
                name="group_leader"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gruppenleitung (optional)</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={
                        field.value ? String(field.value) : undefined
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Leitung wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Keine Leitung</SelectItem>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={String(u.id)}>
                            {u.first_name} {u.last_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <FormField
              control={form.control}
              name="max_children"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Max. Kinder (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      placeholder="z.B. 25"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Beschreibung (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Beschreibung der Gruppe..."
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
