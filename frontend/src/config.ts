/**
 * Centralized configuration for the frontend application.
 * All environment variable access and hardcoded defaults should originate here.
 */

import { logger } from "@/lib/logger";

const HAS_EXPLICIT_BACKEND_URL = Boolean(import.meta.env.VITE_BACKEND_URL);
const USE_SAME_ORIGIN_API =
    import.meta.env.PROD
        ? import.meta.env.VITE_USE_SAME_ORIGIN_API === "true" || (HAS_EXPLICIT_BACKEND_URL ? false : import.meta.env.VITE_USE_SAME_ORIGIN_API !== "false")
        : false;

// Validate required environment variables
const requiredEnvVars: Record<string, string | undefined> = {
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_TITLE: import.meta.env.VITE_APP_TITLE,
    VITE_APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    VITE_APP_KEYWORDS: import.meta.env.VITE_APP_KEYWORDS,
    VITE_APP_CANONICAL_URL: import.meta.env.VITE_APP_CANONICAL_URL,
    VITE_APP_LOGO_URL: import.meta.env.VITE_APP_LOGO_URL,
    VITE_SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
    VITE_DEFAULT_COUNTRY_CODE: import.meta.env.VITE_DEFAULT_COUNTRY_CODE,
    VITE_TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE,
    VITE_RAZORPAY_CHECKOUT_URL: import.meta.env.VITE_RAZORPAY_CHECKOUT_URL,
    VITE_APP_VERSION: import.meta.env.VITE_APP_VERSION,
};

if (!USE_SAME_ORIGIN_API) {
    requiredEnvVars.VITE_BACKEND_URL = import.meta.env.VITE_BACKEND_URL;
}

const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => value === undefined || value === null || value === "")
    .map(([key]) => key);

if (missingVars.length > 0) {
    const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}. ` +
        `Please ensure these are defined in your .env file.`;
    
    if (import.meta.env.PROD) {
        throw new Error(errorMsg);
    } else {
        logger.error(errorMsg);
    }
}

export const CONFIG = {
    USE_SAME_ORIGIN_API,
    BACKEND_URL: USE_SAME_ORIGIN_API ? "" : import.meta.env.VITE_BACKEND_URL,
    get API_BASE_URL() {
        if (USE_SAME_ORIGIN_API) {
            return "/api";
        }
        const backendUrl = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/+$/, '');
        return `${backendUrl}/api`;
    },

    // Branding & Identity
    APP_NAME: import.meta.env.VITE_APP_NAME,
    APP_TITLE: import.meta.env.VITE_APP_TITLE,
    APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    APP_KEYWORDS: import.meta.env.VITE_APP_KEYWORDS,
    APP_CANONICAL_URL: import.meta.env.VITE_APP_CANONICAL_URL,
    APP_LOGO_URL: import.meta.env.VITE_APP_LOGO_URL,
    SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
    DEFAULT_COUNTRY_CODE: import.meta.env.VITE_DEFAULT_COUNTRY_CODE,
    TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE,
    APP_VERSION: import.meta.env.VITE_APP_VERSION,

    // External Services
    RAZORPAY_CHECKOUT_URL: import.meta.env.VITE_RAZORPAY_CHECKOUT_URL,

    // Feature Flags or Constants
    DEFAULT_PAGE_SIZE: 10,
};

// Re-export constants
export const APP_NAME = CONFIG.APP_NAME;
