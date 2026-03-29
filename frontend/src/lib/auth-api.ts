/**
 * Auth API service – handles all authentication-related API calls.
 *
 * JWT tokens are managed via httpOnly cookies set by the backend.
 * No manual token handling is needed on the client side.
 */

import api from "@/lib/api";
import type {
  LoginCredentials,
  LoginResponse,
  PasswordChange,
  PasswordResetConfirm,
  PasswordResetRequest,
  TwoFactorLoginVerify,
  TwoFactorSetupResponse,
  TwoFactorStatusResponse,
  TwoFactorVerifyCode,
  UserProfile,
} from "@/types/auth";

export const authApi = {
  /**
   * Login with username/email and password.
   * The backend sets httpOnly cookies with JWT tokens in the response.
   * May return requires_2fa=true if 2FA is enabled.
   */
  login: async (credentials: LoginCredentials): Promise<LoginResponse> => {
    const { data } = await api.post<LoginResponse>("/auth/login/", credentials);
    return data;
  },

  /**
   * Logout by calling the backend which blacklists the refresh token
   * and clears the httpOnly cookies.
   */
  logout: async (): Promise<void> => {
    await api.post("/auth/logout/");
  },

  /**
   * Refresh the access token.
   * The backend reads the refresh token from the httpOnly cookie
   * and sets new tokens as cookies in the response.
   */
  refreshToken: async (): Promise<void> => {
    await api.post("/auth/refresh/");
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
   * The backend sets httpOnly cookies with JWT tokens in the response.
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

  // ── Terms & Privacy ─────────────────────────────────────────────

  /**
   * Accept privacy policy and terms of service.
   */
  acceptTerms: async (): Promise<{ detail: string; has_accepted_terms: boolean; terms_accepted_at: string }> => {
    const { data } = await api.post("/auth/accept-terms/");
    return data;
  },
};
