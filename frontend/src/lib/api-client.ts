import { logger, logAPICall, logPageAction } from "@/lib/logger";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorResponse } from "@/types";
import { supabase } from "@/lib/supabase";
import { getGuestId } from '@/lib/guestId';
import { CONFIG } from "@/config";
import i18n from "@/i18n/config";

const API_BASE_URL = CONFIG.API_BASE_URL;

interface CustomAxiosConfig extends InternalAxiosRequestConfig {
    metadata?: {
        startTime: number;
        correlationId: string;
    };
    _retry?: boolean;
    silent?: boolean;
}

const IDEMPOTENCY_ROUTES = [
    '/checkout/create-payment-order',
    '/checkout/verify-payment',
    '/donations/create-order',
    '/donations/create-subscription',
    '/donations/verify'
];

function generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function requiresIdempotencyKey(url: string | undefined, method: string | undefined): boolean {
    if (!url || method?.toUpperCase() !== 'POST') return false;
    return IDEMPOTENCY_ROUTES.some(route => url.includes(route));
}

// Singleton promise for simultaneous refresh requests
let refreshPromise: Promise<import('axios').AxiosResponse<unknown>> | null = null;
let sessionExpiredHandled = false;

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000,
});


// ... (existing configuration)

apiClient.interceptors.request.use(
    async (config) => {
        const customConfig = config as CustomAxiosConfig;
        const correlationId = generateUUID();
        customConfig.metadata = {
            startTime: Date.now(),
            correlationId
        };
        config.headers['X-Correlation-ID'] = correlationId;

        // Robust Auth: Explicitly attach Bearer token from Supabase as a backup to cookies
        // This solves SameSite=Lax issues on cross-port localhost requests
        // OPTIMIZATION: Proactively check token expiry and refresh if needed (prevents 401 errors)
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.access_token) {
                // Helper to check token expiry (inline to avoid import complexity)
                const isExpired = (token: string, bufferMs: number = 60000): boolean => {
                    try {
                        const payload = JSON.parse(atob(token.split('.')[1]));
                        return payload.exp * 1000 < Date.now() + bufferMs;
                    } catch {
                        return true;
                    }
                };

                // PROACTIVE REFRESH: If token expires within 60 seconds, refresh before making request
                if (isExpired(session.access_token, 60000)) {
                    console.debug('[API Client] Token expiring soon, proactively refreshing...');
                    const { data: { session: newSession }, error } = await supabase.auth.refreshSession();

                    if (!error && newSession?.access_token) {
                        config.headers['Authorization'] = `Bearer ${newSession.access_token}`;
                    } else {
                        config.headers['Authorization'] = `Bearer ${session.access_token}`;
                    }
                } else {
                    config.headers['Authorization'] = `Bearer ${session.access_token}`;
                }
            } else {
                // No session in Supabase, but cookies might still exist
                console.debug('[API Client] No Supabase session found for request attachment');
            }
        } catch (authErr) {
            console.error('[API Client] Auth header attachment failure:', authErr);
        }

        // Attach Guest ID if present
        const guestId = getGuestId();
        if (guestId) {
            config.headers['x-guest-id'] = guestId;
        }

        // Attach Language Preference
        const savedLang = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
        if (savedLang) {
            config.headers['x-user-lang'] = savedLang;
        }

        if (requiresIdempotencyKey(config.url, config.method)) {
            config.headers['X-Idempotency-Key'] = generateUUID();
        }

        if (!customConfig.silent) {
            logPageAction('APIRequestStarted', {
                method: config.method?.toUpperCase(),
                url: config.url,
                correlationId
            });
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => {
        const config = response.config as CustomAxiosConfig;
        const duration = config.metadata?.startTime ? Date.now() - config.metadata.startTime : 0;
        logAPICall(config.url || 'unknown', config.method?.toUpperCase() || 'UNKNOWN', response.status, duration, config.metadata?.correlationId, config.silent);
        sessionExpiredHandled = false;
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosConfig | undefined;

        if (originalRequest) {
            const duration = originalRequest.metadata?.startTime ? Date.now() - originalRequest.metadata.startTime : 0;
            logAPICall(originalRequest.url || 'unknown', originalRequest.method?.toUpperCase() || 'UNKNOWN', error.response?.status || 0, duration, originalRequest.metadata?.correlationId, originalRequest?.silent);
        }

        // 401 Unauthorized -> Refresh
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            const isAuthEndpoint = originalRequest.url?.includes('/auth/refresh') ||
                originalRequest.url?.includes('/auth/sync') ||
                originalRequest.url?.includes('/auth/me') ||
                originalRequest.url?.includes('/auth/register') ||
                originalRequest.url?.includes('/auth/validate-credentials') ||
                originalRequest.url?.includes('/auth/verify-login-otp');

            if (isAuthEndpoint) return Promise.reject(error);

            originalRequest._retry = true;

            try {
                if (!refreshPromise) {
                    refreshPromise = (async () => {
                        try {
                            // Use Web Locks API to synchronize across tabs
                            if (typeof navigator !== 'undefined' && navigator.locks) {
                                return await navigator.locks.request('authRefreshLock', async () => {
                                    // Once we have the lock, checks if we really need to refresh.
                                    // Another tab might have just refreshed it.
                                    // We can verify this by trying a lightweight request or just proceeding 
                                    // if we assume the cookie jar is updated.

                                    // Simple approach: Just proceed. Supabase allows chaining (A->A'->A'').
                                    // The lock ensures we don't send 'A' twice efficiently.
                                    // But to be even safer, we could try the original request first?
                                    // No, we can't easily replay originalRequest here without it being messy.
                                    // Let's just call refresh. The browser will send the *latest* cookie it has.

                                    logger.debug('[API Client] Acquired refresh lock, starting token refresh...');
                                    const res = await apiClient.post('/auth/refresh');
                                    logger.debug('[API Client] Refresh success');

                                    // Sync Supabase Client SDK with new tokens
                                    const { tokens } = res.data;
                                    if (tokens?.access_token && tokens?.refresh_token) {
                                        const { error } = await supabase.auth.setSession({
                                            access_token: tokens.access_token,
                                            refresh_token: tokens.refresh_token
                                        });
                                        if (error) logger.warn("[API Client] Supabase session sync warning:", { error });
                                        else logger.debug("[API Client] Supabase session synced with new tokens");
                                    }

                                    sessionExpiredHandled = false;
                                    return res;
                                });
                            } else {
                                // Fallback for environments without Web Locks (should be rare in modern browsers)
                                logger.debug('[API Client] Starting token refresh (no lock capability)...');
                                const res = await apiClient.post('/auth/refresh');
                                logger.debug('[API Client] Refresh success');

                                // Sync Supabase Client SDK with new tokens
                                const { tokens } = res.data;
                                if (tokens?.access_token && tokens?.refresh_token) {
                                    const { error } = await supabase.auth.setSession({
                                        access_token: tokens.access_token,
                                        refresh_token: tokens.refresh_token
                                    });
                                    if (error) logger.warn("[API Client] Supabase session sync warning:", { error });
                                    else logger.debug("[API Client] Supabase session synced with new tokens");
                                }

                                sessionExpiredHandled = false;
                                return res;
                            }
                        } catch (err) {
                            logger.debug('[API Client] Refresh failure');
                            throw err;
                        } finally {
                            refreshPromise = null;
                        }
                    })();
                }

                await refreshPromise;
                logger.debug('[API Client] Retrying original request (Post-Refresh)');

                // Ensure the retry uses the latest auth state from cookies/header
                // apiClient.request(originalRequest) will trigger request interceptors again
                return apiClient.request(originalRequest);
            } catch (error: unknown) {
                const refreshError = error as AxiosError<ApiErrorResponse>;
                // Backend refresh failed - try Supabase SDK as fallback
                logger.debug('[API Client] Backend refresh failed, attempting Supabase SDK fallback...');

                try {
                    const { data: { session: newSession }, error: supabaseError } = await supabase.auth.refreshSession();

                    if (supabaseError || !newSession?.access_token) {
                        throw new Error('Supabase refresh also failed');
                    }

                    logger.debug('[API Client] Supabase SDK refresh successful, retrying original request');

                    // RESYNC COOKIES: Backend cookies are likely gone/invalid, so we must sync the new session
                    try {
                        await apiClient.post('/auth/sync', {
                            access_token: newSession.access_token,
                            refresh_token: newSession.refresh_token
                        });
                        logger.debug('[API Client] Resynced cookies after SDK fallback');
                    } catch (syncErr) {
                        // Don't block the retry, but log the warning
                        logger.warn('[API Client] Failed to resync cookies after SDK fallback', { syncErr });
                    }

                    // Update the original request with new token explicitly for this retry
                    if (originalRequest.headers) {
                        originalRequest.headers['Authorization'] = `Bearer ${newSession.access_token}`;

                        // Ensure Guest ID and Language are preserved/refreshed
                        const guestId = getGuestId();
                        if (guestId) originalRequest.headers['x-guest-id'] = guestId;

                        const savedLang = typeof window !== 'undefined' ? localStorage.getItem('language') : null;
                        if (savedLang) originalRequest.headers['x-user-lang'] = savedLang;

                        // CRITICAL FIX: If retrying a FormData request (file upload), we MUST remove the Content-Type header
                        if (originalRequest.data instanceof FormData) {
                            delete originalRequest.headers['Content-Type'];
                            logger.debug('[API Client] Removed stale Content-Type header for FormData retry');
                        }
                    }

                    sessionExpiredHandled = false;
                    return apiClient.request(originalRequest);
                } catch (supabaseFallbackError) {
                    // Both backend and Supabase refresh failed - session truly expired
                    logger.warn('[API Client] Both backend and Supabase refresh failed, session expired', { supabaseFallbackError });

                    if (!sessionExpiredHandled) {
                        sessionExpiredHandled = true;

                        // Extract user-friendly error message from backend response
                        const errorMessage = refreshError.response?.data?.error || 'Session expired';

                        logger.warn('[API Client] Session expired permanently, notifying app', { errorMessage });
                        window.dispatchEvent(new CustomEvent('auth:session-expired', {
                            detail: {
                                url: originalRequest.url,
                                message: errorMessage,
                                reason: (refreshError.response?.data as any)?.reason || 'unknown'
                            }
                        }));
                    }
                    return Promise.reject(refreshError);
                }
            }
        }


        // Log network errors with trace to find source
        if (isNetworkError(error)) {
            console.group("⚠️ Network Error Detected");
            console.error("URL:", error.config?.url);
            console.error("Method:", error.config?.method);
            console.trace("Network Error Stack Trace");
            console.groupEnd();

            logger.error('[API Client] Network Error:', {
                url: error.config?.url,
                method: error.config?.method,
                message: error.message
            });
        }

        // Centralized error normalization using errorUtils
        error.message = getErrorMessage(error, i18n.t);

        return Promise.reject(error);
    }
);
