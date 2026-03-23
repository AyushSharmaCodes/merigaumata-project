import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface ForgotPasswordFormProps {
  onSubmit: (emailOrPhone: string) => void;
  onBack: () => void;
}

export function ForgotPasswordForm({
  onSubmit,
  onBack,
}: ForgotPasswordFormProps) {
  const { t } = useTranslation();
  const [emailOrPhone, setEmailOrPhone] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOrPhone.trim()) {
      onSubmit(emailOrPhone);
    }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="text-center mb-6">
        <div className="flex items-center justify-center mb-4">
          <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <span className="text-3xl">🐄</span>
          </div>
        </div>
        <h2 className="text-lg font-semibold text-foreground mb-1">
          {t("auth.forgotPassword")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("auth.emailPhonePlaceholder")}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="emailOrPhone">{t("auth.emailPhone")}</Label>
          <Input
            id="emailOrPhone"
            type="text"
            value={emailOrPhone}
            onChange={(e) => setEmailOrPhone(e.target.value)}
            placeholder={t("auth.emailPhonePlaceholder")}
            required
          />
        </div>
        <Button type="submit" className="w-full" size="lg">
          {t("common.next")}
        </Button>
        <Button variant="link" className="w-full" size="sm" onClick={onBack}>
          {t("auth.backToLogin")}
        </Button>
      </form>
    </div>
  );
}
