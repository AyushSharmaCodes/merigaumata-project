import { ApiErrorResponse } from "@/types";
import axios, { AxiosError } from "axios";
import { ErrorMessages } from "@/constants/messages/ErrorMessages";
import { TFunction } from "i18next";

// Friendly messages mapping removed in favor of direct i18n keys via ErrorMessages


/**
 * Returns a user-friendly Title for an error
 */
export function getFriendlyTitle(error: unknown, t?: TFunction, defaultTitleKey: string = ErrorMessages.AUTH_NOTICE): string {
    const apiError = getApiError(error);
    const code = apiError?.code;

    const translate = (key: string) => t ? t(key) : key;

    if (code === 'VALIDATION_ERROR') return translate(ErrorMessages.TITLE_CHECK_INFO);
    if (code === 'AUTHENTICATION_REQUIRED' || code === 'UNAUTHORIZED') return translate(ErrorMessages.TITLE_LOGIN_REQUIRED);
    if (code === 'PAYMENT_FAILED' || code === 'RAZORPAY_ERROR') return translate(ErrorMessages.TITLE_PAYMENT_UPDATE);
    if (code === 'INSUFFICIENT_STOCK') return translate(ErrorMessages.TITLE_STOCK_UPDATE);
    if (code === 'INTERNAL_ERROR') return translate(ErrorMessages.TITLE_OOPS);

    if (isNetworkError(error)) return translate(ErrorMessages.TITLE_CONNECTION_ISSUE);

    return translate(defaultTitleKey);
}

export function getApiError(error: unknown): ApiErrorResponse | undefined {
    if (axios.isAxiosError(error)) {
        return error.response?.data as ApiErrorResponse;
    }
    return undefined;
}

export function getErrorMessage(error: unknown, t?: TFunction, defaultMessageKey: string = ErrorMessages.AUTH_ERROR_OCCURRED, options?: Record<string, any>): string {
    if (typeof error === 'string') return error;

    const translate = (key: string, opts?: any) => t ? t(key, opts) : key;

    if (isNetworkError(error)) {
        return translate(ErrorMessages.SYSTEM_NETWORK_ERROR) as string;
    }

    const apiError = getApiError(error);

    // Check if we have a known error code
    const code = apiError?.code;
    if (code) {
        // Fallback mapping for specific codes if needed, but ideally backend returns keys
        if (code === 'AUTHENTICATION_REQUIRED') return translate(ErrorMessages.AUTH_LOGIN_REQUIRED) as string;
        if (code === 'UNAUTHORIZED') return translate(ErrorMessages.AUTH_SESSION_EXPIRED) as string;
        if (code === 'FORBIDDEN') return translate(ErrorMessages.AUTH_FORBIDDEN) as string;
        if (code === 'PAYMENT_FAILED') return translate(ErrorMessages.PAYMENT_FAILED) as string;
        if (code === 'RAZORPAY_ERROR') return translate(ErrorMessages.PAYMENT_GATEWAY_ERROR) as string;
        if (code === 'INSUFFICIENT_STOCK') return translate(ErrorMessages.INVENTORY_INSUFFICIENT_STOCK) as string;
        if (code === 'INTERNAL_ERROR') return translate(ErrorMessages.SYSTEM_INTERNAL_ERROR) as string;
        if (code === 'VALIDATION_ERROR') return translate(ErrorMessages.SYSTEM_VALIDATION_ERROR) as string;
    }

    // Use the error message from the API if it exists and looks like an i18n key or non-technical string
    if (apiError?.error) {
        // If it starts with 'errors.' or 'success.', it's likely a key
        if (apiError.error.startsWith('errors.') || apiError.error.startsWith('success.')) {
            return translate(apiError.error) as string;
        }

        // Simple heuristic: if it contains technical words, use default
        const technicalPatterns = [/sql/i, /database/i, /stack/i, /null/i, /undefined/i, /line \d+/i, /column/i];
        const isTechnical = technicalPatterns.some(p => p.test(apiError.error));
        if (!isTechnical) return apiError.error;
    }

    if (error instanceof Error) {
        // Don't leak raw Error messages which might have dev-centric info
        if (error.message.includes('Network Error')) return translate(ErrorMessages.SYSTEM_NETWORK_ERROR) as string;
        return translate(defaultMessageKey, options) as string;
    }

    return translate(defaultMessageKey, options) as string;
}

export function getErrorDetails(error: unknown): Array<{ path: string[]; message: string }> | undefined {
    const apiError = getApiError(error);
    // Support both 'details' (new structure) and direct 'details' from error object (legacy/Supabase)
    if (apiError?.details && Array.isArray(apiError.details)) {
        return apiError.details.map(d => ({
            path: [d.field],
            message: d.message
        }));
    }

    // Checking for raw details in the error object (e.g. from Supabase or custom errors)
    if (error && typeof error === 'object' && 'details' in error) {
        const potentialDetails = (error as any).details;
        if (Array.isArray(potentialDetails)) {
            return potentialDetails as Array<{ path: string[]; message: string }>;
        }
    }

    return undefined;
}

export function isNetworkError(error: unknown): boolean {
    if (axios.isAxiosError(error)) {
        // Network errors (like connection refused, DNS fail) usually have no response
        return !error.response && !!error.code && error.code !== 'ERR_CANCELED';
    }
    return false;
}

export function isNotFoundError(error: unknown): boolean {
    const apiError = getApiError(error);
    if (apiError?.status === 404) return true;

    if (axios.isAxiosError(error)) {
        return error.response?.status === 404;
    }
    return false;
}
