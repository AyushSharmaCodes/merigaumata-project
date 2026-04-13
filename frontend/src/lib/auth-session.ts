export type SessionTokens = {
  access_token?: string;
};

type AuthSnapshot = {
  accessToken?: string;
  expiresAt?: number;
};

const AUTH_SESSION_CHANGED_EVENT = "auth:session-changed";
let inMemorySession: AuthSnapshot | null = null;

let authChannel: BroadcastChannel | null = null;
if (typeof window !== "undefined" && window.BroadcastChannel) {
  authChannel = new BroadcastChannel("auth_sync_channel");
  authChannel.onmessage = (event) => {
    if (event.data === "session_changed") {
      window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
    }
  };
}

export function emitSessionChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_CHANGED_EVENT));
  if (authChannel) {
    authChannel.postMessage("session_changed");
  }
}

function hasLoggedInCookie(): boolean {
  if (typeof document === "undefined") return false;
  // The backend sets a non-HttpOnly 'logged_in=true' cookie to indicate session health
  return document.cookie.includes('logged_in=true');
}

export function setAuthSession(tokens: SessionTokens | null | undefined): AuthSnapshot | null {
  if (!tokens?.access_token) {
    inMemorySession = hasLoggedInCookie() ? {} : null;
    return getAuthSession();
  }

  const expiresAt = decodeJwtExpiry(tokens.access_token);

  inMemorySession = {
    accessToken: tokens.access_token,
    expiresAt,
  };

  // Keep the lightweight UI cookie in sync for same-tab responsiveness when the
  // backend refresh endpoint has already rotated the real HttpOnly cookies.
  if (typeof document !== "undefined") {
    document.cookie = "logged_in=true; path=/; SameSite=Lax";
  }

  return getAuthSession();
}

export function getAuthSession(): AuthSnapshot | null {
  if (hasLoggedInCookie()) {
    return inMemorySession || {};
  }
  inMemorySession = null;
  return null;
}

export function clearAuthSession(): void {
  inMemorySession = null;
  if (typeof document !== "undefined") {
    // Optimistically clear the logged_in flag locally for immediate UI response.
    // The backend /logout call will clear the secure HTTP-only cookies.
    document.cookie = "logged_in=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  }
  emitSessionChanged();
}

export function getAuthSessionChangedEventName(): string {
  return AUTH_SESSION_CHANGED_EVENT;
}

export function isSessionUnknown(): boolean {
  return hasLoggedInCookie() && !inMemorySession?.accessToken;
}

export function isSessionExpiringSoon(bufferMs = 60000): boolean {
  const expiresAt = inMemorySession?.expiresAt;
  if (!expiresAt) return false;
  return expiresAt - Date.now() <= bufferMs;
}

function decodeJwtExpiry(token?: string): number | undefined {
  if (!token) return undefined;

  try {
    const [, payload] = token.split(".");
    if (!payload) return undefined;

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(atob(normalized));
    return typeof decoded?.exp === "number" ? decoded.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}
