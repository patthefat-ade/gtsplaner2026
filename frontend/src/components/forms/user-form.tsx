"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
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
import { ROLE_LABELS } from "@/lib/constants";
import type { User, Location, Organization } from "@/types/models";

// Unified schema that works for both create and edit
const userFormSchema = z.object({
  username: z
    .string()
    .min(3, "Benutzername muss mind. 3 Zeichen haben")
    .max(150, "Benutzername darf max. 150 Zeichen haben"),
  email: z.string().email("Ungültige E-Mail-Adresse"),
  first_name: z.string().min(1, "Vorname ist erforderlich"),
  last_name: z.string().min(1, "Nachname ist erforderlich"),
  role: z.enum(["educator", "location_manager", "sub_admin", "admin", "super_admin"], {
    error: "Rolle ist erforderlich",
  }),
  organization: z.number().optional(),
  location: z.number().optional(),
  password: z.string().optional(),
  password_confirm: z.string().optional(),
  is_active: z.boolean(),
});

type UserFormData = z.infer<typeof userFormSchema>;

interface UserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  locations?: Location[];
  organizations?: Organization[];
  onSubmit: (data: Record<string, unknown>) => Promise<void>;
  isLoading?: boolean;
}

export function UserForm({
  open,
  onOpenChange,
  user,
  locations = [],
  organizations = [],
  onSubmit,
  isLoading = false,
}: UserFormProps) {
  const isEdit = !!user;
  const [formError, setFormError] = React.useState<string | null>(null);

  const form = useForm<UserFormData>({
    resolver: zodResolver(userFormSchema),
    defaultValues: {
      username: user?.username || "",
      email: user?.email || "",
      first_name: user?.first_name || "",
      last_name: user?.last_name || "",
      role: (user?.role as UserFormData["role"]) || "educator",
      organization: user?.organization || undefined,
      location: user?.location || undefined,
      password: "",
      password_confirm: "",
      is_active: user?.is_active ?? true,
    },
  });

  const selectedRole = form.watch("role");
  const selectedOrg = form.watch("organization");

  // Filter locations by selected organization
  const filteredLocations = React.useMemo(() => {
    if (!selectedOrg) return locations;
    return locations.filter((loc) => loc.organization === selectedOrg);
  }, [locations, selectedOrg]);

  // Show organization dropdown for sub_admin/admin/super_admin roles
  const showOrgField = selectedRole === "sub_admin" || selectedRole === "admin" || selectedRole === "super_admin";

  React.useEffect(() => {
    if (open) {
      setFormError(null);
      form.reset({
        username: user?.username || "",
        email: user?.email || "",
        first_name: user?.first_name || "",
        last_name: user?.last_name || "",
        role: (user?.role as UserFormData["role"]) || "educator",
        organization: user?.organization || undefined,
        location: user?.location || undefined,
        password: "",
        password_confirm: "",
        is_active: user?.is_active ?? true,
      });
    }
  }, [open, user, form]);

  const handleSubmit = async (data: UserFormData) => {
    setFormError(null);

    // Validate passwords for create mode
    if (!isEdit) {
      if (!data.password || data.password.length < 8) {
        form.setError("password", {
          type: "manual",
          message: "Passwort muss mind. 8 Zeichen haben",
        });
        return;
      }
      if (data.password !== data.password_confirm) {
        form.setError("password_confirm", {
          type: "manual",
          message: "Passwörter stimmen nicht überein",
        });
        return;
      }
    }

    // Build submit data (exclude password fields for edit)
    const submitData: Record<string, unknown> = {
      username: data.username,
      email: data.email,
      first_name: data.first_name,
      last_name: data.last_name,
      role: data.role,
      is_active: data.is_active,
    };
    if (data.organization) submitData.organization = data.organization;
    if (data.location) submitData.location = data.location;
    if (!isEdit && data.password) submitData.password = data.password;

    try {
      await onSubmit(submitData);
      onOpenChange(false);
    } catch (error: unknown) {
      if (error && typeof error === "object" && "response" in error) {
        const apiError = error as {
          response?: { data?: Record<string, string | string[]> };
        };
        const errors = apiError.response?.data;
        if (errors) {
          Object.entries(errors).forEach(([key, messages]) => {
            const msg = Array.isArray(messages) ? messages[0] : String(messages);
            if (key === "non_field_errors" || key === "detail") {
              setFormError(msg);
            } else {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              form.setError(key as any, { type: "server", message: msg });
            }
          });
        }
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Benutzer bearbeiten" : "Neuer Benutzer"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            {formError && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
                {formError}
              </div>
            )}

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
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Benutzername</FormLabel>
                  <FormControl>
                    <Input placeholder="benutzername" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-Mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@beispiel.at"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rolle</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Rolle wählen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(ROLE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Organization dropdown – shown for Admin/SuperAdmin roles */}
            {organizations.length > 0 && showOrgField && (
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organisation (Mandant)</FormLabel>
                    <Select
                      onValueChange={(val) =>
                        field.onChange(val === "0" ? undefined : Number(val))
                      }
                      defaultValue={
                        field.value ? String(field.value) : undefined
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Organisation wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Keine Organisation</SelectItem>
                        {organizations.map((org) => (
                          <SelectItem key={org.id} value={String(org.id)}>
                            {org.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Location dropdown – always shown when locations available */}
            {(locations.length > 0 || filteredLocations.length > 0) && (
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Standort (optional)</FormLabel>
                    <Select
                      onValueChange={(val) =>
                        field.onChange(val === "0" ? undefined : Number(val))
                      }
                      defaultValue={
                        field.value ? String(field.value) : undefined
                      }
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Standort wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="0">Kein Standort</SelectItem>
                        {filteredLocations.map((loc) => (
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

            {!isEdit && (
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Min. 8 Zeichen"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="password_confirm"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Passwort bestätigen</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Passwort wiederholen"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            )}

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
