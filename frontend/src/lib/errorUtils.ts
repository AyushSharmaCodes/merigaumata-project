import { ApiErrorResponse } from "@/types";
import axios from "axios";
import { ErrorMessages } from "@/constants/messages/ErrorMessages";
import { TFunction } from "i18next";

// Friendly messages mapping removed in favor of direct i18n keys via ErrorMessages

type ErrorTranslator = TFunction | string;

function resolveTranslationArgs(
    tOrFallback?: ErrorTranslator,
    defaultMessageKey: string = ErrorMessages.AUTH_ERROR_OCCURRED
): { t?: TFunction; fallbackKey: string } {
    if (typeof tOrFallback === "function") {
        return { t: tOrFallback, fallbackKey: defaultMessageKey };
    }

    if (typeof tOrFallback === "string" && tOrFallback.trim()) {
        return { fallbackKey: tOrFallback };
    }

    return { fallbackKey: defaultMessageKey };
}

function translateKey(t: TFunction | undefined, key: string, options?: Record<string, any>): string {
    return t ? String(t(key, options)) : key;
}


/**
 * Returns a user-friendly Title for an error
 */
export function getFriendlyTitle(error: unknown, t?: TFunction, defaultTitleKey: string = ErrorMessages.AUTH_NOTICE): string {
    const apiError = getApiError(error);
    const code = apiError?.code;

    if (code === 'VALIDATION_ERROR') return translateKey(t, ErrorMessages.TITLE_CHECK_INFO);
    if (code === 'AUTHENTICATION_REQUIRED' || code === 'UNAUTHORIZED') return translateKey(t, ErrorMessages.TITLE_LOGIN_REQUIRED);
    if (code === 'PAYMENT_FAILED' || code === 'RAZORPAY_ERROR') return translateKey(t, ErrorMessages.TITLE_PAYMENT_UPDATE);
    if (code === 'INSUFFICIENT_STOCK') return translateKey(t, ErrorMessages.TITLE_STOCK_UPDATE);
    if (code === 'INTERNAL_ERROR') return translateKey(t, ErrorMessages.TITLE_OOPS);

    if (isNetworkError(error)) return translateKey(t, ErrorMessages.TITLE_CONNECTION_ISSUE);
    if (isValidationError(error)) return translateKey(t, ErrorMessages.TITLE_CHECK_INFO);

    if (axios.isAxiosError(error)) {
        if (error.response?.status === 401 || error.response?.status === 403) {
            return translateKey(t, ErrorMessages.TITLE_LOGIN_REQUIRED);
        }
        if (error.response?.status && error.response.status >= 500) {
            return translateKey(t, ErrorMessages.TITLE_OOPS);
        }
    }

    return translateKey(t, defaultTitleKey);
}

export function getApiError(error: unknown): ApiErrorResponse | undefined {
    if (axios.isAxiosError(error)) {
        return error.response?.data as ApiErrorResponse;
    }
    return undefined;
}

