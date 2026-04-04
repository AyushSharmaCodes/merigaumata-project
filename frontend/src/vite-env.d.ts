/// <reference types="vite/client" />

interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Razorpay: any;
}

interface ImportMetaEnv {
    readonly VITE_APP_NAME: string;
    readonly VITE_APP_TITLE: string;
    readonly VITE_APP_DESCRIPTION: string;
    readonly VITE_APP_KEYWORDS: string;
    readonly VITE_APP_CANONICAL_URL: string;
    readonly VITE_APP_LOGO_URL: string;
    readonly VITE_SUPPORT_EMAIL: string;
    readonly VITE_DEFAULT_COUNTRY_CODE: string;
    readonly VITE_TWITTER_HANDLE: string;
    readonly VITE_RAZORPAY_CHECKOUT_URL: string;
    readonly VITE_BACKEND_URL?: string;
    readonly VITE_USE_SAME_ORIGIN_API?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
