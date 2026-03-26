export const COOKIE_CONSENT_STORAGE_KEY = "cookie-consent";
export const COOKIE_CONSENT_REQUIRED_EVENT = "cookie-consent:required";

const CRITICAL_COOKIE_CONSENT_PATTERNS = [
  /^\/checkout\/create-payment-order$/,
  /^\/checkout\/verify-payment$/,
  /^\/checkout\/buy-now\/create-payment-order$/,
  /^\/checkout\/buy-now\/verify-payment$/,
  /^\/event-registrations\/create-order$/,
  /^\/event-registrations\/verify-payment$/,
  /^\/event-registrations\/cancel$/,
  /^\/donations\/create-order$/,
  /^\/donations\/create-subscription$/,
  /^\/donations\/verify$/,
  /^\/donations\/cancel-subscription$/,
  /^\/donations\/pause-subscription$/,
  /^\/donations\/resume-subscription$/,
  /^\/profile\/delete-account$/,
  /^\/orders\/[^/]+\/cancel$/,
  /^\/orders\/[^/]+\/return$/,
  /^\/returns\/request$/,
  /^\/returns\/[^/]+\/cancel$/,
  /^\/account\/delete\/request-otp$/,
  /^\/account\/delete\/verify-otp$/,
  /^\/account\/delete\/confirm$/,
  /^\/account\/delete\/schedule$/,
  /^\/account\/delete\/cancel$/,
];

const SENSITIVE_PATH_HINTS = [
  "checkout",
  "payment",
  "donation",
  "donations",
  "event-registration",
  "event-registrations",
  "order",
  "orders",
  "return",
  "returns",
  "delete-account",
  "account/delete",
  "subscription",
  "pause-subscription",
  "resume-subscription",
  "cancel-subscription",
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

export function setCookieConsentDecision(value: "accepted" | "declined"): void {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, value);
  } catch {
    // Best effort only.
  }
}

export function hasAcceptedCookieConsent(): boolean {
  return getCookieConsentDecision() === "accepted";
}

function normalizeRequestPath(url: string): string {
  const trimmedUrl = url.trim();

  if (/^https?:\/\//i.test(trimmedUrl)) {
    try {
      return new URL(trimmedUrl).pathname;
    } catch {
      return trimmedUrl;
    }
  }

  return trimmedUrl.split("?")[0].split("#")[0];
}

function isMutatingMethod(method?: string): boolean {
  const normalizedMethod = method?.toUpperCase();
  return !!normalizedMethod && ["POST", "PUT", "PATCH", "DELETE"].includes(normalizedMethod);
}

export function requiresCookieConsentForRequest(url?: string, method?: string): boolean {
  if (!url) return false;

  if (!isMutatingMethod(method)) {
    return false;
  }

  const path = normalizeRequestPath(url);
  return CRITICAL_COOKIE_CONSENT_PATTERNS.some((pattern) => pattern.test(path));
}

export function shouldAuditCookieConsentCoverage(url?: string, method?: string): boolean {
  if (!url || !isMutatingMethod(method)) {
    return false;
  }

  const path = normalizeRequestPath(url).toLowerCase();
  if (requiresCookieConsentForRequest(path, method)) {
    return false;
  }

  return SENSITIVE_PATH_HINTS.some((hint) => path.includes(hint));
}

export function getNormalizedConsentRequestPath(url?: string): string | undefined {
  if (!url) return undefined;
  return normalizeRequestPath(url);
}

export function requestCookieConsentForCriticalAction(url?: string): void {
  if (typeof window === "undefined") return;

  window.dispatchEvent(new CustomEvent(COOKIE_CONSENT_REQUIRED_EVENT, {
    detail: { url }
  }));
}
