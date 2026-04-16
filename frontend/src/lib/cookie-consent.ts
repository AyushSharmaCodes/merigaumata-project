export const COOKIE_CONSENT_STORAGE_KEY = "cookie-consent";
export const COOKIE_CONSENT_REQUIRED_EVENT = "cookie-consent:required";
export const COOKIE_CONSENT_DECIDED_EVENT = "cookie-consent:decided";

/**
 * TIER 1: FAST PATH (O(1) SET)
 * For exact string matches that don't need regex logic.
 * These are High-Confidence Sensitive Routes.
 */
const EXACT_CRITICAL_PATHS = new Set([
  // Financial & Checkout
  "/checkout/create-payment-order",
  "/checkout/verify-payment",
  "/checkout/buy-now/create-payment-order",
  "/checkout/buy-now/verify-payment",
  "/checkout/buy-now/summary",
  "/checkout/buy-now/validate-stock",
  
  // Donations & Events
  "/donations/create-order",
  "/donations/create-subscription",
  "/donations/verify",
  "/donations/cancel-subscription",
  "/donations/pause-subscription",
  "/donations/resume-subscription",
  "/event-registrations/create-order",
  "/event-registrations/verify-payment",
  "/event-registrations/cancel",

  // Account & Identity (Critical)
  "/profile/delete-account",
  "/profile/change-password",
  "/profile/avatar",
  "/profile/send-email-verification",
  "/auth/change-password",
  "/auth/send-change-password-otp",
  "/auth/logout",
  "/account/delete/request-otp",
  "/account/delete/verify-otp",
  "/account/delete/confirm",
  "/account/delete/schedule",
  "/account/delete/cancel",
  
  // Personal Data (Addresses)
  "/addresses",

  // Ecommerce Core (Cart)
  "/cart/items",
  "/cart/apply-coupon",
  "/cart/calculate",

  // Business Entities
  "/managers",
  "/bank-details",
  "/policies/upload",
  "/products",
  "/coupons",
  "/reviews",
  
  // High-impact Actions
  "/products/export",
  "/orders/sync-refunds",
]);

/**
 * TIER 2: PATTERN PATH (REGEX)
 * For dynamic routes with IDs or complex matching.
 */
const DYNAMIC_CRITICAL_PATTERNS = [
  /^\/orders\/[^/]+(\/.*)?$/,      // Any mutation on specific order
  /^\/returns\/[^/]+(\/.*)?$/,     // Any mutation on specific return
  /^\/returns\/items\/[^/]+\/status$/,
  /^\/managers\/[^/]+(\/.*)?$/,    // manager details / permissions
  /^\/users\/[^/]+(\/.*)?$/,       // User management / blocking
  /^\/addresses\/[^/]+(\/.*)?$/,   // Specific address update
  /^\/reviews\/[^/]+(\/.*)?$/,     // Specific review actions
  /^\/comments\/[^/]+(\/.*)?$/,    // Specific comment actions
];

/**
 * PATHS TO IGNORE IN AUDIT
 * Technical, Public, or purely CMS routes that do NOT handle sensitive PII.
 * These are considered "Strictly Necessary" or non-tracking.
 */
const IGNORED_AUDIT_PATTERNS = [
  /^\/invoices\/orders\/[^/]+\/retry$/,
  /^\/api\/invoices\/orders\/[^/]+\/retry$/,
  /^\/auth\/(login|register|refresh|me|sync|verify-login-otp|validate-credentials|verify-email|logout)$/,
  /^\/blogs(\/.*)?$/,
  /^\/events(\/.*)?$/,
  /^\/categories(\/.*)?$/,
  /^\/faqs(\/.*)?$/,
  /^\/social-media(\/.*)?$/,
  /^\/testimonials(\/.*)?$/,
  /^\/about(\/.*)?$/,
  /^\/carousel-slides(\/.*)?$/,
  /^\/contact-info(\/.*)?$/,
  /^\/cron\/.*$/,
  /^\/admin\/jobs\/.*$/,
  /^\/translate$/,
  /^\/api\/logs\/client-error$/,
  /^\/logs\/client-error$/,
  /^\/health$/,
  /^\/contact$/,
];

