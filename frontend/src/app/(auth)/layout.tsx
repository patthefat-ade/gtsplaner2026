"use client";

import Image from "next/image";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

// Hydration-safe mounted check ohne useEffect + setState
const emptySubscribe = () => () => {};
function useMounted() {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/**
 * Auth layout – 40/60 splitscreen layout for login and password reset pages.
 * Left side (40%): Auth form on yellow gradient background with Hilfswerk logo.
 * Right side (60%): Animated cartoon children illustration.
 * On mobile: Only the form is shown with yellow gradient.
 */
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { resolvedTheme } = useTheme();
  const mounted = useMounted();

  const isDark = mounted && resolvedTheme === "dark";

  return (
    <div className="flex min-h-screen w-full">
      {/* Left side – Login Form (40%) with yellow gradient */}
      <div
        className="relative flex w-full flex-col items-center justify-center px-4 py-8 lg:w-[40%] lg:px-8"
        style={{
          background: isDark
            ? "linear-gradient(135deg, #1a1700 0%, #2d2400 30%, #3d3200 60%, #1a1700 100%)"
            : "linear-gradient(135deg, #FFCC00 0%, #FFD633 30%, #FFE066 60%, #FFF2B2 100%)",
        }}
      >
        {/* Subtle pattern overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-5"
          style={{
            backgroundImage: isDark
              ? "radial-gradient(circle at 25% 25%, #FFCC00 1px, transparent 1px)"
              : "radial-gradient(circle at 25% 25%, #000000 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        <div className="relative z-10 w-full max-w-md">{children}</div>

        {/* Bottom branding */}
        <div className="absolute bottom-6 left-0 right-0 z-10 text-center">
          <p
            className={`text-xs tracking-wide ${
              isDark ? "text-yellow-600/60" : "text-yellow-800/40"
            }`}
          >
            &copy; {new Date().getFullYear()} Hilfswerk
          </p>
        </div>
      </div>

      {/* Right side – Illustration (60%) – hidden on mobile */}
      <div className="relative hidden overflow-hidden lg:flex lg:w-[60%] lg:items-center lg:justify-center">
        {/* Gradient background */}
        <div
          className={`absolute inset-0 transition-colors duration-500 ${
            isDark
              ? "bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900"
              : "bg-gradient-to-br from-sky-100 via-amber-50 to-emerald-50"
          }`}
        />

        {/* Floating decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          {/* Animated circles */}
          <div
            className={`absolute -left-8 top-1/4 h-32 w-32 rounded-full opacity-20 animate-float-slow ${
              isDark ? "bg-yellow-400" : "bg-yellow-300"
            }`}
          />
          <div
            className={`absolute right-12 top-12 h-20 w-20 rounded-full opacity-15 animate-float-medium ${
              isDark ? "bg-purple-400" : "bg-pink-300"
            }`}
          />
          <div
            className={`absolute bottom-24 left-16 h-16 w-16 rounded-full opacity-20 animate-float-fast ${
              isDark ? "bg-blue-400" : "bg-green-300"
            }`}
          />
          <div
            className={`absolute bottom-1/3 right-8 h-24 w-24 rounded-full opacity-10 animate-float-slow ${
              isDark ? "bg-cyan-400" : "bg-orange-200"
            }`}
          />

          {/* Animated sparkles */}
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`absolute h-2 w-2 rounded-full animate-twinkle ${
                isDark ? "bg-yellow-200" : "bg-yellow-400"
              }`}
              style={{
                top: `${15 + i * 14}%`,
                left: `${10 + i * 15}%`,
                animationDelay: `${i * 0.4}s`,
              }}
            />
          ))}
        </div>

        {/* Main illustration */}
        <div className="relative z-10 flex w-full max-w-2xl items-center justify-center p-8 animate-fade-in-up">
          <Image
            src={
              isDark
                ? "/assets/login/children-scene-dark.webp"
                : "/assets/login/children-scene-main.webp"
            }
            alt="Fröhliche Kinder beim Spielen und Lernen – GTS Planner"
            width={800}
            height={1067}
            className="h-auto w-full max-h-[80vh] object-contain drop-shadow-2xl animate-gentle-bounce"
            priority
          />
        </div>

        {/* Bottom tagline */}
        <div className="absolute bottom-8 left-0 right-0 z-20 text-center">
          <p
            className={`text-sm font-medium tracking-wide ${
              isDark ? "text-slate-400" : "text-slate-500"
            }`}
          >
            Freizeitpädagogik mit Freude gestalten
          </p>
        </div>
      </div>
    </div>
  );
}
