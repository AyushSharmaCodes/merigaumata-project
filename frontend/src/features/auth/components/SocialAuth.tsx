import { FcGoogle } from "react-icons/fc";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";

interface SocialAuthProps {
  onGoogleLogin: () => void;
  isLoading?: boolean;
}

export const SocialAuth = ({ onGoogleLogin, isLoading }: SocialAuthProps) => {
  const { t } = useTranslation();

  return (
    <>
      <Button
        variant="outline"
        className="w-full mb-4 flex items-center gap-2"
        onClick={onGoogleLogin}
        type="button"
        disabled={isLoading}
      >
        <FcGoogle className="w-5 h-5" />
        {t(AuthMessages.GOOGLE_CONTINUE)}
      </Button>

      <div className="relative mb-4">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            {t(AuthMessages.OR_CONTINUE_WITH_EMAIL)}
          </span>
        </div>
      </div>
    </>
  );
};
