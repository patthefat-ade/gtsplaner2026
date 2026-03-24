"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/components/ui/toast";
import { PageHeader } from "@/components/common/page-header";
import { PageSkeleton } from "@/components/common/skeleton-loaders";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { authApi } from "@/lib/auth-api";
import { getErrorMessage } from "@/lib/form-utils";
import { formatDate } from "@/lib/format";
import { User, Shield, MapPin, Mail, Calendar, Lock, Save } from "lucide-react";
import { z } from "zod";

const profileSchema = z.object({
  first_name: z.string().min(1, "Vorname ist erforderlich"),
  last_name: z.string().min(1, "Nachname ist erforderlich"),
  phone: z.string().optional(),
});

const passwordSchema = z
  .object({
    old_password: z.string().min(1, "Aktuelles Passwort ist erforderlich"),
    new_password: z
      .string()
      .min(8, "Mindestens 8 Zeichen")
      .regex(/[A-Z]/, "Mindestens ein Großbuchstabe")
      .regex(/[0-9]/, "Mindestens eine Zahl"),
    new_password_confirm: z.string().min(1, "Bestätigung ist erforderlich"),
  })
  .refine((data) => data.new_password === data.new_password_confirm, {
    message: "Passwörter stimmen nicht überein",
    path: ["new_password_confirm"],
  });

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;

const ROLE_LABELS: Record<string, string> = {
  educator: "Pädagog:in",
  location_manager: "Standortleitung",
  admin: "Admin",
  super_admin: "Super-Admin",
};

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    values: user
      ? {
          first_name: user.first_name,
          last_name: user.last_name,
          phone: user.phone || "",
        }
      : undefined,
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      old_password: "",
      new_password: "",
      new_password_confirm: "",
    },
  });

  const handleProfileSubmit = async (data: ProfileFormData) => {
    setProfileLoading(true);
    try {
      await authApi.updateProfile(data);
      await refreshProfile();
      toast.success("Profil aktualisiert");
    } catch (err) {
      toast.error("Fehler", getErrorMessage(err));
    } finally {
      setProfileLoading(false);
    }
  };

  const handlePasswordSubmit = async (data: PasswordFormData) => {
    setPasswordLoading(true);
    try {
      await authApi.changePassword({
        old_password: data.old_password,
        new_password: data.new_password,
        new_password_confirm: data.new_password_confirm,
      });
      toast.success("Passwort geändert");
      passwordForm.reset();
    } catch (err) {
      toast.error("Fehler", getErrorMessage(err));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (!user) return <PageSkeleton rows={3} columns={2} />;

  const initials = `${user.first_name?.[0] || ""}${user.last_name?.[0] || ""}`.toUpperCase();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mein Profil"
        description="Verwalte deine persönlichen Daten und dein Passwort."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Card */}
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col items-center pt-6">
            <Avatar className="h-24 w-24">
              <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
            </Avatar>
            <h3 className="mt-4 text-lg font-semibold">
              {user.first_name} {user.last_name}
            </h3>
            <Badge variant="outline" className="mt-2 gap-1">
              <Shield className="h-3 w-3" />
              {ROLE_LABELS[user.role] || user.role}
            </Badge>
            <Separator className="my-4" />
            <div className="w-full space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Mail className="h-4 w-4" />
                {user.email}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <MapPin className="h-4 w-4" />
                {user.location_detail?.name || "Kein Standort"}
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                Mitglied seit {formatDate(user.date_joined)}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Edit Forms */}
        <div className="space-y-6 lg:col-span-2">
          {/* Profile Edit Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4" />
                Persönliche Daten
              </CardTitle>
              <CardDescription>
                Aktualisiere deinen Namen und deine Kontaktdaten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={profileForm.handleSubmit(handleProfileSubmit)}
                className="space-y-4"
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Vorname</Label>
                    <Input
                      id="first_name"
                      {...profileForm.register("first_name")}
                    />
                    {profileForm.formState.errors.first_name && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.first_name.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Nachname</Label>
                    <Input
                      id="last_name"
                      {...profileForm.register("last_name")}
                    />
                    {profileForm.formState.errors.last_name && (
                      <p className="text-sm text-destructive">
                        {profileForm.formState.errors.last_name.message}
                      </p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">E-Mail</Label>
                  <Input id="email" value={user.email} disabled />
                  <p className="text-xs text-muted-foreground">
                    Die E-Mail-Adresse kann nur von einem Admin geändert werden.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    {...profileForm.register("phone")}
                    placeholder="+43 ..."
                  />
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={profileLoading}>
                    <Save className="mr-2 h-4 w-4" />
                    {profileLoading ? "Wird gespeichert..." : "Speichern"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Password Change Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Lock className="h-4 w-4" />
                Passwort ändern
              </CardTitle>
              <CardDescription>
                Mindestens 8 Zeichen, ein Großbuchstabe und eine Zahl.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                onSubmit={passwordForm.handleSubmit(handlePasswordSubmit)}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="old_password">Aktuelles Passwort</Label>
                  <Input
                    id="old_password"
                    type="password"
                    {...passwordForm.register("old_password")}
                  />
                  {passwordForm.formState.errors.old_password && (
                    <p className="text-sm text-destructive">
                      {passwordForm.formState.errors.old_password.message}
                    </p>
                  )}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="new_password">Neues Passwort</Label>
                    <Input
                      id="new_password"
                      type="password"
                      {...passwordForm.register("new_password")}
                    />
                    {passwordForm.formState.errors.new_password && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.new_password.message}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="new_password_confirm">Passwort bestätigen</Label>
                    <Input
                      id="new_password_confirm"
                      type="password"
                      {...passwordForm.register("new_password_confirm")}
                    />
                    {passwordForm.formState.errors.new_password_confirm && (
                      <p className="text-sm text-destructive">
                        {passwordForm.formState.errors.new_password_confirm.message}
                      </p>
                    )}
                  </div>
                </div>
                <Separator />
                <div className="flex justify-end">
                  <Button type="submit" disabled={passwordLoading}>
                    <Lock className="mr-2 h-4 w-4" />
                    {passwordLoading ? "Wird geändert..." : "Passwort ändern"}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
