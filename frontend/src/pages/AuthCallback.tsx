import { logger } from "@/lib/logger";
import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { exchangeGoogleCode } from "@/lib/services/auth.service";
import { useTranslation } from "react-i18next";

const AuthCallback = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { login, initializeAuth } = useAuthStore();
    const callbackStarted = useRef(false);

    useEffect(() => {
        const handleCallback = async () => {
            if (callbackStarted.current) return;
            callbackStarted.current = true;

            const error = searchParams.get('error');
            const code = searchParams.get('code');
            const state = searchParams.get('state');

            if (error) {
                logger.error("Google auth error reported in URL:", error);
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
                
                // Ensure lifecycle listeners (focus, visibility, auto-refresh) are started.
                // App.tsx skips this on /auth/callback to avoid race conditions during the exchange.
                void initializeAuth();
                
                navigate('/', { replace: true });
            } catch (err) {
                logger.error("Google auth code exchange failed:", err);
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

export default AuthCallback;
