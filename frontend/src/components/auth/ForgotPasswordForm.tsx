import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { toast } from "@/hooks/use-toast";
import { validators } from "@/lib/validation";
import { ErrorMessages } from "@/constants/messages/ErrorMessages";

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
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = emailOrPhone.trim();
    const nextError =
      validators.required(trimmed) ||
      (validators.email(trimmed) && validators.phone(trimmed) ? ErrorMessages.AUTH_INVALID_EMAIL_PHONE : null);

    if (nextError) {
      setError(nextError);
      toast({
        title: t(ErrorMessages.AUTH_CHECK_INFO),
        description: t(ErrorMessages.AUTH_FIX_ERRORS),
        variant: "destructive",
      });
      return;
    }

    onSubmit(trimmed);
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
            autoComplete="username"
            type="text"
            value={emailOrPhone}
            onChange={(e) => {
              setEmailOrPhone(e.target.value);
              setError(null);
            }}
            placeholder={t("auth.emailPhonePlaceholder")}
            required
          />
          <FormError error={error ? t(error) : undefined} />
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
