import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FormError } from "@/components/ui/form-error";
import { toast } from "@/hooks/use-toast";
import { validators } from "@/lib/validation";
import { ErrorMessages } from "@/constants/messages/ErrorMessages";

interface ResetPasswordFormProps {
  emailOrPhone: string;
  onSubmit: (password: string) => void;
  onBack: () => void;
}

export function ResetPasswordForm({
  emailOrPhone,
  onSubmit,
  onBack,
}: ResetPasswordFormProps) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setConfirmPasswordError(null);

    if (password !== confirmPassword) {
      setConfirmPasswordError("validation.password.mismatch");
      toast({
        title: t(ErrorMessages.AUTH_CHECK_INFO),
        description: t("resetPassword.matchError"),
        variant: "destructive",
      });
      return;
    }
    const passErr = validators.password(password);
    if (passErr) {
      setPasswordError(passErr);
      toast({
        title: t(ErrorMessages.AUTH_CHECK_INFO),
        description: t(passErr),
        variant: "destructive",
      });
      return;
    }

    setIsResetting(true);
    // Mock password reset API call
    setTimeout(() => {
      toast({
        title: t("common.success"),
        description: t("resetPassword.successToastDesc"),
      });
      setIsResetting(false);
      onSubmit(password);
    }, 1500);
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
          {t("resetPassword.submitButton")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("resetPassword.validDesc", { email: emailOrPhone })}
        </p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">{t("resetPassword.newPassword")}</Label>
          <Input
            id="password"
            autoComplete="new-password"
            type="password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setPasswordError(null);
            }}
            placeholder={t("auth.createPasswordPlaceholder")}
            required
            minLength={8}
          />
          <FormError error={passwordError ? t(passwordError) : undefined} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t("resetPassword.confirmPassword")}</Label>
          <Input
            id="confirmPassword"
            autoComplete="new-password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmPasswordError(null);
            }}
            placeholder={t("resetPassword.placeholderConfirm")}
            required
            minLength={8}
          />
          <FormError error={confirmPasswordError ? t(confirmPasswordError) : undefined} />
        </div>
        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isResetting}
        >
          {isResetting ? t("resetPassword.submittingButton") : t("resetPassword.submitButton")}
        </Button>
        <Button
          variant="link"
          className="w-full"
          size="sm"
          onClick={onBack}
          disabled={isResetting}
        >
          {t("common.back")}
        </Button>
      </form>
    </div>
  );
}
