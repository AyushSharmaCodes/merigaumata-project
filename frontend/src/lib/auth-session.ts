type SessionTokens = {
  access_token?: string;
  refresh_token?: string;
};

type AuthSnapshot = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
};

let authSnapshot: AuthSnapshot | null = null;

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
    return null;
  }

  authSnapshot = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: getTokenExpiry(tokens.access_token),
  };

  return authSnapshot;
}

export function getAuthSession(): AuthSnapshot | null {
  return authSnapshot;
}

export function clearAuthSession(): void {
  authSnapshot = null;
}

export function isSessionExpiringSoon(bufferMs = 60000): boolean {
  if (!authSnapshot?.accessToken) return false;
  if (!authSnapshot.expiresAt) return true;
  return authSnapshot.expiresAt < Date.now() + bufferMs;
}
