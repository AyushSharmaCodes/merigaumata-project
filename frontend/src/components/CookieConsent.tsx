import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Cookie, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { COOKIE_CONSENT_REQUIRED_EVENT, COOKIE_CONSENT_STORAGE_KEY, setCookieConsentDecision } from '@/lib/cookie-consent';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false);
  const [showForcedConsent, setShowForcedConsent] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    // Check if user has already made a choice
    const consent = localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
    if (!consent) {
      // Show banner after a short delay for better UX
      const timer = setTimeout(() => {
        setShowBanner(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const openForcedConsent = () => {
      setShowForcedConsent(true);
      setShowBanner(false);
    };

    window.addEventListener(COOKIE_CONSENT_REQUIRED_EVENT, openForcedConsent as EventListener);
    return () => window.removeEventListener(COOKIE_CONSENT_REQUIRED_EVENT, openForcedConsent as EventListener);
  }, []);

  const handleAccept = () => {
    setCookieConsentDecision('accepted');
    setShowBanner(false);
    setShowForcedConsent(false);
  };

  const handleDecline = () => {
    setCookieConsentDecision('declined');
    setShowBanner(false);
  };

  return (
    <>
      {showBanner && (
        <div className="fixed bottom-0 left-0 right-0 z-[10000] p-4 md:p-6 pointer-events-none">
          <Card className="max-w-5xl mx-auto pointer-events-auto bg-background/95 backdrop-blur-md border-primary/20 shadow-2xl animate-in slide-in-from-bottom-4 duration-500 rounded-2xl overflow-hidden">
            <div className="flex flex-col md:flex-row">
              <div className="hidden md:flex bg-primary/5 w-48 items-center justify-center border-r border-border/50">
                <Cookie className="h-20 w-20 text-primary opacity-80" />
              </div>

              <div className="p-6 md:p-8 flex-1">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <h3 className="text-xl font-bold flex items-center gap-2 text-foreground">
                      <ShieldCheck className="h-5 w-5 text-green-600" />
                      {t('common.privacyTitle')}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {t('common.cookieConsentMessage')}
                      <br className="hidden sm:block" />
                      <strong>{t('common.cookieConsent.essential')}</strong> are always active to ensure the website functions securely (e.g., authentication, shopping cart).
                    </p>
                  </div>
                  <button
                    onClick={handleDecline}
                    className="text-muted-foreground hover:text-foreground transition-colors p-1"
                    aria-label={t('common.cookieConsent.closeBanner')}
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                  <Link
                    to="/privacy-policy"
                    className="text-primary hover:underline text-sm font-medium transition-colors"
                    onClick={() => setShowBanner(false)}
                  >
                    {t('common.learnMore')}
                  </Link>

                  <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                      onClick={handleDecline}
                      variant="outline"
                      className="w-full sm:w-auto font-medium"
                    >
                      {t('common.decline')}
                    </Button>
                    <Button
                      onClick={handleAccept}
                      className="w-full sm:w-auto bg-[#B85C3C] hover:bg-[#9A4A2C] text-white font-bold shadow-lg shadow-[#B85C3C]/20"
                    >
                      {t('common.accept')}
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      <AlertDialog open={showForcedConsent} onOpenChange={(open) => { if (!open) setShowForcedConsent(false); }}>
        <AlertDialogContent className="w-full max-w-lg border-primary/20 bg-background shadow-2xl">
          <AlertDialogHeader>
            <div className="mb-1 flex items-center gap-3">
              <div className="rounded-full bg-primary/10 p-3">
                <Cookie className="h-6 w-6 text-primary" />
              </div>
              <div>
                <AlertDialogTitle className="text-xl font-semibold text-foreground">
                  {t("common.cookieConsentRequiredTitle", { defaultValue: "Cookie Consent Required" })}
                </AlertDialogTitle>
                <AlertDialogDescription className="text-sm text-muted-foreground">
                  {t("common.privacyTitle")}
                </AlertDialogDescription>
              </div>
            </div>
          </AlertDialogHeader>

          <p className="text-sm leading-relaxed text-muted-foreground">
            {t("common.cookieConsentRequiredMessage", {
              defaultValue: "To continue with checkout, donations, event registrations, or other critical actions, you must accept cookies."
            })}
          </p>

          <div className="mt-2">
            <Link
              to="/privacy-policy"
              className="text-primary hover:underline text-sm font-medium transition-colors"
            >
              {t('common.learnMore')}
            </Link>
          </div>

          <AlertDialogFooter className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              variant="outline"
              onClick={() => setShowForcedConsent(false)}
            >
              {t("common.cancel", { defaultValue: "Cancel" })}
            </Button>
            <Button
              onClick={handleAccept}
              className="bg-[#B85C3C] hover:bg-[#9A4A2C] text-white"
            >
              {t("common.accept", { defaultValue: "Accept" })}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
