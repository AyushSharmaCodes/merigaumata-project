import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";

interface AuthSuccessProps {
  isLoading: boolean;
  resendCooldown: number;
  onBackToLogin: () => void;
  onResendConfirmation: () => void;
}

export const AuthSuccess = ({
  isLoading,
  resendCooldown,
  onBackToLogin,
  onResendConfirmation,
}: AuthSuccessProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6 text-center">
      <p className="text-sm text-muted-foreground">
        {t(AuthMessages.REG_SUCCESS_EMAIL_SENT)}
        <br />
        {t(AuthMessages.REG_SUCCESS_INSTRUCTION)}
      </p>
      <div className="space-y-2">
        <Button className="w-full" onClick={onBackToLogin}>
          {t(AuthMessages.PROCEED_TO_LOGIN)}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs"
          onClick={onResendConfirmation}
          disabled={isLoading || resendCooldown > 0}
        >
          {resendCooldown > 0 
            ? `${t(AuthMessages.RESEND_AVAILABLE_IN)} ${resendCooldown}${t(AuthMessages.SECONDS_SHORT)}` 
            : t(AuthMessages.RESEND_CONFIRMATION_EMAIL)}
        </Button>
      </div>
    </div>
  );
};
