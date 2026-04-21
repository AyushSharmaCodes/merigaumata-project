import { logger, logAPICall, logAPIRequest, logFrontendAuthEvent, logPageAction } from "@/lib/logger";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ApiErrorResponse, User } from "@/types";
import { getGuestId } from '@/lib/guestId';
import { CONFIG } from "@/config";
import i18n from "@/i18n/config";
import { hasAcceptedCookieConsent, requestCookieConsentForCriticalAction, requiresCookieConsentForRequest, shouldAuditCookieConsentCoverage, CookieConsentRequiredError, getNormalizedConsentRequestPath, COOKIE_CONSENT_DECIDED_EVENT } from "@/lib/cookie-consent";
import { clearAuthSession, clearAuthUserSnapshot, getAuthSession } from "@/lib/auth-session";

const API_BASE_URL = CONFIG.API_BASE_URL;

interface CustomAxiosConfig extends InternalAxiosRequestConfig {
    metadata?: {
        startTime: number;
        correlationId: string;
        traceId: string;
        spanId: string;
    };
    _retry?: boolean;
    silent?: boolean;
}

type RefreshAxiosError = AxiosError<ApiErrorResponse> & {
    refreshAttemptCount?: number;
};

const IDEMPOTENCY_ROUTES = [
    '/contact',
    '/checkout/create-payment-order',
    '/checkout/verify-payment',
    '/event-registrations/check-eligibility',
    '/event-registrations/create-order',
    '/event-registrations/verify-payment',
    '/donations/create-order',
    '/donations/create-subscription',
    '/donations/verify',
    '/returns/request'
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
    const normalizedUrl = url.split('?')[0].replace(/\/+$/, '') || '/';
    return IDEMPOTENCY_ROUTES.some((route) => normalizedUrl === route || normalizedUrl.endsWith(route));
}

interface RefreshResponse {
    success: boolean;
    user: User;
}

// Singleton promise for simultaneous refresh requests
let refreshPromise: Promise<import('axios').AxiosResponse<RefreshResponse>> | null = null;
let sessionExpiredHandled = false;
const REFRESH_MAX_RETRIES = 2;
const REFRESH_RETRY_BASE_DELAY_MS = 250;
const REFRESH_CONFLICT_WAIT_MS = 2500;
const SESSION_RESUME_REFRESH_WINDOW_MS = 4000;

let lastAppResumeAt = 0;
let lastSessionRefreshAt = 0;
let resumeTrackingInitialized = false;

let isMaintenanceLocked = false;

export const setMaintenanceLock = (locked: boolean) => {
    isMaintenanceLocked = locked;
};

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    withCredentials: true,
    timeout: 30000,
});

function isTerminalRefreshFailure(status?: number): boolean {
    return status === 401 || status === 403 || status === 410;
}

function markAppResumed() {
    lastAppResumeAt = Date.now();
}

function isAuthEndpoint(url?: string): boolean {
    return Boolean(
        url?.includes('/auth/refresh') ||
        url?.includes('/auth/sync') ||
        url?.includes('/auth/me') ||
        url?.includes('/auth/register') ||
        url?.includes('/auth/validate-credentials') ||
        url?.includes('/auth/verify-login-otp')
    );
}

function shouldRunPreRequestRefresh(config: CustomAxiosConfig): boolean {
    if (typeof window === 'undefined') {
        return false;
    }

    if (config.method?.toUpperCase() === 'OPTIONS') {
        return false;
    }

    if (config._retry || isAuthEndpoint(config.url)) {
        return false;
    }

    if (!getAuthSession()) {
        return false;
    }

    const resumedRecently = lastAppResumeAt > 0 && Date.now() - lastAppResumeAt <= SESSION_RESUME_REFRESH_WINDOW_MS;
    if (!resumedRecently) {
        return false;
    }

    return lastSessionRefreshAt < lastAppResumeAt;
}

