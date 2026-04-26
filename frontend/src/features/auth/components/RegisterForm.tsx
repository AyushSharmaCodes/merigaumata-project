import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { PhoneInput } from "@/shared/components/ui/phone-input";
import { Label } from "@/shared/components/ui/label";
import { FormError } from "@/shared/components/ui/form-error";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";

interface RegisterFormProps {
  formData: {
    name: string;
    email: string;
    phone: string;
    password: string;
  };
  fieldErrors: Record<string, string>;
  isLoading: boolean;
  showPassword?: boolean;
  onFormDataChange: (updates: Partial<RegisterFormProps["formData"]>) => void;
  onTogglePassword: () => void;
  onLogin: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onGoogleSignIn?: () => void;
}

export function RegisterForm({
  formData,
  fieldErrors,
  isLoading,
  showPassword,
  onFormDataChange,
  onTogglePassword,
  onLogin,
  onSubmit,
  onGoogleSignIn,
}: RegisterFormProps) {
  const { t } = useTranslation();

  // Password strength indicator (Visual only)
  const getPasswordStrength = () => {
    const password = formData.password;
    if (password.length === 0) return null;
    if (password.length < 6) return { level: 1, text: t("auth.passwordStrength.weak"), color: "bg-red-500" };
    if (password.length < 8) return { level: 2, text: t("auth.passwordStrength.fair"), color: "bg-orange-500" };
    if (password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password)) {
      return { level: 3, text: t("auth.passwordStrength.strong"), color: "bg-green-500" };
    }
    return { level: 2, text: t("auth.passwordStrength.good"), color: "bg-yellow-500" };
  };

  const passwordStrength = getPasswordStrength();

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
          {t(AuthMessages.CREATE_ACCOUNT)}
        </h2>
        <p className="text-sm text-[#2C1810]/60">{t(AuthMessages.JOIN_COMMUNITY)}</p>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("profile.name")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => onFormDataChange({ name: e.target.value })}
            placeholder={t(AuthMessages.NAME_PLACEHOLDER)}
            required
            className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white transition-colors ${fieldErrors.name ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
          />
          <FormError error={fieldErrors.name ? t(fieldErrors.name) : undefined} />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("profile.email")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) => onFormDataChange({ email: e.target.value })}
            placeholder={t(AuthMessages.EMAIL_PLACEHOLDER)}
            required
            className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white transition-colors ${fieldErrors.email ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
          />
          <FormError error={fieldErrors.email ? t(fieldErrors.email) : undefined} />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("profile.phone")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <PhoneInput
            id="phone"
            value={formData.phone}
            onChange={(value) => onFormDataChange({ phone: value as string })}
            placeholder={t(AuthMessages.PHONE_PLACEHOLDER)}
          />
          <FormError error={fieldErrors.phone ? t(fieldErrors.phone) : undefined} />
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t(AuthMessages.PASSWORD)} <span className="text-[#B85C3C]">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={formData.password}
              onChange={(e) => onFormDataChange({ password: e.target.value })}
              placeholder={t(AuthMessages.CREATE_PASSWORD_PLACEHOLDER)}
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

          {/* Password Strength Indicator */}
          {passwordStrength && (
            <div className="flex items-center gap-2 mt-2">
              <div className="flex-1 h-1.5 bg-[#FAF7F2] rounded-full overflow-hidden flex gap-1">
                <div className={`h-full w-1/3 rounded-full ${passwordStrength.level >= 1 ? passwordStrength.color : 'bg-[#FAF7F2]'}`} />
                <div className={`h-full w-1/3 rounded-full ${passwordStrength.level >= 2 ? passwordStrength.color : 'bg-[#FAF7F2]'}`} />
                <div className={`h-full w-1/3 rounded-full ${passwordStrength.level >= 3 ? passwordStrength.color : 'bg-[#FAF7F2]'}`} />
              </div>
              <span className={`text-[10px] font-bold uppercase tracking-wider ${passwordStrength.level === 3 ? 'text-green-600' : passwordStrength.level === 2 ? 'text-yellow-600' : 'text-red-600'}`}>
                {passwordStrength.text}
              </span>
            </div>
          )}

          <FormError error={fieldErrors.password ? t(fieldErrors.password) : undefined} />

          {/* Password Requirements */}
          <div className="text-[10px] text-[#2C1810]/40 mt-2 space-y-0.5">
            <div className={`flex items-center gap-1 ${formData.password.length >= 8 ? 'text-green-600' : ''}`}>
              {formData.password.length >= 8 && <CheckCircle size={10} />}
              <span>{t("auth.passwordRequirements.length")}</span>
            </div>
            <div className={`flex items-center gap-1 ${/[A-Z]/.test(formData.password) ? 'text-green-600' : ''}`}>
              {/[A-Z]/.test(formData.password) && <CheckCircle size={10} />}
              <span>{t("auth.passwordRequirements.uppercase")}</span>
            </div>
            <div className={`flex items-center gap-1 ${/[0-9]/.test(formData.password) ? 'text-green-600' : ''}`}>
              {/[0-9]/.test(formData.password) && <CheckCircle size={10} />}
              <span>{t("auth.passwordRequirements.number")}</span>
            </div>
          </div>
        </div>

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
          {isLoading ? t(AuthMessages.CREATING_ACCOUNT) : t(AuthMessages.CREATE_ACCOUNT)}
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

      {/* Switch to Login */}
      <p className="text-center mt-6 text-sm text-[#2C1810]/60">
        {t(AuthMessages.ALREADY_HAVE_ACCOUNT)}{" "}
        <button
          type="button"
          className="text-[#B85C3C] hover:text-[#2C1810] font-bold transition-colors"
          onClick={onLogin}
        >
          {t(AuthMessages.LOGIN_HERE)}
        </button>
      </p>
    </div>
  );
}
