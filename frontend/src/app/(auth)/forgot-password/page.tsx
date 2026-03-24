"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod/v4";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import Link from "next/link";
import { authApi } from "@/lib/auth-api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const resetSchema = z.object({
  email: z.email("Bitte geben Sie eine gültige E-Mail-Adresse ein"),
});

type ResetFormValues = z.infer<typeof resetSchema>;

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
      // Ignore errors – always show success
    }
    setIsSuccess(true);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="space-y-1 text-center">
        <CardTitle className="text-2xl font-bold">Passwort zurücksetzen</CardTitle>
        <CardDescription>
          {isSuccess
            ? "Prüfen Sie Ihr E-Mail-Postfach"
            : "Geben Sie Ihre E-Mail-Adresse ein"}
        </CardDescription>
      </CardHeader>

      {isSuccess ? (
        <CardContent className="space-y-4">
          <div className="rounded-md border border-primary/50 bg-primary/10 p-4 text-center text-sm">
            <Mail className="mx-auto mb-2 h-8 w-8 text-primary" />
            <p>
              Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine
              E-Mail mit Anweisungen zum Zurücksetzen des Passworts gesendet.
            </p>
          </div>
        </CardContent>
      ) : (
        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@beispiel.at"
                autoComplete="email"
                autoFocus
                {...register("email")}
              />
              {errors.email && (
                <p className="text-xs text-destructive">
                  {errors.email.message}
                </p>
              )}
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Mail className="mr-2 h-4 w-4" />
              )}
              Link senden
            </Button>
          </CardFooter>
        </form>
      )}

      <div className="p-6 pt-0 text-center">
        <Link
          href="/login"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Zurück zur Anmeldung
        </Link>
      </div>
    </Card>
  );
}
