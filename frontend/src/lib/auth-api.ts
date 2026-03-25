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
  TwoFactorLoginVerify,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
  TwoFactorVerifyCode,
  UserProfile,
} from "@/types/auth";

export const authApi = {
  /**
   * Login with username/email and password.
   * May return requires_2fa=true if 2FA is enabled.
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

  // ── Two-Factor Authentication (2FA) ──────────────────────────────

  /**
   * Setup 2FA: Generate TOTP secret and QR code.
   */
  setup2FA: async (): Promise<TwoFactorSetupResponse> => {
    const { data } = await api.post<TwoFactorSetupResponse>("/auth/2fa/setup/");
    return data;
  },

  /**
   * Verify TOTP code to activate 2FA.
   */
  verify2FA: async (payload: TwoFactorVerifyCode): Promise<void> => {
    await api.post("/auth/2fa/verify/", payload);
  },

  /**
   * Disable 2FA with current TOTP code.
   */
  disable2FA: async (payload: TwoFactorVerifyCode): Promise<void> => {
    await api.post("/auth/2fa/disable/", payload);
  },

  /**
   * Verify 2FA during login process.
   * Returns JWT tokens upon successful verification.
   */
  verify2FALogin: async (payload: TwoFactorLoginVerify): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>("/auth/2fa/login-verify/", payload);
    return data;
  },

  /**
   * Get 2FA status for the authenticated user.
   */
  get2FAStatus: async (): Promise<TwoFactorStatusResponse> => {
    const { data } = await api.get<TwoFactorStatusResponse>("/auth/2fa/status/");
    return data;
  },
};
