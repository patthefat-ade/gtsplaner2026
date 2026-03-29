"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { authApi } from "@/lib/auth-api";
import type { LoginCredentials, LoginResponse, UserProfile } from "@/types/auth";

interface AuthContextType {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: LoginCredentials) => Promise<LoginResponse>;
  loginWith2FA: (userId: number, code: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Set a simple cookie to signal authentication status to the Next.js middleware.
 *
 * This is a non-httpOnly cookie that the middleware can read to decide
 * whether to redirect to /login. The actual JWT tokens are stored in
 * httpOnly cookies managed by the backend.
 */
function setAuthCookie(authenticated: boolean) {
  if (typeof document === "undefined") return;
  const isSecure = window.location.protocol === "https:";
  const secureFlag = isSecure ? "; Secure" : "";
  if (authenticated) {
    document.cookie = `is_authenticated=true; path=/; max-age=604800; SameSite=Lax${secureFlag}`;
  } else {
    document.cookie = `is_authenticated=; path=/; max-age=0; SameSite=Lax${secureFlag}`;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /**
   * Check if the user is authenticated on mount.
   *
   * Since JWT tokens are now in httpOnly cookies (not accessible via JS),
   * we check auth status by calling the /auth/me/ endpoint.
   * If the cookie is valid, the backend returns the user profile.
   */
  const checkAuth = useCallback(async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
      setAuthCookie(true);
    } catch {
      setAuthCookie(false);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  /**
   * Login with credentials.
   * The backend sets httpOnly cookies in the response.
   * Returns the response so the caller can check requires_2fa.
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const response = await authApi.login(credentials);

      // If 2FA is required, don't set auth state yet
      if (response.requires_2fa) {
        return response;
      }

      // Standard login without 2FA – cookies are already set by the backend
      setAuthCookie(true);

      // Fetch full profile after login
      const profile = await authApi.getProfile();
      setUser(profile);

      // Use window.location for a full page navigation to ensure
      // the middleware sees the newly set cookie on the server request.
      window.location.href = "/";

      return response;
    },
    [],
  );

  /**
   * Complete login with 2FA verification.
   * The backend sets httpOnly cookies in the response.
   */
  const loginWith2FA = useCallback(
    async (userId: number, code: string) => {
      await authApi.verify2FALogin({ user_id: userId, code });

      // Cookies are set by the backend response
      setAuthCookie(true);

      // Fetch full profile after login
      const profile = await authApi.getProfile();
      setUser(profile);

      // Use window.location for a full page navigation
      window.location.href = "/";
    },
    [],
  );

  /**
   * Logout: call backend to blacklist refresh token and clear cookies.
   */
  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore errors during logout
    } finally {
      setAuthCookie(false);
      setUser(null);
      router.push("/login");
    }
  }, [router]);

  /**
   * Refresh the user profile from the API.
   */
  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getProfile();
      setUser(profile);
    } catch {
      // Ignore errors
    }
  }, []);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      loginWith2FA,
      logout,
      refreshProfile,
    }),
    [user, isLoading, login, loginWith2FA, logout, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
