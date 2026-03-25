"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { ArrowLeft, Loader2, Mail, CheckCircle } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const resetSchema = z.object({
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

type ResetFormValues = z.infer<typeof resetSchema>;

/**
 * Forgot password page with Hilfswerk branding.
 */
export default function ForgotPasswordPage() {
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = async (data: ResetFormValues) => {
    try {
      await authApi.requestPasswordReset(data);
    } catch {
      // Ignore errors – always show success to prevent email enumeration
    }
    setIsSuccess(true);
  };

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
          Passwort vergessen
        </h1>
        <p className="mt-1 text-center text-sm text-foreground/70 dark:text-yellow-100/60">
          {isSuccess
            ? "Prüfen Sie Ihr E-Mail-Postfach"
            : "Geben Sie Ihre E-Mail-Adresse ein"}
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:bg-black/30 dark:shadow-2xl dark:shadow-yellow-900/10">
        {isSuccess ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-100 dark:bg-green-950/30">
              <CheckCircle className="h-7 w-7 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-yellow-100/60">
                Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine
                E-Mail mit Anweisungen zum Zurücksetzen des Passworts gesendet.
              </p>
              <p className="mt-3 text-xs text-gray-400 dark:text-yellow-100/40">
                Bitte prüfen Sie auch Ihren Spam-Ordner.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label
                  htmlFor="email"
                  className="text-sm font-medium text-gray-700 dark:text-yellow-100/80"
                >
                  E-Mail-Adresse
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@beispiel.at"
                  autoComplete="email"
                  autoFocus
                  className="border-gray-300 bg-white/90 focus:border-[#FFCC00] focus:ring-[#FFCC00] dark:border-yellow-900/30 dark:bg-black/40 dark:text-yellow-50 dark:placeholder:text-yellow-100/30"
                  {...register("email")}
                />
                {errors.email && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {errors.email.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full bg-[#1a1a1a] text-white hover:bg-[#333333] dark:bg-[#FFCC00] dark:text-[#1a1a1a] dark:hover:bg-[#FFD633]"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Wird gesendet...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Link senden
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

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
