"use client";

import { Suspense, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, CheckCircle, Loader2, Lock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const resetSchema = z
  .object({
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

type ResetFormValues = z.infer<typeof resetSchema>;

/**
 * Password reset confirmation page.
 * Expects URL params: ?uid=...&token=...
 */
/**
 * Wrapper component with Suspense boundary for useSearchParams.
 */
export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-[#FFCC00]" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: {
      new_password: "",
      new_password_confirm: "",
    },
  });

  // Validate that uid and token are present
  const [isValid, setIsValid] = useState(true);
  useEffect(() => {
    if (!uid || !token) {
      setIsValid(false);
    }
  }, [uid, token]);

  const onSubmit = async (data: ResetFormValues) => {
    if (!uid || !token) return;
    setServerError(null);
    try {
      await authApi.confirmPasswordReset({
        uid,
        token,
        new_password: data.new_password,
        new_password_confirm: data.new_password_confirm,
      });
      setIsSuccess(true);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { data?: Record<string, string[]> } }).response
          ?.data
      ) {
        const errorData = (
          error as { response: { data: Record<string, string[]> } }
        ).response.data;
        const firstError = Object.values(errorData).flat()[0];
        setServerError(
          firstError || "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
        );
      } else {
        setServerError(
          "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
        );
      }
    }
  };

  if (!isValid) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:bg-black/30 dark:shadow-2xl dark:shadow-yellow-900/10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-950/30">
            <AlertTriangle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground dark:text-yellow-50">
            Ungültiger Link
          </h2>
          <p className="text-sm text-gray-500 dark:text-yellow-100/50">
            Der Link zum Zurücksetzen des Passworts ist ungültig oder abgelaufen.
            Bitte fordern Sie einen neuen Link an.
          </p>
          <Link
            href="/forgot-password"
            className="inline-flex items-center text-sm text-[#FFCC00] hover:underline"
          >
            Neuen Link anfordern
          </Link>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:bg-black/30 dark:shadow-2xl dark:shadow-yellow-900/10">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
            <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground dark:text-yellow-50">
            Passwort zurückgesetzt
          </h2>
          <p className="text-sm text-gray-500 dark:text-yellow-100/50">
            Ihr Passwort wurde erfolgreich geändert. Sie können sich jetzt mit
            Ihrem neuen Passwort anmelden.
          </p>
          <Link href="/login">
            <Button className="bg-[#1a1a1a] text-white hover:bg-[#333333] dark:bg-[#FFCC00] dark:text-[#1a1a1a] dark:hover:bg-[#FFD633]">
              Zur Anmeldung
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex w-full flex-col items-center justify-center">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 h-20 w-20 overflow-hidden rounded-xl shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/logos/hilfswerk-logo.svg"
            alt="Hilfswerk Logo"
            className="h-full w-full object-cover"
          />
        </div>
        <h1 className="text-2xl font-bold text-foreground dark:text-yellow-50">
          Neues Passwort setzen
        </h1>
        <p className="mt-1 text-center text-sm text-foreground/70 dark:text-yellow-100/60">
          Geben Sie Ihr neues Passwort ein
        </p>
      </div>

      {/* Reset Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:bg-black/30 dark:shadow-2xl dark:shadow-yellow-900/10">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Server Error */}
            {serverError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                {serverError}
              </div>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <Label
                htmlFor="new_password"
                className="text-sm font-medium text-gray-700 dark:text-yellow-100/80"
              >
                Neues Passwort
              </Label>
              <Input
                id="new_password"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                autoFocus
                className="border-gray-300 bg-white/90 focus:border-[#FFCC00] focus:ring-[#FFCC00] dark:border-yellow-900/30 dark:bg-black/40 dark:text-yellow-50 dark:placeholder:text-yellow-100/30"
                {...register("new_password")}
              />
              {errors.new_password && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.new_password.message}
                </p>
              )}
              <p className="text-xs text-gray-400 dark:text-yellow-100/40">
                Mindestens 8 Zeichen, ein Großbuchstabe und eine Zahl
              </p>
            </div>

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label
                htmlFor="new_password_confirm"
                className="text-sm font-medium text-gray-700 dark:text-yellow-100/80"
              >
                Passwort bestätigen
              </Label>
              <Input
                id="new_password_confirm"
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                className="border-gray-300 bg-white/90 focus:border-[#FFCC00] focus:ring-[#FFCC00] dark:border-yellow-900/30 dark:bg-black/40 dark:text-yellow-50 dark:placeholder:text-yellow-100/30"
                {...register("new_password_confirm")}
              />
              {errors.new_password_confirm && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.new_password_confirm.message}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full bg-[#1a1a1a] text-white hover:bg-[#333333] dark:bg-[#FFCC00] dark:text-[#1a1a1a] dark:hover:bg-[#FFD633]"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Passwort zurücksetzen
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Back to Login */}
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-yellow-100/50 dark:hover:text-yellow-100/80"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Zurück zur Anmeldung
          </Link>
        </div>
      </div>
    </div>
  );
}
