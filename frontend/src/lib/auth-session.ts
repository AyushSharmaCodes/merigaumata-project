export type SessionTokens = {
  access_token?: string;
  refresh_token?: string;
};

type AuthSnapshot = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

let authSnapshot: AuthSnapshot | null = null;
const AUTH_SESSION_STORAGE_KEY = "app_auth_session";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function persistAuthSnapshot(snapshot: AuthSnapshot | null): void {
  if (!canUseSessionStorage()) return;

  try {
    if (!snapshot) {
      window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return;
    }

    window.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures so auth flows still work with in-memory state.
  }
}

function loadPersistedAuthSnapshot(): AuthSnapshot | null {
  if (!canUseSessionStorage()) return null;

  try {
    const raw = window.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<AuthSnapshot>;
    if (!parsed?.accessToken || typeof parsed.accessToken !== "string") {
      window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      return null;
    }

    return {
      accessToken: parsed.accessToken,
      refreshToken: typeof parsed.refreshToken === "string" ? parsed.refreshToken : undefined,
      expiresAt: typeof parsed.expiresAt === "number" ? parsed.expiresAt : getTokenExpiry(parsed.accessToken),
    };
  } catch {
    try {
      window.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Ignore cleanup failures.
    }
    return null;
  }
}

function getTokenExpiry(token?: string): number | undefined {
  if (!token) return undefined;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return typeof payload.exp === "number" ? payload.exp * 1000 : undefined;
  } catch {
    return undefined;
  }
}

export function setAuthSession(tokens: SessionTokens | null | undefined): AuthSnapshot | null {
  if (!tokens?.access_token) {
    authSnapshot = null;
    persistAuthSnapshot(null);
    return null;
  }

  authSnapshot = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: getTokenExpiry(tokens.access_token),
  };
  persistAuthSnapshot(authSnapshot);

  return authSnapshot;
}

export function getAuthSession(): AuthSnapshot | null {
  if (!authSnapshot) {
    authSnapshot = loadPersistedAuthSnapshot();
  }
  return authSnapshot;
}

export function clearAuthSession(): void {
  authSnapshot = null;
  persistAuthSnapshot(null);
}

export function isSessionExpiringSoon(bufferMs = 60000): boolean {
  const snapshot = getAuthSession();
  if (!snapshot?.accessToken) return false;
  if (!snapshot.expiresAt) return true;
  return snapshot.expiresAt < Date.now() + bufferMs;
}