/**
 * SENSITIVE KEYWORDS (AUDIT HINTS)
 * Triggers a dev-mode warning if a mutating route matches one of these but isn't classified.
 * Broadened to capture 100% of mutations.
 */
const SENSITIVE_PATH_HINTS = [
  "checkout", "payment", "donation", "event", "order", "return", 
  "account", "subscription", "profile", "password", "inventory", 
  "stock", "manager", "user", "bank", "cart", "address", "review", 
  "comment", "upload", "policy", "coupon", "product", "manager",
  "auth", "avatar", "verify", "identity",
];

export class CookieConsentRequiredError extends Error {
  code = "COOKIE_CONSENT_REQUIRED";

  constructor(message = "errors.system.cookieConsentRequired") {
    super(message);
    this.name = "CookieConsentRequiredError";
  }
}

export function getCookieConsentDecision(): string | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Updates the cookie consent decision and dispatches a global event 
 * to handle seamless recovery of paused API requests.
 */
export function setCookieConsentDecision(value: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
    
    // Dispatch global event for the API Client request retry queue
    window.dispatchEvent(
      new CustomEvent(COOKIE_CONSENT_DECIDED_EVENT, { 
        detail: { decision: value } 
      })
    );
  } catch {
    // Best effort
  }
}

export function hasAcceptedCookieConsent(): boolean {
  return getCookieConsentDecision() === "accepted";
}

/**
 * Normalizes a URL into a clean path for pattern matching.
 * Fixes redundant slashes, prefixes, and absolute URLs.
 */
function normalizeRequestPath(url: string): string {
  let path = url.trim();

  // 1. Handle absolute URLs
  if (/^https?:\/\//i.test(path)) {
    try {
      path = new URL(path).pathname;
    } catch {
      // Fallback
    }
  }

  // 2. Strip query parameters and fragments
  path = path.split("?")[0].split("#")[0];

  // 3. INTERNAL FIX: Strip the /api or /api/v1 prefix
  path = path.replace(/^\/api(\/v\d+)?/, "");

  // 4. CLEANUP: Strip redundant leading/trailing slashes
  path = "/" + path.replace(/^\/+|\/+$/g, "");

  return path;
}

function isMutatingMethod(method?: string): boolean {
  const normalizedMethod = method?.toUpperCase();
  return (
    !!normalizedMethod &&
    ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod)
  );
}

/**
 * High-impact READ actions that should also require consent.
 */
function isSensitiveRead(path: string, method?: string): boolean {
  if (method?.toUpperCase() !== "GET") return false;
  return (
    path.endsWith("/export") || 
    path.includes("/inventory") || 
    path.includes("/stock") ||
    path.includes("/bank-details")
  );
}

export function requiresCookieConsentForRequest(
  url?: string,
  method?: string
): boolean {
  if (!url) return false;

  const path = normalizeRequestPath(url);

  // High-impact READ coverage
  if (isSensitiveRead(path, method)) {
    return true;
  }

  // standard mutation coverage
  if (!isMutatingMethod(method)) {
    return false;
  }

  // Tier 1: Fast exact match (O(1))
  if (EXACT_CRITICAL_PATHS.has(path)) {
    return true;
  }

  // Tier 2: Dynamic pattern match
  return DYNAMIC_CRITICAL_PATTERNS.some((pattern) => pattern.test(path));
}

export function shouldAuditCookieConsentCoverage(
  url?: string,
  method?: string
): boolean {
  if (!url || !isMutatingMethod(method)) {
    return false;
  }

  const path = normalizeRequestPath(url);

  if (requiresCookieConsentForRequest(path, method)) {
    return false;
  }

  if (IGNORED_AUDIT_PATTERNS.some((pattern) => pattern.test(path))) {
    return false;
  }

  const pathLower = path.toLowerCase();
  return SENSITIVE_PATH_HINTS.some((hint) => pathLower.includes(hint));
}

export function getNormalizedConsentRequestPath(url?: string): string | undefined {
  if (!url) return undefined;
  return normalizeRequestPath(url);
}

export function requestCookieConsentForCriticalAction(url?: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent(COOKIE_CONSENT_REQUIRED_EVENT, {
      detail: { url },
    })
  );
}


