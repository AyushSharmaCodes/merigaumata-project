import { logger } from "@/lib/logger";

import { apiClient } from "@/lib/api-client";
import type { User, ApiErrorResponse } from "@/types";
import axios from "axios";
import { UserDTO } from "@/lib/dto/user.dto";
import { clearAuthSession, setAuthSession, getAuthSession } from "@/lib/auth-session";

export interface RegisterData {
  email: string;
  phone?: string;
  password: string;
  name: string;
}

export interface ErrorWithDetails extends Error {
  details?: ApiErrorResponse['details'];
  code?: string;
  status?: number;
  apiError?: ApiErrorResponse;
}

function createServiceError(data: ApiErrorResponse, status?: number): ErrorWithDetails {
  const message = data.error || "errors.system.genericError";
  const error = new Error(message) as ErrorWithDetails;
  error.details = data.details;
  error.code = data.code;
  error.status = status;
  error.apiError = data;
  return error;
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
      throw createServiceError(data, error.response.status);
    }
    throw error;
  }
};



export const loginWithGoogle = async (): Promise<void> => {
  const response = await apiClient.get('/auth/google/authorize');
  const redirectUrl = response.data?.url;

  if (!redirectUrl) {
    throw new Error('errors.auth.googleRedirectFailed');
  }

  window.location.assign(redirectUrl);
};

export const logoutUser = async (): Promise<void> => {
  clearAuthSession();
  try {
    // Note: The backend reads the refresh_token from the HttpOnly cookie automatically.
    await apiClient.post('/auth/logout', {});
  } catch (err) {
    logger.warn("Backend logout error:", err);
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  try {
    const response = await apiClient.post('/auth/refresh', {}, { silent: true } as any);
    if (response.data?.tokens) {
      setAuthSession(response.data.tokens);
    }
    return response.data?.user ? UserDTO.fromBackend(response.data.user) : null;
  } catch {
    clearAuthSession();
    return null;
  }
};

export const refreshToken = async () => {
  const response = await apiClient.post('/auth/refresh');
  if (response.data?.tokens) {
    setAuthSession(response.data.tokens);
  }
  return response.data;
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
 * Legacy reset password helper
 * @deprecated Use requestPasswordReset instead
 */
export const resetPassword = async (email: string): Promise<void> => {
  await requestPasswordReset(email);
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
  await apiClient.post("/auth/change-password", { newPassword });
};

export const exchangeGoogleCode = async (code: string, state: string): Promise<{ user: User; tokens?: { access_token: string } }> => {
  const response = await apiClient.post('/auth/google/exchange', { code, state });
  if (response.data?.tokens) {
    setAuthSession(response.data.tokens);
  }

  return {
    user: UserDTO.fromBackend(response.data.user),
    tokens: response.data.tokens
  };
};



export const validateCredentials = async (email: string, password: string) => {
  try {
    const response = await apiClient.post('/auth/validate-credentials', { email, password });
    return response.data;
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.response?.data) {
      const data = error.response.data as ApiErrorResponse;
      throw createServiceError(data, error.response.status);
    }
    throw error;
  }
};

export const verifyLoginOtp = async (email: string, otp: string): Promise<User> => {
  const response = await apiClient.post("/auth/verify-login-otp", { email, otp });

  const { user, tokens } = response.data;

  if (tokens?.access_token) {
    setAuthSession(tokens);
  }

  return UserDTO.fromBackend(user);
};

export const resendConfirmationEmail = async (email: string): Promise<void> => {
  const response = await apiClient.post('/auth/resend-confirmation', { email });
  return response.data;
};
