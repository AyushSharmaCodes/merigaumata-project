/**
 * Centralized configuration for the frontend application.
 * All environment variable access and hardcoded defaults should originate here.
 */

import { logger } from "@/lib/logger";

// Validate required environment variables
const requiredEnvVars = {
    VITE_BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    VITE_FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_APP_NAME: import.meta.env.VITE_APP_NAME,
    VITE_APP_TITLE: import.meta.env.VITE_APP_TITLE,
    VITE_APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    VITE_APP_KEYWORDS: import.meta.env.VITE_APP_KEYWORDS,
    VITE_APP_CANONICAL_URL: import.meta.env.VITE_APP_CANONICAL_URL,
    VITE_APP_LOGO_URL: import.meta.env.VITE_APP_LOGO_URL,
    VITE_DEFAULT_SOCIAL_IMAGE: import.meta.env.VITE_DEFAULT_SOCIAL_IMAGE,
    VITE_DEFAULT_BRAND_IMAGE: import.meta.env.VITE_DEFAULT_BRAND_IMAGE,
    VITE_SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
    VITE_DEFAULT_COUNTRY_CODE: import.meta.env.VITE_DEFAULT_COUNTRY_CODE,
    VITE_TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE,
    VITE_RAZORPAY_CHECKOUT_URL: import.meta.env.VITE_RAZORPAY_CHECKOUT_URL,
    VITE_GOOGLE_MAPS_EMBED_URL: import.meta.env.VITE_GOOGLE_MAPS_EMBED_URL,
    VITE_GOOGLE_MAPS_SEARCH_URL: import.meta.env.VITE_GOOGLE_MAPS_SEARCH_URL,
    VITE_YOUTUBE_THUMBNAIL_URL: import.meta.env.VITE_YOUTUBE_THUMBNAIL_URL,
    VITE_YOUTUBE_EMBED_URL: import.meta.env.VITE_YOUTUBE_EMBED_URL,
};

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
    BACKEND_URL: import.meta.env.VITE_BACKEND_URL,
    get API_BASE_URL() { return import.meta.env.VITE_API_URL; },
    FRONTEND_URL: import.meta.env.VITE_FRONTEND_URL,

    // Branding & Identity
    APP_NAME: import.meta.env.VITE_APP_NAME,
    APP_TITLE: import.meta.env.VITE_APP_TITLE,
    APP_DESCRIPTION: import.meta.env.VITE_APP_DESCRIPTION,
    APP_KEYWORDS: import.meta.env.VITE_APP_KEYWORDS,
    APP_CANONICAL_URL: import.meta.env.VITE_APP_CANONICAL_URL,
    APP_LOGO_URL: import.meta.env.VITE_APP_LOGO_URL,
    DEFAULT_SOCIAL_IMAGE: import.meta.env.VITE_DEFAULT_SOCIAL_IMAGE,
    DEFAULT_BRAND_IMAGE: import.meta.env.VITE_DEFAULT_BRAND_IMAGE,
    SUPPORT_EMAIL: import.meta.env.VITE_SUPPORT_EMAIL,
    DEFAULT_COUNTRY_CODE: import.meta.env.VITE_DEFAULT_COUNTRY_CODE,
    TWITTER_HANDLE: import.meta.env.VITE_TWITTER_HANDLE,

    // External Services
    RAZORPAY_CHECKOUT_URL: import.meta.env.VITE_RAZORPAY_CHECKOUT_URL,
    GOOGLE_MAPS_EMBED_URL: import.meta.env.VITE_GOOGLE_MAPS_EMBED_URL,
    GOOGLE_MAPS_SEARCH_URL: import.meta.env.VITE_GOOGLE_MAPS_SEARCH_URL,
    YOUTUBE_THUMBNAIL_URL: import.meta.env.VITE_YOUTUBE_THUMBNAIL_URL,
    YOUTUBE_EMBED_URL: import.meta.env.VITE_YOUTUBE_EMBED_URL,

    // Feature Flags or Constants
    DEFAULT_PAGE_SIZE: 10,
};

// Re-export constants
export const APP_NAME = CONFIG.APP_NAME;
