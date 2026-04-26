import { useAuthModal } from "../hooks/useAuthModal";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";

import { SocialAuth } from "./SocialAuth";
import { LoginForm } from "./LoginForm";
import { RegisterForm } from "./RegisterForm";
import { ForgotPasswordForm } from "./ForgotPasswordForm";
import { OtpVerification } from "./OtpVerification";
import { AuthSuccess } from "./AuthSuccess";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultStep?: "login" | "register";
}

export function AuthModal({

  open,
  onOpenChange,
  defaultStep = "login",
}: AuthModalProps) {
  const controller = useAuthModal({ open, onOpenChange, defaultStep });
  const {
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
  } = controller;

  const handleFormDataChange = (newData: any) => {
    setFormData((prev: any) => ({ ...prev, ...newData }));
    // Clear errors when typing
    if (fieldErrors.general) setFieldErrors((prev: any) => ({ ...prev, general: "" }));
    Object.keys(newData).forEach(key => {
      if ((fieldErrors as any)[key]) {
        setFieldErrors((prev: any) => ({ ...prev, [key]: "" }));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onInteractOutside={(event) => {
          if (step === "login" || step === "register" || showOtp) {
            event.preventDefault();
          }
        }}
        onEscapeKeyDown={(event) => {
          if (step === "login" || step === "register" || showOtp) {
            event.preventDefault();
          }
        }}
      >
        <DialogTitle className="text-2xl font-bold text-center">
          {getTitle()}
        </DialogTitle>
        <DialogDescription className="text-center">
          {getDescription()}
        </DialogDescription>

        <div className="mt-6">
          {step !== "forgot-password" && step !== "success" && !showOtp && (
            <SocialAuth onGoogleLogin={handleGoogleLogin} isLoading={isLoading} />
          )}

          {fieldErrors.general && (
            <div className="mb-4 p-3 rounded-md bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium animate-in fade-in slide-in-from-top-1">
              {fieldErrors.general}
            </div>
          )}

          {step === "login" && !showOtp && (
            <LoginForm
              formData={formData}
              fieldErrors={fieldErrors}
              isLoading={isLoading}
              showPassword={showLoginPassword}
              showResendConfirmation={showResendConfirmationPrompt}
              resendCooldown={resendCooldown}
              onFormDataChange={handleFormDataChange}
              onTogglePassword={() => setShowLoginPassword(!showLoginPassword)}
              onForgotPassword={() => setStep("forgot-password")}
              onResendConfirmation={handleResendConfirmation}
              onRegister={() => setStep("register")}
              onSubmit={handleLoginSubmit}
            />
          )}

          {step === "login" && showOtp && (
            <OtpVerification
              formData={formData}
              fieldErrors={fieldErrors}
              isLoading={isLoading}
              resendCooldown={resendCooldown}
              onFormDataChange={handleFormDataChange}
              onResendOtp={handleResendOtp}
              onChangeEmail={() => setShowOtp(false)}
              onSubmit={handleLoginSubmit}
            />
          )}

          {step === "register" && (
            <RegisterForm
              formData={formData}
              fieldErrors={fieldErrors}
              isLoading={isLoading}
              showPassword={showRegisterPassword}
              onFormDataChange={handleFormDataChange}
              onTogglePassword={() => setShowRegisterPassword(!showRegisterPassword)}
              onLogin={() => setStep("login")}
              onSubmit={handleRegisterSubmit}
            />
          )}

          {step === "forgot-password" && (
            <ForgotPasswordForm
              formData={formData}
              isLoading={isLoading}
              onFormDataChange={handleFormDataChange}
              onBackToLogin={() => setStep("login")}
              onSubmit={handleForgotPasswordSubmit}
            />
          )}

          {step === "success" && (
            <AuthSuccess
              isLoading={isLoading}
              resendCooldown={resendCooldown}
              onBackToLogin={() => setStep("login")}
              onResendConfirmation={handleResendConfirmation}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
