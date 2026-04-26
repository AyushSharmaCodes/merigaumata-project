import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/shared/hooks/use-toast";
import { useAuthStore } from "@/domains/auth";
import { getErrorMessage, getErrorDetails, getApiError } from "@/core/utils/errorUtils";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";
import { logger } from "@/core/observability/logger";
import {
  useRegisterMutation,
  useValidateCredentialsMutation,
  useVerifyLoginOtpMutation,
  useRequestPasswordResetMutation,
  useResendConfirmationMutation,
} from "@/domains/auth";
import { loginWithGoogle } from "@/domains/auth";

export type AuthStep = "login" | "register" | "forgot-password" | "success";

interface UseAuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStep?: "login" | "register";
}

export function useAuthModal({ open, onOpenChange, defaultStep = "login" }: UseAuthModalProps) {
  const { t } = useTranslation();
  const initialStep = defaultStep.includes("register") ? "register" : "login";

  const [step, setStep] = useState<AuthStep>(initialStep);
  const [formData, setFormData] = useState({ email: "", password: "", name: "", phone: "", otp: "" });
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [showOtp, setShowOtp] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [showResendConfirmationPrompt, setShowResendConfirmationPrompt] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const { toast } = useToast();

  const validateCredentialsMutation = useValidateCredentialsMutation();
  const verifyLoginOtpMutation = useVerifyLoginOtpMutation();
  const registerMutation = useRegisterMutation();
  const requestPasswordResetMutation = useRequestPasswordResetMutation();
  const resendConfirmationMutation = useResendConfirmationMutation();

  const isLoading = 
    validateCredentialsMutation.isPending || 
    verifyLoginOtpMutation.isPending || 
    registerMutation.isPending || 
    requestPasswordResetMutation.isPending || 
    resendConfirmationMutation.isPending;

  const getApiErrorCode = (error: unknown) => getApiError(error)?.code;
  const getApiErrorKey = (error: unknown) => getApiError(error)?.error;

  useEffect(() => {
    if (open) {
      setStep(initialStep);
      setFormData({ email: "", password: "", name: "", phone: "", otp: "" });
      setFieldErrors({});
      setShowOtp(false);
      setShowResendConfirmationPrompt(false);
    }
  }, [open, initialStep]);

  useEffect(() => {
    if (fieldErrors.general) {
      const timer = setTimeout(() => {
        setFieldErrors((prev) => {
          const { general, ...rest } = prev;
          return rest;
        });
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [fieldErrors.general]);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (showOtp) {
        if (!formData.otp || formData.otp.length < 6) {
          toast({ title: t("common.error"), description: t(AuthMessages.INVALID_OTP_TOAST), variant: "destructive" });
          return;
        }

        const user = await verifyLoginOtpMutation.mutateAsync({ email: formData.email, otp: formData.otp });
        login(user);
        toast({ title: t("common.success"), description: t(AuthMessages.LOGIN_SUCCESS_TOAST) });
        
        if (user.mustChangePassword) {
          toast({
            title: t("common.info"),
            description: t("auth.forceChangePassword.description", { defaultValue: "For security, please change your temporary password before continuing." }),
          });
        }
        
        onOpenChange(false);
        setShowOtp(false);

        const returnUrl = sessionStorage.getItem("authReturnUrl");
        if (returnUrl) {
          sessionStorage.removeItem("authReturnUrl");
          navigate(returnUrl);
        } else if (user.role === "admin") {
          navigate("/admin");
        } else if (user.role === "manager") {
          navigate("/manager");
        } else {
          navigate("/");
        }
      } else {
        const res = await validateCredentialsMutation.mutateAsync({ email: formData.email, password: formData.password });
        if (res.success) {
          toast({ title: t("common.success"), description: t(AuthMessages.OTP_SENT_TOAST) });
          setShowOtp(true);
          setFieldErrors({});
          setShowResendConfirmationPrompt(false);
        } else {
          throw new Error(res.error || t(AuthMessages.VALIDATION_FAILED));
        }
      }
    } catch (error: unknown) {
      logger.error("Login error:", error);
      const details = getErrorDetails(error);

      if (details) {
        const errors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          errors[field] = d.message;
        });
        setFieldErrors(errors);
      } else {
        const generalMessage = getErrorMessage(error, t, AuthMessages.LOGIN_FAILED);
        const errorCode = getApiErrorCode(error);
        const errorKey = getApiErrorKey(error);
        const requiresResendConfirmation = errorCode === "EMAIL_NOT_CONFIRMED" || errorKey === "errors.auth.emailNotConfirmed";

        if (showOtp || errorCode === "INVALID_OTP" || errorCode === "OTP_EXPIRED" || errorKey === "errors.auth.invalidOtp" || errorKey === "errors.auth.otpExpired") {
          setFieldErrors({ otp: generalMessage });
          toast({ title: t("common.error"), description: generalMessage, variant: "destructive" });
        } else if (errorCode === "INVALID_PASSWORD" || errorKey === "errors.auth.invalidPassword") {
          setFieldErrors({ password: generalMessage });
          toast({ title: t("common.error"), description: generalMessage, variant: "destructive" });
        } else {
          setFieldErrors({ general: generalMessage });
          toast({ title: t("common.error"), description: generalMessage, variant: "destructive" });
        }
        setShowResendConfirmationPrompt(requiresResendConfirmation);
      }
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFieldErrors({});

    if (!formData.phone || formData.phone.length < 10) {
      setFieldErrors(prev => ({ ...prev, phone: t(AuthMessages.PHONE_REQUIRED_TOAST) }));
      return;
    }

    const passwordErrors: string[] = [];
    if (formData.password.length < 8) passwordErrors.push(t(AuthMessages.PASSWORD_LENGTH));
    if (!/[A-Z]/.test(formData.password)) passwordErrors.push(t(AuthMessages.PASSWORD_UPPERCASE));
    if (!/[a-z]/.test(formData.password)) passwordErrors.push(t(AuthMessages.PASSWORD_LOWERCASE));
    if (!/[0-9]/.test(formData.password)) passwordErrors.push(t(AuthMessages.PASSWORD_NUMBER));
    if (!/[^a-zA-Z0-9]/.test(formData.password)) passwordErrors.push(t(AuthMessages.PASSWORD_SPECIAL));

    if (passwordErrors.length > 0) {
      setFieldErrors(prev => ({ ...prev, password: passwordErrors.join("\n") }));
      return;
    }

    try {
      await registerMutation.mutateAsync({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
      });

      setStep("success");
      toast({ title: t("common.success"), description: t(AuthMessages.ACCOUNT_CREATED_TOAST) });

    } catch (error: unknown) {
      logger.error("Registration error:", error);
      const details = getErrorDetails(error);

      if (details) {
        const errors: Record<string, string> = {};
        details.forEach((d) => {
          const field = d.path?.[d.path.length - 1] || 'general';
          errors[field] = d.message;
        });
        setFieldErrors(errors);
      } else {
        const errorMsg = getErrorMessage(error, t, AuthMessages.REGISTRATION_FAILED);
        const apiError = getApiError(error);

        if (apiError?.code === 'ACCOUNT_ALREADY_EXISTS' || apiError?.error === 'errors.auth.accountAlreadyExists') {
          setFormData((prev) => ({ ...prev, otp: "" }));
          toast({ title: t("common.error"), description: t(AuthMessages.ACCOUNT_EXISTS_TOAST), variant: "destructive" });
          setStep("login");
          setShowOtp(false);
          setShowResendConfirmationPrompt(false);
        } else if (apiError?.code === 'EMAIL_NOT_CONFIRMED' || apiError?.error === 'errors.auth.emailNotConfirmed') {
          setFormData((prev) => ({ ...prev, otp: "" }));
          toast({ title: t("common.error"), description: t('errors.auth.emailNotConfirmed'), variant: "destructive" });
          setStep("login");
          setShowOtp(false);
          setShowResendConfirmationPrompt(true);
        } else {
          setFieldErrors({ general: errorMsg });
        }
      }
    }
  };

  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      await requestPasswordResetMutation.mutateAsync(formData.email);
      toast({ title: t("common.success"), description: t(AuthMessages.RESET_EMAIL_SENT_TOAST) });
      setStep("login");
    } catch (error: unknown) {
      const errorCode = getApiErrorCode(error);
      const message = getErrorMessage(error, t, AuthMessages.RESET_FAILED);
      if (errorCode === "EMAIL_NOT_CONFIRMED") {
        toast({ title: t("common.error"), description: message, variant: "destructive" });
        setStep("login");
        setShowResendConfirmationPrompt(true);
        setFieldErrors({});
      } else {
        setFieldErrors({ general: message });
      }
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch (error: unknown) {
      toast({ title: t("common.error"), description: getErrorMessage(error, t, AuthMessages.GOOGLE_LOGIN_FAILED), variant: "destructive" });
    }
  };

  const handleResendOtp = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await validateCredentialsMutation.mutateAsync({ email: formData.email, password: formData.password });
      if (res.success) {
        toast({ title: t("common.success"), description: t(AuthMessages.OTP_SENT_TOAST) });
        setResendCooldown(30);
      }
    } catch (error: unknown) {
      toast({ title: t("common.error"), description: getErrorMessage(error, t, AuthMessages.OTP_FAILED), variant: "destructive" });
    }
  };

  const handleResendConfirmation = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendConfirmationMutation.mutateAsync(formData.email);
      toast({ title: t("common.success"), description: t(AuthMessages.OTP_SENT_TOAST) });
      setResendCooldown(30);
    } catch (error: unknown) {
      const msg = getErrorMessage(error, t, AuthMessages.CONFIRMATION_FAILED);
      toast({ title: t("common.error"), description: msg, variant: "destructive" });

      const apiError = getApiError(error);
      if (apiError?.error === 'errors.auth.email_already_verified' || apiError?.code === 'EMAIL_ALREADY_VERIFIED' || msg.toLowerCase().includes("already verified")) {
        setStep("login");
      }
    }
  };

  const getTitle = () => {
    switch (step) {
      case "register": return t(AuthMessages.CREATE_ACCOUNT_TITLE);
      case "forgot-password": return t(AuthMessages.RESET_PASSWORD_TITLE);
      case "success": return t(AuthMessages.REG_SUCCESS_TITLE);
      default: return t(AuthMessages.WELCOME_BACK);
    }
  };

  const getDescription = () => {
    switch (step) {
      case "register": return t(AuthMessages.SIGN_UP_SUBTITLE);
      case "forgot-password": return t(AuthMessages.RESET_SUBTITLE);
      case "success": return t(AuthMessages.REG_SUCCESS_SUBTITLE);
      default: return t(AuthMessages.JOURNEY_SUBTITLE);
    }
  };

  return {
    t,
    step,
    setStep,
    formData,
    setFormData,
    isLoading,
    showLoginPassword,
    setShowLoginPassword,
    showRegisterPassword,
    setShowRegisterPassword,
    showOtp,
    setShowOtp,
    fieldErrors,
    setFieldErrors,
    showResendConfirmationPrompt,
    resendCooldown,
    handleLoginSubmit,
    handleRegisterSubmit,
    handleForgotPasswordSubmit,
    handleGoogleLogin,
    handleResendOtp,
    handleResendConfirmation,
    getTitle,
    getDescription
  };
}