function notifySessionExpired(reason: {
    message?: string;
    refreshStatus?: number;
    refreshAttemptCount?: number;
    url?: string;
    refreshReason?: string;
}) {
    if (sessionExpiredHandled || typeof window === 'undefined') {
        return;
    }

    sessionExpiredHandled = true;
    clearAuthSession();
    clearAuthUserSnapshot();

    const errorMessage = reason.message || 'Session expired';

    logger.warn('[API Client] Session expired permanently, notifying app', { errorMessage });
    logFrontendAuthEvent('[API Client] Terminal refresh failure logged out the session', {
        status: reason.refreshStatus,
        refreshAttemptCount: reason.refreshAttemptCount || 1,
        url: reason.url,
        reason: reason.refreshReason || 'unknown'
    });
    void logger.error('[API Client] Terminal refresh failure', {
        component: 'APIClient',
        action: 'auth_refresh_terminal_failure',
        status: reason.refreshStatus,
        refreshAttemptCount: reason.refreshAttemptCount || 1,
        url: reason.url,
        reason: reason.refreshReason || 'unknown'
    });
    window.dispatchEvent(new CustomEvent('auth:session-expired', {
        detail: {
            url: reason.url,
            message: errorMessage,
            reason: reason.refreshReason || 'unknown'
        }
    }));
}

function initializeResumeTracking() {
    if (resumeTrackingInitialized || typeof window === 'undefined' || typeof document === 'undefined') {
        return;
    }

    resumeTrackingInitialized = true;

    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
            markAppResumed();
        }
    });
    window.addEventListener('focus', markAppResumed);
    window.addEventListener('pageshow', markAppResumed);
    window.addEventListener('online', markAppResumed);
}

function shouldRetryRefresh(error: AxiosError<ApiErrorResponse>): boolean {
    if (!error.response) {
        return true;
    }

    const status = error.response.status;
    // Note: 409 (Conflict) is NOT retried here. It's handled explicitly in performRefreshRequest.
    return status === 429 || status >= 500;
}

