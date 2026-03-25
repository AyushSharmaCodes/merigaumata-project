/**
 * Centralized configuration for the frontend application.
 * All environment variable access and hardcoded defaults should originate here.
 */

import { logger } from "@/lib/logger";

// Validate required environment variables
const requiredEnvVars = {
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    VITE_FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL,
};

const missingVars = Object.entries(requiredEnvVars)
    .filter(([_, value]) => !value)
    .map(([key]) => key);

if (missingVars.length > 0 && import.meta.env.PROD) {
    throw new Error(
        `Missing required environment variables: ${missingVars.join(', ')}. ` +
        `Please set these in your .env file.`
    );
}

// Warn in development mode
if (missingVars.length > 0 && import.meta.env.DEV) {
    logger.warn("Missing frontend environment variables; using development fallbacks", {
        missingVars,
    });
}

export const CONFIG = {
    // Backend URL: Required in production, defaults to port 5001 in development
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL || (import.meta.env.DEV ? "http://localhost:5001" : ""),

    // API URL: Defaults to backend/api
    get API_BASE_URL() { return import.meta.env.VITE_API_URL || `${this.BACKEND_URL}/api`; },

    // Frontend URL: Required in production, defaults to Vite dev port 5173 in development
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL || (import.meta.env.DEV ? "http://localhost:5173" : ""),

    // External Services
    GOOGLE_MAPS_API_KEY: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    RAZORPAY_KEY_ID: import.meta.env.VITE_RAZORPAY_KEY_ID || "",
    DEFAULT_SOCIAL_IMAGE: import.meta.env.VITE_DEFAULT_SOCIAL_IMAGE || "",
    DEFAULT_BRAND_IMAGE: import.meta.env.VITE_DEFAULT_BRAND_IMAGE || import.meta.env.VITE_DEFAULT_SOCIAL_IMAGE || "",
    APP_TITLE: import.meta.env.VITE_APP_TITLE || "MeriGauMata - Honoring the Mother, Nurturing Your Life",
    APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION || "Dedicated to the rescue, rehabilitation, and lifetime care of cows. Join our mission through donations and community engagement.",
    APP_KEYWORDS: import.meta.env.VITE_APP_KEYWORDS || "merigaumata, organic, pure, natural, cow rescue, cow welfare, gau seva, donate for cows, sustainable gau shala",
    APP_CANONICAL_URL: import.meta.env.VITE_APP_CANONICAL_URL || import.meta.env.VITE_FRONTEND_URL || "",
    TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE || "",

    // Feature Flags or Constants
    DEFAULT_PAGE_SIZE: 10,
    SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL || "",
    DEFAULT_COUNTRY_CODE: import.meta.env.VITE_DEFAULT_COUNTRY_CODE || 'IN',
};

// Re-export common constants if needed
export const APP_NAME = import.meta.env.VITE_APP_NAME || "Meri Gau Mata";
