import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTranslation } from "react-i18next";
import { useToast } from "@/shared/hooks/use-toast";
import { logger } from "@/core/observability/logger";
import { getErrorMessage, getErrorDetails } from "@/core/utils/errorUtils";
import { changePassword, sendChangePasswordOTP } from "@/domains/auth";

interface UseUpdatePasswordProps {
  onOpenChange: (open: boolean) => void;
}

export const useUpdatePassword = ({ onOpenChange }: UseUpdatePasswordProps) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const { toast } = useToast();

  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordSchema = z
    .object({
      currentPassword: z.string().min(1, t("profile.personalInfo.passwordUpdate.validation.currentRequired")),
      newPassword: z.string()
        .min(8, t("profile.personalInfo.passwordUpdate.validation.minLen"))
        .regex(/[a-z]/, t("profile.personalInfo.passwordUpdate.validation.lowercase"))
        .regex(/[A-Z]/, t("profile.personalInfo.passwordUpdate.validation.uppercase"))
        .regex(/[0-9]/, t("profile.personalInfo.passwordUpdate.validation.number"))
        .regex(/[^a-zA-Z0-9]/, t("profile.personalInfo.passwordUpdate.validation.special")),
      confirmPassword: z.string().min(1, t("profile.personalInfo.passwordUpdate.validation.confirmRequired")),
      otp: z.string().optional(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("profile.personalInfo.passwordUpdate.validation.mismatch"),
      path: ["confirmPassword"],
    })
    .refine((data) => data.newPassword !== data.currentPassword, {
      message: t("profile.personalInfo.passwordUpdate.validation.sameAsCurrent"),
      path: ["newPassword"],
    });

  type PasswordFormValues = z.infer<typeof passwordSchema>;

  const form = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      otp: "",
    },
  });

  const handleSendOTP = async () => {
    const isValid = await form.trigger(["currentPassword", "newPassword", "confirmPassword"]);
    if (!isValid) return;

    setLoading(true);
    try {
      await sendChangePasswordOTP();
      setOtpSent(true);
      toast({
        title: t("common.success"),
        description: t("profile.personalInfo.passwordUpdate.otpSentSuccess"),
      });
    } catch (error: unknown) {
      logger.error("Failed to send OTP:", error);
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, "profile.personalInfo.passwordUpdate.otpSentError"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: PasswordFormValues) => {
    if (!otpSent) {
      await handleSendOTP();
      return;
    }

    if (!data.otp || data.otp.length !== 6) {
      form.setError("otp", { message: t("profile.personalInfo.passwordUpdate.enterOtp") });
      return;
    }

    setLoading(true);
    try {
      await changePassword({
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
        otp: data.otp,
      });
      toast({
        title: t("common.success"),
        description: t("profile.personalInfo.passwordUpdate.success"),
      });
      form.reset();
      setOtpSent(false);
      onOpenChange(false);
    } catch (error: unknown) {
      logger.error("Password update error:", error);
      const details = getErrorDetails(error);
      if (details) {
        details.forEach((d) => {
          const field = d.path?.[0];
          if (field && (field === 'currentPassword' || field === 'newPassword' || field === 'confirmPassword' || field === 'otp')) {
            form.setError(field as keyof PasswordFormValues, { message: d.message });
          }
        });
      } else {
        toast({
          title: t("common.error"),
          description: getErrorMessage(error, t, "profile.personalInfo.passwordUpdate.errors.failedUpdate"),
          variant: "destructive",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setOtpSent(false);
      form.reset();
    }
    onOpenChange(newOpen);
  };

  return {
    form,
    loading,
    otpSent,
    setOtpSent,
    showCurrentPassword,
    setShowCurrentPassword,
    showNewPassword,
    setShowNewPassword,
    showConfirmPassword,
    setShowConfirmPassword,
    handleSendOTP,
    onSubmit,
    handleOpenChange,
    t,
  };
};
