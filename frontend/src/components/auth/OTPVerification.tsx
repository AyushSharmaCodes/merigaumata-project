import { useState, useRef, KeyboardEvent } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pencil, ArrowLeft, RefreshCw, Shield } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { toast } from "@/hooks/use-toast";
import { apiClient } from "@/lib/api-client";
import type { User } from "@/types";
import { getErrorMessage } from "@/lib/errorUtils";

interface OTPVerificationProps {
  emailOrPhone: string;
  password?: string;
  name?: string;
  isRegistration?: boolean;
  isForgotPassword?: boolean;
  onVerified: (isAdmin: boolean, userData?: User) => void;
  onBack: () => void;
}

export function OTPVerification({
  emailOrPhone,
  password,
  name,
  isRegistration = false,
  isForgotPassword = false,
  onVerified,
  onBack,
}: OTPVerificationProps) {

  const { t } = useTranslation();
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const login = useAuthStore((state) => state.login);

  const handleChange = (index: number, value: string) => {
    if (value && !/^\d$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newOtp = [...otp];
    pastedData.split("").forEach((char, index) => {
      if (index < 6) newOtp[index] = char;
    });
    setOtp(newOtp);

    const nextIndex = Math.min(pastedData.length, 5);
    inputRefs.current[nextIndex]?.focus();
  };


  const handleVerify = async () => {
    const otpString = otp.join("");
    if (otpString.length !== 6) {
      toast({
        title: t("auth.error"),
        description: t("auth.invalidOTP"),
        variant: "destructive",
      });
      return;
    }

    setIsVerifying(true);

    if (isForgotPassword) {
      setTimeout(() => {
        toast({
          title: t("auth.success"),
          description: t("auth.otpVerifiedSuccess", { defaultValue: "OTP verified successfully" }),
        });
        setIsVerifying(false);
        onVerified(false);
      }, 1500);
      return;
    }

    if (isRegistration) {
      setTimeout(() => {
        const mockUser = {
          id: Math.random().toString(36).substr(2, 9),
          name: name || "New User",
          email: emailOrPhone,
          role: "customer" as const,
          addresses: [],
        };

        login(mockUser);

        toast({
          title: t("auth.success"),
          description: t("auth.registrationVerifiedSuccess", { defaultValue: "Registration verified!" }),
        });
        setIsVerifying(false);
        onVerified(false, mockUser);
      }, 1500);
      return;
    }

    try {
      const response = await apiClient.post('/auth/verify-login-otp', {
        email: emailOrPhone,
        otp: otpString
      });

      const { user } = response.data;

      login(user);

      toast({
        title: t("auth.success"),
        description: t("auth.loginSuccess"),
      });

      onVerified(user.role === 'admin' || user.role === 'manager', user);

    } catch (error: unknown) {
      toast({
        title: t("auth.verificationFailed", { defaultValue: "Verification failed" }),
        description: getErrorMessage(error, t, "auth.invalidOTP"),
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getTitle = () => {
    if (isForgotPassword) return t("auth.resetPasswordTitle", { defaultValue: "Reset password" });
    if (isRegistration) return t("auth.verifyAccountTitle", { defaultValue: "Verify your account" });
    return t("auth.enterVerificationCodeTitle", { defaultValue: "Enter verification code" });
  };

  const getDescription = () => {
    if (isForgotPassword)
      return t("auth.resetPasswordOtpDescription", { defaultValue: "We sent a 6-digit code to reset your password" });
    if (isRegistration)
      return t("auth.verifyAccountOtpDescription", { defaultValue: "We sent a 6-digit code to verify your account" });
    return t("auth.loginOtpDescription", { defaultValue: "We sent a 6-digit code to your email or phone" });
  };

  const handleResendOTP = () => {
    toast({
      title: t("auth.success"),
      description: t("auth.otpResentTo", { defaultValue: "OTP has been resent to {{target}}", target: emailOrPhone }),
    });
    setOtp(["", "", "", "", "", ""]);
    inputRefs.current[0]?.focus();
  };

  const isComplete = otp.join("").length === 6;

  return (
    <div className="p-6 sm:p-8 bg-white">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#B85C3C] to-[#D4AF37] rounded-2xl flex items-center justify-center shadow-lg shadow-[#B85C3C]/20">
            <Shield className="w-8 h-8 text-white" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#2C1810] font-playfair mb-1">
          {getTitle()}
        </h2>
        <p className="text-sm text-[#2C1810]/60">
          {getDescription()}
        </p>

        {/* Email/Phone Display with Edit */}
        <div className="mt-3 inline-flex items-center gap-2 bg-[#FAF7F2] px-3 py-1.5 rounded-full">
          <span className="text-sm font-medium text-[#B85C3C]">{emailOrPhone}</span>
          <button
            onClick={onBack}
            className="text-[#2C1810]/40 hover:text-[#B85C3C] transition-colors"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* OTP Input - 6 Separate Boxes */}
      <div className="space-y-6">
        <div className="flex justify-center gap-2 sm:gap-3">
          {otp.map((digit, index) => (
            <Input
              key={index}
              ref={(el) => (inputRefs.current[index] = el)}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={index === 0 ? handlePaste : undefined}
              className={`w-11 h-14 sm:w-12 sm:h-14 text-center text-xl font-bold rounded-xl border-2 bg-[#FAF7F2] focus:bg-white transition-all ${digit
                  ? "border-[#B85C3C] text-[#2C1810]"
                  : "border-[#B85C3C]/10 text-[#2C1810]/60"
                } focus:border-[#B85C3C] focus:ring-2 focus:ring-[#B85C3C]/20`}
              autoFocus={index === 0}
            />
          ))}
        </div>

        {/* Progress Indicator */}
        <div className="flex justify-center gap-1">
          {otp.map((digit, index) => (
            <div
              key={index}
              className={`w-2 h-2 rounded-full transition-all ${digit ? 'bg-[#B85C3C]' : 'bg-[#B85C3C]/20'}`}
            />
          ))}
        </div>

        <Button
          onClick={handleVerify}
          className={`w-full h-12 rounded-xl text-base font-bold transition-all duration-300 shadow-lg ${isComplete
              ? "bg-[#B85C3C] hover:bg-[#2C1810] shadow-[#B85C3C]/20"
              : "bg-[#B85C3C]/50 cursor-not-allowed"
            }`}
          size="lg"
          disabled={isVerifying || !isComplete}
        >
          {isVerifying ? (
            <span className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin" />
              Verifying...
            </span>
          ) : (
            "Verify & Continue"
          )}
        </Button>

        {/* Resend Section */}
        <div className="text-center space-y-2">
          <p className="text-sm text-[#2C1810]/50">
            Didn't receive the code?
          </p>
          <button
            className="text-[#B85C3C] hover:text-[#2C1810] font-bold text-sm transition-colors"
            onClick={handleResendOTP}
            disabled={isVerifying}
          >
            Resend OTP
          </button>
        </div>

        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-full flex items-center justify-center gap-2 text-sm text-[#2C1810]/50 hover:text-[#B85C3C] transition-colors"
        >
          <ArrowLeft size={14} />
          Back to previous step
        </button>
      </div>
    </div>
  );
}
