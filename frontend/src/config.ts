/**
 * Centralized configuration for the frontend application.
 * All environment variable access and hardcoded defaults should originate here.
 */

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
    console.warn(
        `⚠️  Missing environment variables: ${missingVars.join(', ')}. ` +
        `Using fallback values for development. Set these in .env for production.`
    );
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

    // Feature Flags or Constants
    DEFAULT_PAGE_SIZE: 10,
    SUPPORT_EMAIL: 'contact@merigaumata.com',
    DEFAULT_COUNTRY_CODE: 'IN',
};

// Re-export common constants if needed
export const APP_NAME = "Meri Gau Mata";
