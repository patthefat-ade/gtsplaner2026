"use client";

import { useRouter } from "next/navigation";
import { useCreateUser } from "@/hooks/use-admin";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { UserForm } from "@/components/forms/user-form";
import { Button } from "@/components/ui/button";
import type { User } from "@/types/models";
import { ArrowLeft } from "lucide-react";

export default function CreateUserPage() {
  const router = useRouter();
  const toast = useToast();
  const createMutation = useCreateUser();

  const handleSubmit = async (formData: Record<string, unknown>) => {
    await createMutation.mutateAsync(
      formData as Partial<User> & { password: string },
      {
        onSuccess: () => {
          toast.success("Benutzer erstellt");
          router.push("/admin/users");
        },
        onError: () => {
          toast.error("Fehler", "Benutzer konnte nicht erstellt werden.");
        },
      }
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Neuer Benutzer"
        description="Erstelle einen neuen Benutzer im System."
      >
        <Button variant="outline" onClick={() => router.push("/admin/users")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück
        </Button>
      </PageHeader>

      <UserForm
        open={true}
        onOpenChange={(open) => {
          if (!open) router.push("/admin/users");
        }}
        user={null}
        onSubmit={handleSubmit}
        isLoading={createMutation.isPending}
      />
    </div>
  );
}
