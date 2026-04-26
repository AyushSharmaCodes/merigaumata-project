import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { FormError } from "@/shared/components/ui/form-error";
import { Eye, EyeOff, AlertCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";
import { CommonMessages } from "@/shared/constants/messages/CommonMessages";
import {
  FaWhatsapp,
  FaInstagram,
  FaFacebookF,
  FaYoutube,
} from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";

interface LoginFormProps {
  formData: {
    email: string;
    password: string;
  };
  fieldErrors: Record<string, string>;
  isLoading: boolean;
  showPassword?: boolean;
  showResendConfirmation?: boolean;
  resendCooldown?: number;
  onFormDataChange: (updates: Partial<LoginFormProps["formData"]>) => void;
  onTogglePassword: () => void;
  onForgotPassword: () => void;
  onResendConfirmation: () => void;
  onRegister: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn?: () => void;
}

const socialMediaLinks = [
  { id: 1, platform: "whatsapp", url: "https://wa.me/918448440605" },
  { id: 2, platform: "instagram", url: "https://www.instagram.com/merigaumata/" },
  { id: 3, platform: "facebook", url: "https://www.facebook.com/merigaumata/" },
  { id: 4, platform: "twitter", url: "https://x.com/merigaumata/" },
  { id: 5, platform: "youtube", url: "https://www.youtube.com/@merigaumata" },
];

const getSocialIcon = (platform: string) => {
  switch (platform) {
    case "whatsapp": return FaWhatsapp;
    case "instagram": return FaInstagram;
    case "facebook": return FaFacebookF;
    case "twitter": return FaXTwitter;
    case "youtube": return FaYoutube;
    default: return () => null;
  }
};

export function LoginForm({
  formData,
  fieldErrors,
  isLoading,
  showPassword,
  showResendConfirmation,
  resendCooldown = 0,
  onFormDataChange,
  onTogglePassword,
  onForgotPassword,
  onResendConfirmation,
  onRegister,
  onSubmit,
  onGoogleSignIn,
}: LoginFormProps) {
  const { t } = useTranslation();

  return (
    <div className="p-6 sm:p-8 bg-white">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-gradient-to-br from-[#B85C3C] to-[#D4AF37] rounded-2xl flex items-center justify-center shadow-lg shadow-[#B85C3C]/20">
            <span className="text-3xl">🌿</span>
          </div>
        </div>
        <h2 className="text-2xl font-bold text-[#2C1810] font-playfair mb-1">
          {t(AuthMessages.WELCOME_BACK)}
        </h2>
        <p className="text-sm text-[#2C1810]/60">{t(AuthMessages.LOGIN_SUBTITLE)}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5">
        {/* Email Field */}
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
            className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white transition-colors ${fieldErrors.email ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
          />
          <FormError error={fieldErrors.email ? t(fieldErrors.email) : undefined} />
        </div>

        {/* Password Field */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
              {t(AuthMessages.PASSWORD)} <span className="text-[#B85C3C]">*</span>
            </Label>
            <button
              type="button"
              onClick={onForgotPassword}
              className="text-[10px] font-bold text-[#B85C3C] hover:text-[#2C1810] uppercase tracking-wider transition-colors"
            >
              {t(AuthMessages.FORGOT_PASSWORD)}
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => onFormDataChange({ password: e.target.value })}
              placeholder={t(AuthMessages.PASSWORD_PLACEHOLDER)}
              required
              className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white pr-12 transition-colors ${fieldErrors.password ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#B85C3C] transition-colors"
              onClick={onTogglePassword}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <FormError error={fieldErrors.password ? t(fieldErrors.password) : undefined} />
        </div>

        {/* Resend Confirmation Prompt */}
        {showResendConfirmation && (
          <div className="p-4 rounded-xl bg-amber-50 border border-amber-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-xs text-amber-800 leading-relaxed font-medium">
                {t(AuthMessages.EMAIL_NOT_VERIFIED)}
              </p>
              <button
                type="button"
                onClick={onResendConfirmation}
                disabled={isLoading || resendCooldown > 0}
                className="text-xs font-bold text-[#B85C3C] hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {resendCooldown > 0 
                  ? `${t(AuthMessages.RESEND_AVAILABLE_IN)} ${resendCooldown}${t(AuthMessages.SECONDS_SHORT)}`
                  : t(AuthMessages.RESEND_VERIFICATION)}
              </button>
            </div>
          </div>
        )}

        {/* Terms */}
        <p className="text-[10px] text-[#2C1810]/50 text-center leading-relaxed">
          {t(AuthMessages.TERMS_AGREE)}{" "}
          <button
            type="button"
            className="text-[#B85C3C] hover:underline font-medium"
            onClick={() => window.open("/terms-and-conditions", "_blank")}
          >
            {t(AuthMessages.TERMS_OF_USE)}
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="text-[#B85C3C] hover:underline font-medium"
            onClick={() => window.open("/privacy-policy", "_blank")}
          >
            {t(AuthMessages.PRIVACY_POLICY)}
          </button>
          .
        </p>

        <Button
          type="submit"
          className="w-full h-12 rounded-xl text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/20"
          size="lg"
          disabled={isLoading}
        >
          {isLoading ? t(AuthMessages.SIGNING_IN) : t(AuthMessages.SIGN_IN)}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#B85C3C]/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
          <span className="bg-white px-3 text-[#2C1810]/40 font-medium">{t(AuthMessages.OR_CONTINUE_WITH)}</span>
        </div>
      </div>

      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 rounded-xl gap-3 border-2 border-[#B85C3C]/10 text-[#2C1810] hover:bg-[#FAF7F2] hover:border-[#B85C3C]/20 transition-all"
        size="lg"
        onClick={onGoogleSignIn}
        disabled={isLoading}
      >
        <FcGoogle className="h-5 w-5" />
        <span className="font-medium">{t(AuthMessages.GOOGLE_CONTINUE)}</span>
      </Button>

      {/* Switch to Register */}
      <p className="text-center mt-6 text-sm text-[#2C1810]/60">
        {t(AuthMessages.DONT_HAVE_ACCOUNT)}{" "}
        <button
          type="button"
          className="text-[#B85C3C] hover:text-[#2C1810] font-bold transition-colors"
          onClick={onRegister}
        >
          {t(AuthMessages.REGISTER_HERE)}
        </button>
      </p>

      {/* Social Media Links */}
      {socialMediaLinks.length > 0 && (
        <div className="mt-8 pt-6 border-t border-[#B85C3C]/10">
          <p className="text-center text-[10px] text-[#2C1810]/40 uppercase tracking-wider font-medium mb-3">
            {t(CommonMessages.FOLLOW_US)}
          </p>
          <div className="flex justify-center gap-2">
            {socialMediaLinks.map((link) => {
              const Icon = getSocialIcon(link.platform);
              return (
                <a
                  key={link.id}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-[#FAF7F2] flex items-center justify-center text-[#2C1810]/50 hover:bg-[#B85C3C] hover:text-white transition-all"
                  aria-label={link.platform}
                >
                  <Icon size={16} />
                </a>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
