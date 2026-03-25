"use client";

import { Clock, LogOut, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SessionTimeoutDialogProps {
  open: boolean;
  remainingSeconds: number;
  onExtend: () => void;
  onLogout: () => void;
}

/**
 * Format seconds into MM:SS display.
 */
function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Session timeout warning dialog.
 * Shown 2 minutes before the JWT access token expires.
 * Allows the user to extend their session or log out.
 */
export function SessionTimeoutDialog({
  open,
  remainingSeconds,
  onExtend,
  onLogout,
}: SessionTimeoutDialogProps) {
  const isUrgent = remainingSeconds <= 30;

  return (
    <Dialog open={open}>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-950/30">
            <Clock
              className={`h-6 w-6 ${
                isUrgent
                  ? "animate-pulse text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            />
          </div>
          <DialogTitle className="text-center">
            Sitzung läuft ab
          </DialogTitle>
          <DialogDescription className="text-center">
            Ihre Sitzung läuft in Kürze ab. Möchten Sie angemeldet bleiben?
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-4">
          <div
            className={`rounded-lg px-6 py-3 text-center ${
              isUrgent
                ? "bg-red-100 dark:bg-red-950/30"
                : "bg-amber-50 dark:bg-amber-950/20"
            }`}
          >
            <p className="text-xs uppercase tracking-wider text-muted-foreground">
              Verbleibende Zeit
            </p>
            <p
              className={`text-3xl font-bold tabular-nums ${
                isUrgent
                  ? "text-red-600 dark:text-red-400"
                  : "text-amber-600 dark:text-amber-400"
              }`}
            >
              {formatTime(remainingSeconds)}
            </p>
          </div>
        </div>

        <DialogFooter className="flex gap-2 sm:justify-center">
          <Button
            variant="outline"
            onClick={onLogout}
            className="flex-1"
          >
            <LogOut className="mr-2 h-4 w-4" />
            Abmelden
          </Button>
          <Button
            onClick={onExtend}
            className="flex-1 bg-[#FFCC00] text-[#1a1a1a] hover:bg-[#FFD633]"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Sitzung verlängern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
