import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { FormError } from "@/shared/components/ui/form-error";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";

interface OtpVerificationProps {
  formData: {
    email: string;
    otp: string;
  };
  fieldErrors: Record<string, string>;
  isLoading: boolean;
  resendCooldown: number;
  onFormDataChange: (updates: Partial<OtpVerificationProps["formData"]>) => void;
  onResendOtp: () => void;
  onChangeEmail: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function OtpVerification({
  formData,
  fieldErrors,
  isLoading,
  resendCooldown,
  onFormDataChange,
  onResendOtp,
  onChangeEmail,
  onSubmit,
}: OtpVerificationProps) {
  const { t } = useTranslation();

  return (
    <div className="p-6 sm:p-8 bg-white">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#B85C3C] to-[#D4AF37] rounded-2xl flex items-center justify-center shadow-lg shadow-[#B85C3C]/20">
            <span className="text-3xl">🛡️</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#2C1810] font-playfair mb-1">
          {t(AuthMessages.OTP_VERIFICATION)}
        </h2>
        <p className="text-sm text-[#2C1810]/60">
          {t(AuthMessages.ENTER_OTP_SENT)}
        </p>
      </div>

      <div className="space-y-6">
        <div className="p-4 rounded-xl bg-[#FAF7F2] border border-[#B85C3C]/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] text-[#2C1810]/40 uppercase tracking-wider font-bold">{t(AuthMessages.OTP_SENT_TO)}</p>
            <p className="text-sm font-bold text-[#2C1810]">{formData.email}</p>
          </div>
          <button
            type="button"
            onClick={onChangeEmail}
            className="text-xs font-bold text-[#B85C3C] hover:text-[#2C1810] transition-colors"
          >
            {t("common.change")}
          </button>
        </div>

        <form onSubmit={onSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="otp" className="text-xs font-bold uppercase tracking-wider text-[#2C1810] text-center block">
              {t(AuthMessages.OTP)}
            </Label>
            <Input
              id="otp"
              type="text"
              value={formData.otp}
              onChange={(e) => onFormDataChange({ otp: e.target.value })}
              placeholder="••••••"
              className="h-14 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white text-center text-3xl tracking-[0.5em] font-bold border-[#B85C3C]/10 focus:border-[#B85C3C] transition-all"
              maxLength={6}
              required
            />
            <FormError error={fieldErrors.otp ? t(fieldErrors.otp) : undefined} />
          </div>

          <div className="text-center">
            <button
              type="button"
              onClick={onResendOtp}
              disabled={isLoading || resendCooldown > 0}
              className="text-sm font-bold text-[#B85C3C] hover:text-[#2C1810] disabled:opacity-50 transition-colors"
            >
              {resendCooldown > 0
                ? `${t(AuthMessages.RESEND_AVAILABLE_IN)} ${resendCooldown}${t(AuthMessages.SECONDS_SHORT)}`
                : t(AuthMessages.RESEND_OTP)}
            </button>
          </div>

          <Button
            type="submit"
            className="w-full h-12 rounded-xl text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/20"
            size="lg"
            disabled={isLoading}
          >
            {isLoading ? t("common.loading") : t(AuthMessages.VERIFY_AND_LOGIN)}
          </Button>
        </form>
      </div>
    </div>
  );
}
