import { logger } from "@/lib/logger";

import { supabase } from "@/lib/supabase";
import { apiClient } from "@/lib/api-client";
import type { User, ApiErrorResponse } from "@/types";
import axios from "axios";
import { UserDTO } from "@/lib/dto/user.dto";

export interface RegisterData {
  email: string;
  phone?: string;
  password: string;
  name: string;
}export interface ErrorWithDetails extends Error {
  details?: ApiErrorResponse['details'];
}

export const registerUser = async (data: RegisterData): Promise<User> => {
  // Use Backend API to avoid auto-login (client-side session creation)
  try {
    const response = await apiClient.post('/auth/register', {
      email: data.email,
      password: data.password,
      name: data.name,
      phone: data.phone,
      otpVerified: false // Explicitly skip OTP to force email confirmation flow
    });

    const userData = response.data.user;

    // Map backend response format to User type
    return UserDTO.fromBackend(userData);

  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as ApiErrorResponse;
      if (data.details && Array.isArray(data.details)) {
        // Detailed Zod validation errors
        const newError = new Error(data.details.map((d) => d.message).join(", ")) as ErrorWithDetails;
        newError.details = data.details;
        throw newError;
      }
      if (data.error) {
        throw new Error(data.error);
      }
    }
    throw error;
  }
};



export const loginWithGoogle = async (): Promise<void> => {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${import.meta.env.VITE_SITE_URL || window.location.origin}/auth/callback`,
      queryParams: {
        prompt: 'select_account'
      }
    },
  });

  if (error) throw error;
};

export const logoutUser = async (): Promise<void> => {
  // NOTE: Tokens are stored ONLY in HTTP-only cookies
  // No localStorage/sessionStorage cleanup needed
  try {
    const { error } = await supabase.auth.signOut();
    if (error) {
      // Ignore "AuthSessionMissingError" as it means we are already logged out locally
      if (error.name !== 'AuthSessionMissingError' && error.message !== 'Auth session missing!') {
        logger.warn("Supabase signOut error:", error);
      }
    }
  } catch (err) {
    // Ignore errors during local sign out
    logger.warn("Local signOut exception:", err);
  }

  // Clear backend cookies
  try {
    await apiClient.post('/auth/logout');
  } catch (err) {
    logger.warn("Backend logout error:", err);
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error || !session?.user) return null;

  return UserDTO.fromSupabase(session.user);
};

export const refreshToken = async () => {
  const { data, error } = await supabase.auth.refreshSession();
  if (error) throw error;
  return data;
};

/**
 * Request password reset email
 * Uses backend API for consistent token handling
 */
export const requestPasswordReset = async (email: string): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post('/auth/reset-password-request', { email });
  return response.data;
};

/**
 * Legacy reset password using Supabase direct
 * @deprecated Use requestPasswordReset instead
 */
export const resetPassword = async (email: string): Promise<void> => {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });
  if (error) throw error;
};

/**
 * Validate a password reset token
 */
export const validateResetToken = async (token: string): Promise<{ valid: boolean; email: string }> => {
  const response = await apiClient.get(`/auth/validate-reset-token?token=${token}`);
  return response.data;
};

/**
 * Reset password using a valid token
 */
export const resetPasswordWithToken = async (token: string, newPassword: string): Promise<{ success: boolean; message: string }> => {
  const response = await apiClient.post('/auth/reset-password', { token, newPassword });
  return response.data;
};

export const changePassword = async (data: { currentPassword: string; newPassword: string; otp?: string }): Promise<void> => {
  await apiClient.post("/auth/change-password", data);
};

export const sendChangePasswordOTP = async (): Promise<void> => {
  await apiClient.post("/auth/send-change-password-otp");
};

export const updateUserPassword = async (newPassword: string): Promise<void> => {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
};

// Legacy/Placeholder exports
// Helper to sync session (e.g. from Google OAuth) with Backend Cookies
export const syncSession = async (accessToken: string, refreshToken: string, silent = false): Promise<any> => {
  try {
    const { data } = await apiClient.post('/auth/sync', {
      access_token: accessToken,
      refresh_token: refreshToken
    }, { silent } as any);
    return data.user;
  } catch (error) {
    if (!silent) logger.error("Failed to sync session with backend:", error);
    throw error;
  }
};



export const validateCredentials = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/validate-credentials', { email, password });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as ApiErrorResponse;
      if (data.details && Array.isArray(data.details)) {
        const err = new Error(data.details.map((d) => d.message).join(", ")) as ErrorWithDetails;
        err.details = data.details;
        throw err;
      }
      if (data.error) throw new Error(data.error);
    }
    throw error;
  }
};

export const verifyLoginOtp = async (email: string, otp: string): Promise<User> => {
  const response = await apiClient.post("/auth/verify-login-otp", { email, otp });

  const { user, tokens } = response.data;

  // Sync Supabase Client SDK
  if (tokens && tokens.access_token && tokens.refresh_token) {
    const { error } = await supabase.auth.setSession({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token
    });
    if (error) logger.warn("Supabase session sync warning:", error);
  }

  return UserDTO.fromBackend(user);
};

export const resendConfirmationEmail = async (email: string): Promise<void> => {
  try {
    const response = await apiClient.post('/auth/resend-confirmation', { email });
    return response.data;
  } catch (error: unknown) {
    throw error;
  }
};
