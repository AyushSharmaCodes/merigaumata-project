import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { FormError } from "@/shared/components/ui/form-error";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";

interface ForgotPasswordFormProps {
  formData: {
    email: string;
  };
  isLoading: boolean;
  onFormDataChange: (updates: Partial<ForgotPasswordFormProps["formData"]>) => void;
  onBackToLogin: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function ForgotPasswordForm({
  formData,
  isLoading,
  onFormDataChange,
  onBackToLogin,
  onSubmit,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();

  return (
    <div className="p-6 sm:p-8 bg-white">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#B85C3C] to-[#D4AF37] rounded-2xl flex items-center justify-center shadow-lg shadow-[#B85C3C]/20">
            <span className="text-3xl">🔑</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#2C1810] font-playfair mb-1">
          {t(AuthMessages.FORGOT_PASSWORD)}
        </h2>
        <p className="text-sm text-[#2C1810]/60">
          {t(AuthMessages.FORGOT_PASSWORD_SUBTITLE)}
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t(AuthMessages.EMAIL_PHONE)} <span className="text-[#B85C3C]">*</span>
          </Label>
          <Input
            id="email"
            type="text"
            value={formData.email}
            onChange={(e) => onFormDataChange({ email: e.target.value })}
            placeholder={t(AuthMessages.EMAIL_PHONE_PLACEHOLDER)}
            required
            className="h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white border-[#B85C3C]/10 focus:border-[#B85C3C] transition-colors"
          />
        </div>

        <Button 
          type="submit" 
          className="w-full h-12 rounded-xl text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/20" 
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? t(AuthMessages.SENDING) : t(AuthMessages.RESET_PASSWORD_LINK)}
        </Button>

        <button
          type="button"
          className="w-full text-sm font-bold text-[#B85C3C] hover:text-[#2C1810] transition-colors"
          onClick={onBackToLogin}
        >
          {t(AuthMessages.BACK_TO_LOGIN)}
        </button>
      </form>
    </div>
  );
}
