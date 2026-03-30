"use client";

import { useState, useEffect, useRef } from "react";
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
import {
  User,
  Shield,
  ShieldCheck,
  ShieldOff,
  MapPin,
  Mail,
  Calendar,
  Lock,
  Save,
  Loader2,
  Smartphone,
} from "lucide-react";
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
  sub_admin: "Sub-Admin",
  admin: "Admin",
  super_admin: "Super-Admin",
};

export default function ProfilePage() {
  const { user, refreshProfile } = useAuth();
  const toast = useToast();
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // 2FA State
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);
  const [is2FALoading, setIs2FALoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [twoFAError, setTwoFAError] = useState<string | null>(null);
  const [twoFASubmitting, setTwoFASubmitting] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState(["", "", "", "", "", ""]);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const disableRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Load 2FA status
  useEffect(() => {
    const load2FAStatus = async () => {
      try {
        const status = await authApi.get2FAStatus();
        setIs2FAEnabled(status.is_2fa_enabled);
      } catch {
        // Ignore errors
      } finally {
        setIs2FALoading(false);
      }
    };
    load2FAStatus();
  }, []);

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

  // ── 2FA Handlers ──

  const handleSetup2FA = async () => {
    setTwoFAError(null);
    setTwoFASubmitting(true);
    try {
      const response = await authApi.setup2FA();
      setQrCode(response.qr_code);
      setSecret(response.secret);
      setShowSetup(true);
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    } catch (err) {
      toast.error("Fehler", getErrorMessage(err));
    } finally {
      setTwoFASubmitting(false);
    }
  };

  const handleOtpChange = (
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    code: string[],
    setCode: (c: string[]) => void,
    index: number,
    value: string,
  ) => {
    if (!/^\d*$/.test(value)) return;
    const newCode = [...code];
    newCode[index] = value.slice(-1);
    setCode(newCode);
    if (value && index < 5) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    code: string[],
    index: number,
    e: React.KeyboardEvent,
  ) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      refs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (
    setCode: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
    e: React.ClipboardEvent,
  ) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(""));
      refs.current[5]?.focus();
    }
  };

  const handleVerify2FA = async () => {
    const code = otpCode.join("");
    if (code.length !== 6) {
      setTwoFAError("Bitte geben Sie den vollständigen 6-stelligen Code ein.");
      return;
    }
    setTwoFAError(null);
    setTwoFASubmitting(true);
    try {
      await authApi.verify2FA({ code });
      setIs2FAEnabled(true);
      setShowSetup(false);
      setQrCode(null);
      setSecret(null);
      setOtpCode(["", "", "", "", "", ""]);
      toast.success("Zwei-Faktor-Authentifizierung aktiviert");
    } catch (err) {
      setTwoFAError(getErrorMessage(err));
      setOtpCode(["", "", "", "", "", ""]);
      otpRefs.current[0]?.focus();
    } finally {
      setTwoFASubmitting(false);
    }
  };

  const handleDisable2FA = async () => {
    const code = disableCode.join("");
    if (code.length !== 6) {
      setTwoFAError("Bitte geben Sie den vollständigen 6-stelligen Code ein.");
      return;
    }
    setTwoFAError(null);
    setTwoFASubmitting(true);
    try {
      await authApi.disable2FA({ code });
      setIs2FAEnabled(false);
      setShowDisable(false);
      setDisableCode(["", "", "", "", "", ""]);
      toast.success("Zwei-Faktor-Authentifizierung deaktiviert");
    } catch (err) {
      setTwoFAError(getErrorMessage(err));
      setDisableCode(["", "", "", "", "", ""]);
      disableRefs.current[0]?.focus();
    } finally {
      setTwoFASubmitting(false);
    }
  };

  const renderOtpInputs = (
    code: string[],
    setCode: (c: string[]) => void,
    refs: React.MutableRefObject<(HTMLInputElement | null)[]>,
  ) => (
    <div
      className="flex justify-center gap-2"
      onPaste={(e) => handleOtpPaste(setCode, refs, e)}
    >
      {code.map((digit, index) => (
        <input
          key={index}
          ref={(el) => { refs.current[index] = el; }}
          type="text"
          inputMode="numeric"
          maxLength={1}
          value={digit}
          onChange={(e) => handleOtpChange(refs, code, setCode, index, e.target.value)}
          onKeyDown={(e) => handleOtpKeyDown(refs, code, index, e)}
          className="h-12 w-10 rounded-lg border border-border bg-background text-center text-xl font-bold text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary"
        />
      ))}
    </div>
  );

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
            {is2FAEnabled && (
              <Badge variant="default" className="mt-2 gap-1 bg-green-600">
                <ShieldCheck className="h-3 w-3" />
                2FA aktiv
              </Badge>
            )}
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

          {/* Two-Factor Authentication Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Smartphone className="h-4 w-4" />
                Zwei-Faktor-Authentifizierung (2FA)
              </CardTitle>
              <CardDescription>
                Schütze dein Konto mit einem zusätzlichen Sicherheitsfaktor über
                eine Authenticator App (z.B. Google Authenticator, Authy).
              </CardDescription>
            </CardHeader>
            <CardContent>
              {is2FALoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : is2FAEnabled && !showDisable ? (
                /* 2FA is enabled */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-900 dark:bg-green-950/30">
                    <ShieldCheck className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-300">
                        2FA ist aktiviert
                      </p>
                      <p className="text-sm text-green-700 dark:text-green-400">
                        Dein Konto ist mit einer Authenticator App geschützt.
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      setShowDisable(true);
                      setTwoFAError(null);
                      setTimeout(() => disableRefs.current[0]?.focus(), 100);
                    }}
                  >
                    <ShieldOff className="mr-2 h-4 w-4" />
                    2FA deaktivieren
                  </Button>
                </div>
              ) : showDisable ? (
                /* Disable 2FA form */
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    Gib den aktuellen 6-stelligen Code aus deiner Authenticator App ein,
                    um 2FA zu deaktivieren.
                  </p>
                  {twoFAError && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                      {twoFAError}
                    </div>
                  )}
                  {renderOtpInputs(disableCode, setDisableCode, disableRefs)}
                  <div className="flex gap-2">
                    <Button
                      variant="destructive"
                      onClick={handleDisable2FA}
                      disabled={twoFASubmitting || disableCode.join("").length !== 6}
                    >
                      {twoFASubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldOff className="mr-2 h-4 w-4" />
                      )}
                      Deaktivieren
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowDisable(false);
                        setTwoFAError(null);
                        setDisableCode(["", "", "", "", "", ""]);
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : showSetup ? (
                /* Setup 2FA form with QR code */
                <div className="space-y-6">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      1. Scanne den QR-Code mit deiner Authenticator App:
                    </p>
                    {qrCode && (
                      <div className="flex justify-center">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={qrCode}
                          alt="2FA QR Code"
                          className="h-48 w-48 rounded-lg border bg-white p-2"
                        />
                      </div>
                    )}
                    {secret && (
                      <div className="rounded-lg border bg-muted/50 p-3 text-center">
                        <p className="text-xs text-muted-foreground">
                          Oder gib diesen Code manuell ein:
                        </p>
                        <p className="mt-1 font-mono text-sm font-bold tracking-wider">
                          {secret}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      2. Gib den 6-stelligen Code aus der App ein:
                    </p>
                    {twoFAError && (
                      <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                        {twoFAError}
                      </div>
                    )}
                    {renderOtpInputs(otpCode, setOtpCode, otpRefs)}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={handleVerify2FA}
                      disabled={twoFASubmitting || otpCode.join("").length !== 6}
                    >
                      {twoFASubmitting ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ShieldCheck className="mr-2 h-4 w-4" />
                      )}
                      2FA aktivieren
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowSetup(false);
                        setQrCode(null);
                        setSecret(null);
                        setOtpCode(["", "", "", "", "", ""]);
                        setTwoFAError(null);
                      }}
                    >
                      Abbrechen
                    </Button>
                  </div>
                </div>
              ) : (
                /* 2FA not enabled – show setup button */
                <div className="space-y-4">
                  <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/30">
                    <Shield className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        2FA ist nicht aktiviert
                      </p>
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Wir empfehlen, 2FA zu aktivieren, um dein Konto zusätzlich zu schützen.
                      </p>
                    </div>
                  </div>
                  <Button onClick={handleSetup2FA} disabled={twoFASubmitting}>
                    {twoFASubmitting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <ShieldCheck className="mr-2 h-4 w-4" />
                    )}
                    2FA einrichten
                  </Button>
                </div>
              )}
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
