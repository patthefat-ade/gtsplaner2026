"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCreateGroup, useSchoolYears } from "@/hooks/use-groups";
import { useUsers } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { groupSchema, type GroupFormData } from "@/lib/validations";
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
import { ArrowLeft, Loader2, Save } from "lucide-react";

export default function CreateGroupPage() {
  const router = useRouter();
  const toast = useToast();
  const createMutation = useCreateGroup();

  const { data: schoolYears } = useSchoolYears({ page_size: 50 });
  const { data: users } = useUsers({ page_size: 200 });

  const form = useForm<GroupFormData>({
    resolver: zodResolver(groupSchema),
    defaultValues: {
      name: "",
      description: "",
      location: 0,
      school_year: 0,
      group_leader: undefined,
      is_active: true,
    },
  });

  const handleSubmit = async (data: GroupFormData) => {
    const payload = {
      name: data.name,
      school_year: data.school_year,
      location: data.location || 0,
      description: data.description,
      group_leader: data.group_leader,
    };
    createMutation.mutate(payload, {
      onSuccess: () => {
        toast.success("Gruppe erstellt");
        router.push("/groups");
      },
      onError: () => {
        toast.error("Fehler", "Gruppe konnte nicht erstellt werden.");
      },
    });
  };

  const educators = users?.results?.filter(
    (u) => u.is_active && (u.role === "educator" || u.role === "location_manager")
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neue Gruppe"
        description="Erstelle eine neue Gruppe für ein Schuljahr."
      >
        <Button variant="outline" onClick={() => router.push("/groups")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
      </PageHeader>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gruppendaten</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(handleSubmit)}
              className="space-y-6"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gruppenname</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Gruppe Sonnenschein" {...field} />
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
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="school_year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Schuljahr</FormLabel>
                      <Select
                        onValueChange={(val) => field.onChange(Number(val))}
                        value={field.value ? String(field.value) : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Schuljahr wählen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {schoolYears?.results?.map((sy) => (
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

                <FormField
                  control={form.control}
                  name="group_leader"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Gruppenleitung (optional)</FormLabel>
                      <Select
                        onValueChange={(val) =>
                          field.onChange(val === "none" ? undefined : Number(val))
                        }
                        value={field.value ? String(field.value) : "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Leitung wählen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Keine Leitung</SelectItem>
                          {educators?.map((u) => (
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
              </div>

              <div className="flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/groups")}
                >
                  Abbrechen
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Erstellen
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
