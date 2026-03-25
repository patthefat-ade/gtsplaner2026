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
 * Set a simple cookie to signal authentication status to the middleware.
 */
function setAuthCookie(authenticated: boolean) {
  if (typeof document === "undefined") return;
  if (authenticated) {
    document.cookie = "is_authenticated=true; path=/; max-age=604800; SameSite=Lax";
  } else {
    document.cookie = "is_authenticated=; path=/; max-age=0; SameSite=Lax";
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  /**
   * Check if the user is authenticated on mount.
   */
  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setAuthCookie(false);
      setIsLoading(false);
      return;
    }

    try {
      const profile = await authApi.getProfile();
      setUser(profile);
      setAuthCookie(true);
    } catch {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
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
   * Login with credentials and store tokens.
   * Returns the response so the caller can check requires_2fa.
   */
  const login = useCallback(
    async (credentials: LoginCredentials): Promise<LoginResponse> => {
      const response = await authApi.login(credentials);

      // If 2FA is required, don't store tokens yet – return response for 2FA page
      if (response.requires_2fa) {
        return response;
      }

      // Standard login without 2FA
      if (response.access && response.refresh) {
        localStorage.setItem("access_token", response.access);
        localStorage.setItem("refresh_token", response.refresh);
        setAuthCookie(true);

        // Fetch full profile after login
        const profile = await authApi.getProfile();
        setUser(profile);
        router.push("/");
      }

      return response;
    },
    [router],
  );

  /**
   * Complete login with 2FA verification.
   */
  const loginWith2FA = useCallback(
    async (userId: number, code: string) => {
      const response = await authApi.verify2FALogin({ user_id: userId, code });

      if (response.access && response.refresh) {
        localStorage.setItem("access_token", response.access);
        localStorage.setItem("refresh_token", response.refresh);
        setAuthCookie(true);

        // Fetch full profile after login
        const profile = await authApi.getProfile();
        setUser(profile);
        router.push("/");
      }
    },
    [router],
  );

  /**
   * Logout and clear tokens.
   */
  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("refresh_token");
    try {
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // Ignore errors during logout
    } finally {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
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
