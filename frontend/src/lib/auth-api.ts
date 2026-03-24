/**
 * Auth API service – handles all authentication-related API calls.
 */

import api from "@/lib/api";
import type {
  LoginCredentials,
  LoginResponse,
  PasswordChange,
  PasswordResetConfirm,
  PasswordResetRequest,
  TokenRefreshResponse,
  UserProfile,
} from "@/types/auth";

export const authApi = {
  /**
   * Login with username/email and password.
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>("/auth/login/", credentials);
    return data;
  },

  /**
   * Logout by blacklisting the refresh token.
   */
  logout: async (refreshToken: string): Promise<void> => {
    await api.post("/auth/logout/", { refresh: refreshToken });
  },

  /**
   * Refresh the access token.
   */
  refreshToken: async (
    refreshToken: string,
  ): Promise<TokenRefreshResponse> => {
    const { data } = await api.post<TokenRefreshResponse>("/auth/refresh/", {
      refresh: refreshToken,
    });
    return data;
  },

  /**
   * Get the authenticated user's profile.
   */
  getProfile: async (): Promise<UserProfile> => {
    const { data } = await api.get<UserProfile>("/auth/me/");
    return data;
  },

  /**
   * Update the authenticated user's profile.
   */
  updateProfile: async (
    profileData: Partial<UserProfile>,
  ): Promise<UserProfile> => {
    const { data } = await api.patch<UserProfile>("/auth/me/", profileData);
    return data;
  },

  /**
   * Request a password reset email.
   */
  requestPasswordReset: async (payload: PasswordResetRequest): Promise<void> => {
    await api.post("/auth/password-reset/", payload);
  },

  /**
   * Confirm a password reset with token and new password.
   */
  confirmPasswordReset: async (
    payload: PasswordResetConfirm,
  ): Promise<void> => {
    await api.post("/auth/password-reset/confirm/", payload);
  },

  /**
   * Change the authenticated user's password.
   */
  changePassword: async (payload: PasswordChange): Promise<void> => {
    await api.post("/auth/password-change/", payload);
  },
};
