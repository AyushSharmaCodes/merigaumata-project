import { logger } from "@/lib/logger";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/authStore";
import { syncSession } from "@/lib/services/auth.service";
import { useTranslation } from 'react-i18next';

const AuthCallback = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { initializeAuth } = useAuthStore();

    useEffect(() => {
        // This component mounts when redirection from OAuth provider happens.
        // Supabase client (configured with detectSessionInUrl: true) automatically 
        // parses the URL hash and sets the session in local storage.
        // We just need to wait a moment or verify session state, then redirect.

        const handleCallback = async () => {
            // Wait for Supabase to process the hash
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
                logger.error("Auth callback error:", error);
                navigate("/?auth=login&error=callback_failed");
                return;
            }

            if (session) {
                try {
                    // Sync session with backend cookies
                    const userData = await syncSession(session.access_token, session.refresh_token);

                    if (userData) {
                        const { login } = useAuthStore.getState();
                        login({
                            id: userData.id,
                            email: userData.email || '',
                            name: userData.name || '',
                            phone: userData.phone || undefined,
                            role: userData.role || 'customer',
                            emailVerified: userData.emailVerified,
                            phoneVerified: userData.phoneVerified || false,
                            mustChangePassword: userData.mustChangePassword || false,
                            deletionStatus: userData.deletionStatus,
                            scheduledDeletionAt: userData.scheduledDeletionAt,
                            addresses: [],
                        });
                    } else {
                        // Fallback to initialization if user data missing
                        await initializeAuth();
                    }

                    navigate("/");
                } catch (err) {
                    logger.error("Session sync failed:", err);
                    navigate("/?auth=login&error=sync_failed");
                }
            } else {
                // If no session found, maybe wait for event? 
                // Usually getSession is enough if the URL contained the hash.
                // We'll give it a small timeout or just redirect.
                navigate("/?auth=login");
            }
        };

        handleCallback();
    }, [navigate, initializeAuth]);

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
