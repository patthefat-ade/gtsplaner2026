"use client";

import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { Loader2, LogIn, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ThemeToggle } from "@/components/ui/theme-toggle";
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
 * Features: Logo, new slogan, form validation, 2FA support, error handling.
 */
export default function LoginPage() {
  const { login, loginWith2FA } = useAuth();
  const [serverError, setServerError] = useState<string | null>(null);
  const [show2FA, setShow2FA] = useState(false);
  const [pending2FAUserId, setPending2FAUserId] = useState<number | null>(null);
  const [otpCode, setOtpCode] = useState(["", "", "", "", "", ""]);
  const [is2FASubmitting, setIs2FASubmitting] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  // Auto-focus first OTP input when 2FA view appears
  useEffect(() => {
    if (show2FA && otpInputRefs.current[0]) {
      otpInputRefs.current[0].focus();
    }
  }, [show2FA]);

  const onSubmit = async (data: LoginFormValues) => {
    setServerError(null);
    try {
      const response = await login(data);
      if (response.requires_2fa && response.user_id) {
        setPending2FAUserId(response.user_id);
        setShow2FA(true);
      }
      // If login was successful and no 2FA required, the auth-provider
      // triggers window.location.href = "/" which reloads the page.
      // No further action needed here.
    } catch (error: unknown) {
      // Ignore errors caused by page navigation during successful login.
      // When window.location.href is set, pending promises may reject
      // with a cancelled/network error. We detect this by checking if
      // the error has no HTTP response (i.e. it's not an API error).
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: unknown }).response
      ) {
        // This is a real API error with a response
        const apiError = error as { response?: { data?: { non_field_errors?: string[]; detail?: string } } };
        if (apiError.response?.data?.non_field_errors) {
          setServerError(apiError.response.data.non_field_errors[0]);
        } else if (apiError.response?.data?.detail) {
          setServerError(apiError.response.data.detail);
        } else {
          setServerError(
            "Anmeldung fehlgeschlagen. Bitte \u00FCberpr\u00FCfen Sie Ihre Eingaben.",
          );
        }
      } else {
        // No response property – likely a network error or cancelled request
        // due to page navigation. Only show error if we're still on the page
        // (i.e. navigation didn't happen).
        console.warn("Login error without API response (possibly navigation):", error);
      }
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // Only digits

    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1); // Only last character
    setOtpCode(newOtp);

    // Auto-advance to next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otpCode[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (pasted.length === 6) {
      const newOtp = pasted.split("");
      setOtpCode(newOtp);
      otpInputRefs.current[5]?.focus();
    }
  };

  const handle2FASubmit = async () => {
    if (!pending2FAUserId) return;
    const code = otpCode.join("");
    if (code.length !== 6) {
      setServerError("Bitte geben Sie den vollständigen 6-stelligen Code ein.");
      return;
    }

    setServerError(null);
    setIs2FASubmitting(true);
    try {
      await loginWith2FA(pending2FAUserId, code);
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "response" in error &&
        (error as { response?: { data?: { detail?: string } } }).response?.data
          ?.detail
      ) {
        setServerError(
          (error as { response: { data: { detail: string } } }).response.data
            .detail,
        );
      } else {
        setServerError("Ungültiger Code. Bitte versuchen Sie es erneut.");
      }
      setOtpCode(["", "", "", "", "", ""]);
      otpInputRefs.current[0]?.focus();
    } finally {
      setIs2FASubmitting(false);
    }
  };

  const handleBack = () => {
    setShow2FA(false);
    setPending2FAUserId(null);
    setOtpCode(["", "", "", "", "", ""]);
    setServerError(null);
  };

  return (
    <div className="relative flex w-full flex-col items-center justify-center">
      {/* Theme Toggle in top-right corner */}
      <div className="absolute right-0 top-0 z-50 lg:-right-4 lg:-top-4">
        <ThemeToggle />
      </div>

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
          GTS Planner
        </h1>
        <p className="mt-1 text-center text-sm text-foreground/70 dark:text-yellow-100/60">
          Digitale Unterstützung in der täglichen Zusammenarbeit
        </p>
      </div>

      {/* Login Card */}
      <div className="w-full max-w-sm rounded-2xl bg-white/80 p-6 shadow-xl backdrop-blur-sm dark:bg-black/30 dark:shadow-2xl dark:shadow-yellow-900/10">
        {!show2FA ? (
          /* ── Standard Login Form ── */
          <>
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
          </>
        ) : (
          /* ── 2FA Verification Form ── */
          <div className="space-y-6">
            {/* Back Button */}
            <button
              onClick={handleBack}
              className="flex items-center gap-1 text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-yellow-100/50 dark:hover:text-yellow-100/80"
            >
              <ArrowLeft className="h-4 w-4" />
              Zurück
            </button>

            {/* 2FA Icon and Title */}
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[#FFCC00]/20 dark:bg-[#FFCC00]/10">
                <ShieldCheck className="h-7 w-7 text-[#FFCC00]" />
              </div>
              <div className="text-center">
                <h2 className="text-lg font-semibold text-foreground dark:text-yellow-50">
                  Zwei-Faktor-Authentifizierung
                </h2>
                <p className="mt-1 text-sm text-gray-500 dark:text-yellow-100/50">
                  Geben Sie den 6-stelligen Code aus Ihrer Authenticator App ein.
                </p>
              </div>
            </div>

            {/* Server Error */}
            {serverError && (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
                {serverError}
              </div>
            )}

            {/* OTP Input Fields */}
            <div className="flex justify-center gap-2" onPaste={handleOtpPaste}>
              {otpCode.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => { otpInputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleOtpChange(index, e.target.value)}
                  onKeyDown={(e) => handleOtpKeyDown(index, e)}
                  className="h-12 w-10 rounded-lg border border-gray-300 bg-white/90 text-center text-xl font-bold text-foreground focus:border-[#FFCC00] focus:outline-none focus:ring-2 focus:ring-[#FFCC00] dark:border-yellow-900/30 dark:bg-black/40 dark:text-yellow-50"
                />
              ))}
            </div>

            {/* Verify Button */}
            <Button
              onClick={handle2FASubmit}
              className="w-full bg-[#1a1a1a] text-white hover:bg-[#333333] dark:bg-[#FFCC00] dark:text-[#1a1a1a] dark:hover:bg-[#FFD633]"
              disabled={is2FASubmitting || otpCode.join("").length !== 6}
            >
              {is2FASubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifizierung...
                </>
              ) : (
                <>
                  <ShieldCheck className="mr-2 h-4 w-4" />
                  Verifizieren
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
