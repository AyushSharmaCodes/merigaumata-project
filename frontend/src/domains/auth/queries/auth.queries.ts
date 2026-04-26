import { useMutation } from "@tanstack/react-query";
import {
  changePassword,
  registerUser,
  requestPasswordReset,
  resendConfirmationEmail,
  resetPasswordWithToken,
  updateUserPassword,
  validateCredentials,
  validateResetToken,
  verifyLoginOtp,
} from "../api/auth-commands.api";
import type { RegisterData } from "../api/auth-commands.api";

export const useRegisterMutation = () =>
  useMutation({
    mutationFn: (data: RegisterData) => registerUser(data),
  });

export const useValidateCredentialsMutation = () =>
  useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      validateCredentials(data.email, data.password),
  });

export const useVerifyLoginOtpMutation = () =>
  useMutation({
    mutationFn: (data: { email: string; otp: string }) => verifyLoginOtp(data.email, data.otp),
  });

export const useRequestPasswordResetMutation = () =>
  useMutation({
    mutationFn: (email: string) => requestPasswordReset(email),
  });

export const useResendConfirmationMutation = () =>
  useMutation({
    mutationFn: (email: string) => resendConfirmationEmail(email),
  });

export const useChangePasswordMutation = () =>
  useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string; otp?: string }) =>
      changePassword(data),
  });

export const useUpdateUserPasswordMutation = () =>
  useMutation({
    mutationFn: (newPassword: string) => updateUserPassword(newPassword),
  });

export const useResetPasswordWithTokenMutation = () =>
  useMutation({
    mutationFn: (data: { token: string; newPassword: string }) =>
      resetPasswordWithToken(data.token, data.newPassword),
  });

export const useValidateResetTokenMutation = () =>
  useMutation({
    mutationFn: (token: string) => validateResetToken(token),
  });
