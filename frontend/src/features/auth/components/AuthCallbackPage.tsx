import { logger } from "@/core/observability/logger";
import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/domains/auth";
import { exchangeGoogleCode } from "@/domains/auth";
import { useTranslation } from "react-i18next";

export const AuthCallbackPage = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login, initializeAuth } = useAuthStore();

    useEffect(() => {
        const handleCallback = async () => {
            const error = searchParams.get('error');
            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (error) {
                navigate('/?auth=login&error=google_callback_failed', { replace: true });
                return;
            }

            if (!code || !state) {
                navigate('/?auth=login&error=google_callback_failed', { replace: true });
                return;
            }

            try {
                const { user } = await exchangeGoogleCode(code, state);
                login(user);
                navigate('/', { replace: true });
            } catch (err) {
                logger.error("Google auth callback failed:", err);
                await initializeAuth();
                navigate('/?auth=login&error=google_callback_failed', { replace: true });
            }
        };

        void handleCallback();
    }, [initializeAuth, login, navigate, searchParams]);

    return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
                <h2 className="text-xl font-semibold mb-2">{t('auth.authenticating')}</h2>
                <p className="text-gray-500">{t('auth.pleaseWait')}</p>
            </div>
        </div>
    );
};