export function getErrorMessage(
    error: unknown,
    tOrFallback?: ErrorTranslator,
    defaultMessageKey: string = ErrorMessages.AUTH_ERROR_OCCURRED,
    options?: Record<string, any>
): string {
    const { t, fallbackKey } = resolveTranslationArgs(tOrFallback, defaultMessageKey);
    const translate = (key: string, opts?: Record<string, any>) => translateKey(t, key, opts);
    const appendAttemptsRemaining = (message: string, attemptsRemaining?: number) => {
        if (!attemptsRemaining || attemptsRemaining < 0) return message;
        return `${message} ${attemptsRemaining} attempt${attemptsRemaining === 1 ? '' : 's'} remaining.`;
    };

    if (typeof error === 'string') {
        const isTranslationKey =
            error.startsWith('errors.') ||
            error.startsWith('success.') ||
            error.startsWith('validation.') ||
            error.startsWith('common.') ||
            error.startsWith('auth.');

        return isTranslationKey ? translate(error, options) : error;
    }

    if (isNetworkError(error)) {
        return translate(ErrorMessages.SYSTEM_NETWORK_ERROR, options);
    }

    const apiError = getApiError(error);

    // Check if we have a known error code
    const code = apiError?.code;
    if (code) {
        // Map common codes to ErrorMessages constants
        const codeMap: Record<string, string> = {
            'AUTHENTICATION_REQUIRED': ErrorMessages.AUTH_LOGIN_REQUIRED,
            'UNAUTHORIZED': ErrorMessages.AUTH_SESSION_EXPIRED,
            'FORBIDDEN': ErrorMessages.AUTH_FORBIDDEN,
            'PAYMENT_FAILED': ErrorMessages.PAYMENT_FAILED,
            'RAZORPAY_ERROR': ErrorMessages.PAYMENT_GATEWAY_ERROR,
            'INSUFFICIENT_STOCK': ErrorMessages.INVENTORY_INSUFFICIENT_STOCK,
            'INTERNAL_ERROR': ErrorMessages.SYSTEM_INTERNAL_ERROR,
            'VALIDATION_ERROR': ErrorMessages.SYSTEM_VALIDATION_ERROR,
            'ORDER_PROCESS_ERROR': 'errors.order.processError',
            'RESOURCE_NOT_FOUND': 'errors.system.notFound',
            'INVALID_PAYMENT_SIGNATURE': 'errors.payment.invalidSignature'
        };

        if (codeMap[code]) return translate(codeMap[code], options);
    }

    // Use the error message from the API if it's a known i18n key
    if (apiError?.error) {
        if (apiError.error.startsWith('errors.') || apiError.error.startsWith('success.')) {
            return appendAttemptsRemaining(
                translate(apiError.error, options),
                apiError.attemptsRemaining
            );
        }

        // Only return the message if it's non-technical and backend-sanitized
        const technicalPatterns = [
            /sql/i,
            /database/i,
            /stack/i,
            /line \d+/i,
            /column/i,
            /cannot read/i,
            /undefined/i,
            /null reference/i,
            /connection refused/i,
            /econn/i,
            /timeout/i,
            /supabase/i,
            /postgres/i,
            /unexpected token/i,
            /failed to fetch/i
        ];
        const isTechnical = technicalPatterns.some(p => p.test(apiError.error));
        
        // If it looks like a code (all caps underscores), try translating it or mapping it
        if (/^[A-Z_]+$/.test(apiError.error) && !isTechnical) {
            const translationKey = `errors.${apiError.error.toLowerCase()}`;
            const translated = translate(translationKey, options);
            return translated !== translationKey ? translated : apiError.error;
        }

        if (!isTechnical) return appendAttemptsRemaining(apiError.error, apiError.attemptsRemaining);
    }

    if (error instanceof Error) {
        const rawMessage = error.message || '';
        const isTranslationKey =
            rawMessage.startsWith('errors.') ||
            rawMessage.startsWith('success.') ||
            rawMessage.startsWith('validation.') ||
            rawMessage.startsWith('common.') ||
            rawMessage.startsWith('auth.');

        if (isTranslationKey) {
            return translate(rawMessage, options);
        }

        // Don't leak raw Error messages which might have dev-centric info
        const msg = rawMessage.toLowerCase();
        if (msg.includes('network error') || msg.includes('failed to fetch')) {
            return translate(ErrorMessages.SYSTEM_NETWORK_ERROR, options);
        }
        return translate(fallbackKey, options);
    }

    return translate(fallbackKey, options);
}

export function getErrorDetails(error: unknown): Array<{ path: string[]; message: string }> | undefined {
    const apiError = getApiError(error);
    // Support both 'details' (new structure) and direct 'details' from error object (legacy/Supabase)
    if (apiError?.details && Array.isArray(apiError.details)) {
        return apiError.details.map(d => ({
            path: "path" in d && Array.isArray((d as any).path)
                ? (d as any).path
                : [d.field],
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

export function isValidationError(error: unknown): boolean {
    const apiError = getApiError(error);
    if (apiError?.code === 'VALIDATION_ERROR') return true;
    if (apiError?.status === 400 || apiError?.status === 422) return true;

    if (axios.isAxiosError(error)) {
        return error.response?.status === 400 || error.response?.status === 422;
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
