/**
 * TypeScript type definitions for authentication.
 */

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  access: string;
  refresh: string;
  user: AuthUser;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "educator" | "location_manager" | "admin" | "super_admin";
  location: number | null;
}

export interface UserProfile extends AuthUser {
  full_name: string;
  role_display: string;
  location_detail: {
    id: number;
    name: string;
    city: string;
  } | null;
  phone: string;
  profile_picture: string | null;
  is_active: boolean;
  last_login: string | null;
  date_joined: string;
  last_password_change: string | null;
}

export interface TokenRefreshResponse {
  access: string;
  refresh?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  uid: string;
  token: string;
  new_password: string;
  new_password_confirm: string;
}

export interface PasswordChange {
  old_password: string;
  new_password: string;
  new_password_confirm: string;
}
