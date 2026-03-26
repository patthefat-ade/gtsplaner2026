import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js middleware for route protection.
 *
 * Since JWT tokens are stored in localStorage (client-side only),
 * we use a lightweight cookie-based flag to check auth status in middleware.
 * The actual token validation happens on the client side via the AuthProvider.
 *
 * Public routes: /login, /forgot-password, /reset-password, /api/*
 * Protected routes: everything else (dashboard, etc.)
 *
 * IMPORTANT: All middleware responses set Cache-Control: no-store to prevent
 * CDN/edge caching of authentication-dependent redirects.
 */

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"];

/**
 * Apply no-cache headers to prevent CDN/edge caching of auth-dependent responses.
 */
function withNoCacheHeaders(response: NextResponse): NextResponse {
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate",
  );
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow static assets and Next.js internals without modification
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/assets") ||
    pathname.startsWith("/icons") ||
    pathname === "/manifest.json" ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  // Check for auth cookie (set by client after login)
  const isAuthenticated = request.cookies.get("is_authenticated");

  // Public paths: allow access, but redirect authenticated users away from login
  if (
    PUBLIC_PATHS.some((path) => pathname.startsWith(path)) ||
    pathname.startsWith("/api")
  ) {
    // If user is already authenticated and tries to access /login, redirect to dashboard
    if (isAuthenticated && pathname.startsWith("/login")) {
      const dashboardUrl = new URL("/", request.url);
      return withNoCacheHeaders(NextResponse.redirect(dashboardUrl));
    }

    return withNoCacheHeaders(NextResponse.next());
  }

  // Protected routes: redirect to login if not authenticated
  if (!isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return withNoCacheHeaders(NextResponse.redirect(loginUrl));
  }

  // Authenticated user accessing protected route – allow access
  return withNoCacheHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
