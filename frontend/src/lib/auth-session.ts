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
const STORAGE_KEY = "app_auth_session";

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function persistSnapshot(snapshot: AuthSnapshot | null): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (!snapshot) {
      storage.removeItem(STORAGE_KEY);
      return;
    }

    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage failures and keep in-memory session working.
  }
}

function hydrateSnapshot(): AuthSnapshot | null {
  if (authSnapshot) return authSnapshot;

  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as AuthSnapshot | null;
    if (!parsed?.accessToken) {
      storage.removeItem(STORAGE_KEY);
      return null;
    }

    authSnapshot = parsed;
    return authSnapshot;
  } catch {
    storage.removeItem(STORAGE_KEY);
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
    persistSnapshot(null);
    return null;
  }

  authSnapshot = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: getTokenExpiry(tokens.access_token),
  };

  persistSnapshot(authSnapshot);
  return authSnapshot;
}

export function getAuthSession(): AuthSnapshot | null {
  return hydrateSnapshot();
}

export function clearAuthSession(): void {
  authSnapshot = null;
  persistSnapshot(null);
}

export function isSessionExpiringSoon(bufferMs = 60000): boolean {
  const snapshot = getAuthSession();
  if (!snapshot?.accessToken) return false;
  if (!snapshot.expiresAt) return true;
  return snapshot.expiresAt < Date.now() + bufferMs;
}
