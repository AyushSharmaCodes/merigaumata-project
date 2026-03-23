
import { useEffect, useState } from "react";
import { useLocationStore } from "@/store/locationStore";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { FcGoogle } from "react-icons/fc";

interface RegisterFormProps {
  emailOrPhone?: string;
  onSubmit: (name: string, phone: string, password: string, email: string) => void;
  onSwitchToLogin: () => void;
  onGoogleSignIn?: () => void;
}

import { validators } from "@/lib/validation";

export function RegisterForm({
  emailOrPhone: initialEmailOrPhone = "",
  onSubmit,
  onSwitchToLogin,
  onGoogleSignIn,
}: RegisterFormProps) {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState(initialEmailOrPhone);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const { validatePhone, isValidatingPhone } = useLocationStore();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const passError = validators.password(password);
    if (passError) {
      setPasswordError(passError);
      return;
    }

    if (
      name.trim() &&
      phone && phone.length > 5 &&
      !phoneError
    ) {
      onSubmit(name, phone, password, email);
    }
  };

  // Phone Validation Effect
  useEffect(() => {
    if (!phone || phone.length < 10) {
      setPhoneError(null);
      return;
    }

    const timer = setTimeout(async () => {
      const result = await validatePhone(phone);
      if (result && !result.isValid) {
        setPhoneError(result.error || t("errors.auth.invalidPhone"));
      } else {
        setPhoneError(null);
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [phone, validatePhone, t]);

  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setPassword(val);
    setPasswordError(null);
  };

  // Password strength indicator
  const getPasswordStrength = () => {
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
          {t("auth.createAccountTitle")}
        </h2>
        <p className="text-sm text-[#2C1810]/60">{t("auth.joinCommunity")}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4" action="#">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="name" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("profile.name")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <Input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("auth.namePlaceholder")}
            required
            className="h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white border-[#B85C3C]/10 focus:border-[#B85C3C] transition-colors"
          />
        </div>

        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("profile.email")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            required
            className="h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white border-[#B85C3C]/10 focus:border-[#B85C3C] transition-colors"
          />
        </div>

        {/* Phone */}
        <div className="space-y-2">
          <Label htmlFor="phone" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("profile.phone")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <PhoneInput
            id="phone"
            value={phone}
            onChange={(value) => setPhone(value as string)}
            placeholder={t("auth.phonePlaceholder")}
            error={phoneError || undefined}
          />
          {phoneError && (
            <p className="text-xs text-red-500 mt-1">{phoneError}</p>
          )}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-[#2C1810]">
            {t("auth.password")} <span className="text-[#B85C3C]">*</span>
          </Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={handlePasswordChange}
              placeholder={t("auth.createPasswordPlaceholder")}
              required
              minLength={8}
              className={`h-12 rounded-xl border-2 bg-[#FAF7F2] focus:bg-white pr-12 transition-colors ${passwordError ? "border-red-500" : "border-[#B85C3C]/10 focus:border-[#B85C3C]"}`}
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#2C1810]/40 hover:text-[#B85C3C] transition-colors"
              onClick={() => setShowPassword((prev) => !prev)}
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

          {passwordError && (
            <p className="text-xs text-red-500 mt-1">{passwordError}</p>
          )}

          {/* Password Requirements */}
          <div className="text-[10px] text-[#2C1810]/40 mt-2 space-y-0.5">
            <div className={`flex items-center gap-1 ${password.length >= 8 ? 'text-green-600' : ''}`}>
              {password.length >= 8 && <CheckCircle size={10} />}
              <span>{t("auth.passwordRequirements.length")}</span>
            </div>
            <div className={`flex items-center gap-1 ${/[A-Z]/.test(password) ? 'text-green-600' : ''}`}>
              {/[A-Z]/.test(password) && <CheckCircle size={10} />}
              <span>{t("auth.passwordRequirements.uppercase")}</span>
            </div>
            <div className={`flex items-center gap-1 ${/[0-9]/.test(password) ? 'text-green-600' : ''}`}>
              {/[0-9]/.test(password) && <CheckCircle size={10} />}
              <span>{t("auth.passwordRequirements.number")}</span>
            </div>
          </div>
        </div>

        {/* Terms */}
        <p className="text-[10px] text-[#2C1810]/50 text-center leading-relaxed">
          {t("auth.termsAgree")}{" "}
          <button
            type="button"
            className="text-[#B85C3C] hover:underline font-medium"
            onClick={() => window.open("/terms-and-conditions", "_blank")}
          >
            {t("auth.termsOfUse")}
          </button>{" "}
          and{" "}
          <button
            type="button"
            className="text-[#B85C3C] hover:underline font-medium"
            onClick={() => window.open("/privacy-policy", "_blank")}
          >
            {t("auth.privacyPolicy")}
          </button>
          .
        </p>

        <Button
          type="submit"
          className="w-full h-12 rounded-xl text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/20"
          size="lg"
        >
          {t("auth.createAccountTitle")}
        </Button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[#B85C3C]/10" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
          <span className="bg-white px-3 text-[#2C1810]/40 font-medium">{t("auth.orContinueWith")}</span>
        </div>
      </div>

      {/* Google OAuth */}
      <Button
        type="button"
        variant="outline"
        className="w-full h-12 rounded-xl gap-3 border-2 border-[#B85C3C]/10 text-[#2C1810] hover:bg-[#FAF7F2] hover:border-[#B85C3C]/20 transition-all"
        size="lg"
        onClick={onGoogleSignIn}
      >
        <FcGoogle className="h-5 w-5" />
        <span className="font-medium">{t("auth.googleContinue")}</span>
      </Button>

      {/* Switch to Login */}
      <p className="text-center mt-6 text-sm text-[#2C1810]/60">
        {t("auth.alreadyHaveAccount")}{" "}
        <button
          type="button"
          className="text-[#B85C3C] hover:text-[#2C1810] font-bold transition-colors"
          onClick={onSwitchToLogin}
        >
          {t("auth.loginHere")}
        </button>
      </p>
    </div>
  );
}