function wait(ms: number): Promise<void> {
    return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

function getRetryDelay(attempt: number): number {
    return REFRESH_RETRY_BASE_DELAY_MS * (2 ** attempt);
}

async function performRefreshRequest(
    silent = false,
    options: { optionalUnauthenticated?: boolean } = {}
) {
    let attempt = 0;

    while (true) {
        try {
            const body: Record<string, unknown> = {};
            if (options.optionalUnauthenticated) {
                body.optional = true;
            }

            // Note: Tokens are sent automatically via HttpOnly cookies (withCredentials: true)
            const res = await apiClient.post<RefreshResponse>('/auth/refresh', body, { silent } as any);
            sessionExpiredHandled = false;
            lastSessionRefreshAt = Date.now();
            return res;
        } catch (error) {
            const refreshError = error as RefreshAxiosError;
            refreshError.refreshAttemptCount = attempt + 1;

            // SPECIAL CASE: 409 Conflict indicates a concurrent refresh is already in progress.
            // Wait briefly and then perform a real refresh retry so terminal failures still surface correctly.
            const isConflict = refreshError.response?.status === 409 || (refreshError as any).status === 409;
            if (isConflict) {
                if (attempt >= REFRESH_MAX_RETRIES) {
                    throw refreshError;
                }

                const waitMs = REFRESH_CONFLICT_WAIT_MS;
                logger.debug('[API Client] Concurrent refresh detected (409), waiting before retrying refresh...', {
                    waitMs,
                    attempt: attempt + 1,
                    maxRetries: REFRESH_MAX_RETRIES
                });
                await wait(waitMs);
                attempt += 1;
                continue;
            }

            if (attempt >= REFRESH_MAX_RETRIES || !shouldRetryRefresh(refreshError)) {
                throw refreshError;
            }

            const delayMs = getRetryDelay(attempt);
            logger.warn('[API Client] Refresh attempt failed, retrying', {
                attempt: attempt + 1,
                maxRetries: REFRESH_MAX_RETRIES,
                delayMs,
                status: refreshError.response?.status
            });
            logFrontendAuthEvent('[API Client] Refresh attempt failed, retrying', {
                attempt: attempt + 1,
                maxRetries: REFRESH_MAX_RETRIES,
                delayMs,
                status: refreshError.response?.status
            });

            attempt += 1;
            await wait(delayMs);
        }
    }
}

// Proactive refresh removed in HttpOnly mode as we don't have JS visibility into cookie expiry.
// We rely on 401 interceptors for lazy-refreshing.

export async function refreshAuthSession(
    silent = false,
    context: { reason?: string; url?: string; optionalUnauthenticated?: boolean } = {}
) {
    initializeResumeTracking();

    if (!refreshPromise) {
        refreshPromise = (async () => {
            try {
                logFrontendAuthEvent('[API Client] Refresh flow started', {
                    url: context.url || null,
                    reason: context.reason || 'shared_refresh'
                });

                if (typeof navigator !== 'undefined' && navigator.locks) {
                    return await navigator.locks.request('authRefreshLock', async () => {
                        logger.debug('[API Client] Acquired refresh lock, starting token refresh...');
                        const res = await performRefreshRequest(silent, {
                            optionalUnauthenticated: context.optionalUnauthenticated
                        });
                        logger.debug('[API Client] Refresh success');
                        return res;
                    });
                }

                logger.debug('[API Client] Starting token refresh (no lock capability)...');
                const res = await performRefreshRequest(silent, {
                    optionalUnauthenticated: context.optionalUnauthenticated
                });
                logger.debug('[API Client] Refresh success');
                return res;
            } catch (err) {
                logger.debug('[API Client] Refresh failure');
                throw err;
            } finally {
                refreshPromise = null;
            }
        })();
    }

    return refreshPromise;
}

// ... (existing configuration)

apiClient.interceptors.request.use(
    async (config) => {
        initializeResumeTracking();

        if (isMaintenanceLocked && !config.url?.includes('/health')) {
            return Promise.reject(new Error('API calls are suspended during maintenance.'));
        }

        const customConfig = config as CustomAxiosConfig;

        if (shouldRunPreRequestRefresh(customConfig)) {
            try {
                await refreshAuthSession(true, {
                    reason: 'request_after_resume',
                    url: customConfig.url,
                    optionalUnauthenticated: false
                });
            } catch (error) {
                const refreshError = error as RefreshAxiosError;
                const refreshStatus = refreshError.response?.status;

                if (isTerminalRefreshFailure(refreshStatus)) {
                    notifySessionExpired({
                        message: refreshError.response?.data?.error,
                        refreshStatus,
                        refreshAttemptCount: refreshError.refreshAttemptCount || 1,
                        url: customConfig.url,
                        refreshReason: (refreshError.response?.data as any)?.reason || 'pre_request_resume_refresh'
                    });
                }

                return Promise.reject(refreshError);
            }
        }

        const { traceContext, headers: traceHeaders } = logger.buildRequestTraceHeaders();
        customConfig.metadata = {
            startTime: Date.now(),
            correlationId: traceContext.correlationId,
            traceId: traceContext.traceId,
            spanId: traceContext.spanId,
        };
        Object.entries(traceHeaders).forEach(([key, value]) => {
            config.headers[key] = value;
        });

        if (import.meta.env.DEV && shouldAuditCookieConsentCoverage(config.url, config.method)) {
            const normalizedPath = getNormalizedConsentRequestPath(config.url);
            logger.warn(`[API Client] Sensitive mutating route '${normalizedPath}' is not covered by cookie-consent protection`, {
                url: normalizedPath,
                method: config.method?.toUpperCase(),
                hint: 'Check CRITICAL_COOKIE_CONSENT_PATTERNS or IGNORED_AUDIT_PATTERNS in cookie-consent.ts'
            });
        }

        // Active Recovery Logic: Pause request and wait for consent if needed
        if (requiresCookieConsentForRequest(config.url, config.method) && !hasAcceptedCookieConsent()) {
            requestCookieConsentForCriticalAction(config.url);

            // Return a promise that resolves only when user provides a decision
            // This prevents the request from failing and allows it to resume automatically
            return new Promise((resolve, reject) => {
                const handleDecision = (event: any) => {
                    const { decision } = event.detail;
                    window.removeEventListener(COOKIE_CONSENT_DECIDED_EVENT, handleDecision as EventListener);

                    if (decision === 'accepted') {
                        logger.debug(`[API Client] Consent granted. Resuming paused request: ${config.url}`);
                        resolve(config);
                    } else {
                        logger.warn(`[API Client] Consent declined. Rejecting request: ${config.url}`);
                        reject(new CookieConsentRequiredError());
                    }
                };

                window.addEventListener(COOKIE_CONSENT_DECIDED_EVENT, handleDecision as EventListener);
            });
        }

        // Authentication is handled exclusively via HttpOnly cookies (withCredentials: true).
        // No manual Authorization headers are required.

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
            // PERFORMANCE: Offload telemetry to background task to keep the main thread free for UI
            setTimeout(() => {
                logAPIRequest(config.url || 'unknown', config.method?.toUpperCase() || 'UNKNOWN', customConfig.metadata, {
                    hasGuestId: !!guestId,
                    hasIdempotencyKey: !!config.headers['X-Idempotency-Key'],
                }, customConfig.silent);
                logPageAction('APIRequestStarted', {
                    method: config.method?.toUpperCase(),
                    url: config.url,
                    correlationId: traceContext.correlationId,
                    traceId: traceContext.traceId,
                    spanId: traceContext.spanId,
                });
            }, 0);
        }
        return config;
    },
    (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
    (response) => {
        const config = response.config as CustomAxiosConfig;
        const duration = config.metadata?.startTime ? Date.now() - config.metadata.startTime : 0;
        
        // PERFORMANCE: Offload response telemetry
        setTimeout(() => {
            logAPICall(config.url || 'unknown', config.method?.toUpperCase() || 'UNKNOWN', response.status, duration, config.metadata, config.silent);
        }, 0);
        
        // Notify the app that the server is reachable
        if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('app:server-online'));
        }

        sessionExpiredHandled = false;
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosConfig | undefined;

        if (originalRequest) {
            const duration = originalRequest.metadata?.startTime ? Date.now() - originalRequest.metadata.startTime : 0;
            // PERFORMANCE: Offload error telemetry
            setTimeout(() => {
                logAPICall(originalRequest.url || 'unknown', originalRequest.method?.toUpperCase() || 'UNKNOWN', error.response?.status || 0, duration, originalRequest.metadata, originalRequest?.silent);
            }, 0);
        }

        // --- SERVER OFFLINE & MAINTENANCE GUARD ---
        if (
            (error.response?.status === 503 && (error.response?.data as any)?.code === 'MAINTENANCE_MODE') ||
            error.response?.status === 502 || // Bad Gateway (Server Crash)
            isNetworkError(error)
        ) {
            const isMaintenance = error.response?.status === 503 && (error.response?.data as any)?.code === 'MAINTENANCE_MODE';
            window.dispatchEvent(new CustomEvent('app:server-offline', {
                detail: { isMaintenance }
            }));
            return Promise.reject(error);
        }

        // 401 Unauthorized -> Refresh
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
            if (isAuthEndpoint(originalRequest.url)) return Promise.reject(error);

            originalRequest._retry = true;

            try {
                await refreshAuthSession(false, {
                    reason: 'response_401',
                    url: originalRequest.url
                });
                logger.debug('[API Client] Retrying original request (Post-Refresh)');
                logFrontendAuthEvent('[API Client] Refresh succeeded, retrying original request', {
                    url: originalRequest.url
                });

                // Ensure the retry uses the latest auth state from cookies/header
                // apiClient.request(originalRequest) will trigger request interceptors again
                return apiClient.request(originalRequest);
            } catch (error: unknown) {
                const refreshError = error as RefreshAxiosError;
                const refreshStatus = refreshError.response?.status;
                const refreshAttemptCount = refreshError.refreshAttemptCount || 1;

                if (isTerminalRefreshFailure(refreshStatus)) {
                    notifySessionExpired({
                        message: refreshError.response?.data?.error,
                        refreshStatus,
                        refreshAttemptCount,
                        url: originalRequest.url,
                        refreshReason: (refreshError.response?.data as any)?.reason || 'unknown'
                    });
                } else if (!isTerminalRefreshFailure(refreshStatus)) {
                    logger.warn('[API Client] Refresh failed with non-terminal error; preserving session state', {
                        status: refreshStatus,
                        url: originalRequest.url
                    });
                    logFrontendAuthEvent('[API Client] Non-terminal refresh failure preserved session', {
                        status: refreshStatus,
                        refreshAttemptCount,
                        url: originalRequest.url,
                        reason: (refreshError.response?.data as any)?.reason || 'unknown'
                    });
                    void logger.error('[API Client] Non-terminal refresh failure after retries', {
                        component: 'APIClient',
                        action: 'auth_refresh_non_terminal_failure',
                        status: refreshStatus,
                        refreshAttemptCount,
                        url: originalRequest.url,
                        reason: (refreshError.response?.data as any)?.reason || 'unknown'
                    });
                }
                return Promise.reject(refreshError);
            }
        }


        // Log network errors with trace to find source
        if (isNetworkError(error)) {
            logger.error('[API Client] Network Error:', {
                url: error.config?.url,
                method: error.config?.method,
                message: error.message,
                stack: error.stack
            });
        }

        // Centralized error normalization using errorUtils
        error.message = getErrorMessage(error, i18n.t);

        return Promise.reject(error);
    }
);
