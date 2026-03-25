import { logger, logAPICall, logPageAction } from "@/lib/logger";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorResponse } from "@/types";
import { getGuestId } from '@/lib/guestId';
import { CONFIG } from "@/config";
import i18n from "@/i18n/config";
import { clearAuthSession, getAuthSession, isSessionExpiringSoon, setAuthSession } from "@/lib/auth-session";

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

        // Attach the current app access token as a header backup to the cookie session.
        // Also proactively refresh shortly before expiry to reduce avoidable 401s.
        try {
            const isRefreshRequest = config.url?.includes('/auth/refresh');
            let snapshot = getAuthSession();

            if (!isRefreshRequest && snapshot?.accessToken && isSessionExpiringSoon(60000)) {
                logger.debug('[API Client] Token expiring soon, proactively refreshing...');
                const refreshResponse = await apiClient.post('/auth/refresh', {}, { silent: true } as any);
                if (refreshResponse.data?.tokens) {
                    snapshot = setAuthSession(refreshResponse.data.tokens);
                }
            }

            if (snapshot?.accessToken) {
                config.headers['Authorization'] = `Bearer ${snapshot.accessToken}`;
            } else {
                logger.debug('[API Client] No in-memory app session available for request attachment');
            }
        } catch (authErr) {
            logger.warn('[API Client] Auth header attachment failure', { authErr });
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

        const savedCurrency = typeof window !== 'undefined' ? localStorage.getItem('preferredCurrency') : null;
        if (savedCurrency) {
            config.headers['x-user-currency'] = savedCurrency;
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

                                    // Proceed with a single refresh call while holding the lock.
                                    // The browser cookie jar will send the latest session cookie it has.

                                    logger.debug('[API Client] Acquired refresh lock, starting token refresh...');
                                    const res = await apiClient.post('/auth/refresh');
                                    logger.debug('[API Client] Refresh success');

                                    const { tokens } = res.data;
                                    if (tokens?.access_token && tokens?.refresh_token) {
                                        setAuthSession(tokens);
                                    }

                                    sessionExpiredHandled = false;
                                    return res;
                                });
                            } else {
                                // Fallback for environments without Web Locks (should be rare in modern browsers)
                                logger.debug('[API Client] Starting token refresh (no lock capability)...');
                                const res = await apiClient.post('/auth/refresh');
                                logger.debug('[API Client] Refresh success');

                                const { tokens } = res.data;
                                if (tokens?.access_token && tokens?.refresh_token) {
                                    setAuthSession(tokens);
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
                clearAuthSession();

                if (!sessionExpiredHandled) {
                    sessionExpiredHandled = true;

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
