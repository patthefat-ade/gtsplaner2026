"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Loader2, LogIn } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import Image from "next/image";
import Link from "next/link";

/**
 * Zod validation schema for the login form.
 */
const loginSchema = z.object({
  username: z
    .string()
    .min(1, "Benutzername oder E-Mail ist erforderlich"),
  password: z
    .string()
    .min(1, "Passwort ist erforderlich"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

/**
 * Login page with Hilfswerk branding on yellow gradient background.
 * Features: Logo, new slogan, form validation, error handling.
 */
export default function LoginPage() {
  const { login } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      await login(data);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { data?: { non_field_errors?: string[] } } })
          .response?.data?.non_field_errors
      ) {
        setServerError(
          (
            error as {
              response: { data: { non_field_errors: string[] } };
            }
          ).response.data.non_field_errors[0],
        );
      } else {
        setServerError(
          "Anmeldung fehlgeschlagen. Bitte überprüfen Sie Ihre Eingaben.",
        );
      }
    }
  };

  return (
    <div className="relative flex w-full flex-col items-center justify-center">
      {/* Theme Toggle in top-right corner */}
      <div className="absolute right-0 top-0 z-50 lg:-right-4 lg:-top-4">
        <ThemeToggle />
      </div>

      {/* Logo */}
      <div className="mb-8 flex flex-col items-center">
        <div className="mb-4 flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl bg-[#FFCC00] shadow-lg">
          <Image
            src="/assets/logos/hilfswerk-logo.svg"
            alt="Hilfswerk Logo"
            width={80}
            height={80}
            className="h-full w-full object-contain"
            priority
          />
        </div>
        <h1 className="text-2xl font-bold text-foreground dark:text-yellow-50">
          GTS Planner
        </h1>
        <p className="mt-1 text-center text-sm text-foreground/70 dark:text-yellow-100/60">
          Digitale Unterstützung in der täglichen Zusammenarbeit
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:bg-black/30 dark:shadow-2xl dark:shadow-yellow-900/10">
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            {/* Server Error */}
            {serverError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                {serverError}
              </div>
            )}

            {/* Username / Email */}
            <div className="space-y-2">
              <Label
                htmlFor="username"
                className="text-sm font-medium text-gray-700 dark:text-yellow-100/80"
              >
                Benutzername oder E-Mail
              </Label>
              <Input
                id="username"
                type="text"
                placeholder="name@beispiel.at"
                autoComplete="username"
                autoFocus
                className="border-gray-300 bg-white/90 focus:border-[#FFCC00] focus:ring-[#FFCC00] dark:border-yellow-900/30 dark:bg-black/40 dark:text-yellow-50 dark:placeholder:text-yellow-100/30"
                {...register("username")}
              />
              {errors.username && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.username.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label
                htmlFor="password"
                className="text-sm font-medium text-gray-700 dark:text-yellow-100/80"
              >
                Passwort
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                className="border-gray-300 bg-white/90 focus:border-[#FFCC00] focus:ring-[#FFCC00] dark:border-yellow-900/30 dark:bg-black/40 dark:text-yellow-50 dark:placeholder:text-yellow-100/30"
                {...register("password")}
              />
              {errors.password && (
                <p className="text-xs text-red-600 dark:text-red-400">
                  {errors.password.message}
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
                  Anmeldung...
                </>
              ) : (
                <>
                  <LogIn className="mr-2 h-4 w-4" />
                  Anmelden
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Forgot Password Link */}
        <div className="mt-4 text-center">
          <Link
            href="/forgot-password"
            className="text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-yellow-100/50 dark:hover:text-yellow-100/80"
          >
            Passwort vergessen?
          </Link>
        </div>
      </div>
    </div>
  );
}
