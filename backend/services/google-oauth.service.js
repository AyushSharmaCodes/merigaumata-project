const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const GOOGLE_AUTH_BASE_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://openidconnect.googleapis.com/v1/userinfo';
const GOOGLE_JWKS_URL = 'https://www.googleapis.com/oauth2/v3/certs';
const GOOGLE_STATE_TTL_MS = 10 * 60 * 1000;
const GOOGLE_ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

let jwksCache = {
    expiresAt: 0,
    keys: new Map()
};

function getGoogleConfig() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const frontendUrl = process.env.FRONTEND_URL;

    if (!clientId || !clientSecret || !frontendUrl) {
        const error = new Error('Google OAuth environment is not configured correctly.');
        error.status = 500;
        throw error;
    }

    return {
        clientId,
        clientSecret,
        redirectUri: process.env.GOOGLE_REDIRECT_URI || `${frontendUrl.replace(/\/$/, '')}/auth/callback`
    };
}

function toBase64Url(buffer) {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function buildCodeChallenge(codeVerifier) {
    return toBase64Url(crypto.createHash('sha256').update(codeVerifier).digest());
}

async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const text = await response.text();
    let data = {};

    if (text) {
        try {
            data = JSON.parse(text);
        } catch {
            data = { raw: text };
        }
    }

    if (!response.ok) {
        const error = new Error(data.error_description || data.error || 'Google OAuth request failed.');
        error.status = response.status;
        error.details = data;
        throw error;
    }

    return data;
}

async function loadGoogleKeys() {
    if (jwksCache.expiresAt > Date.now() && jwksCache.keys.size > 0) {
        return jwksCache.keys;
    }

    const response = await fetch(GOOGLE_JWKS_URL);
    const body = await response.json();

    if (!response.ok || !Array.isArray(body.keys)) {
        throw new Error('Failed to load Google signing keys.');
    }

    const cacheControl = response.headers.get('cache-control') || '';
    const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
    const maxAgeMs = maxAgeMatch ? Number(maxAgeMatch[1]) * 1000 : 60 * 60 * 1000;

    const keys = new Map();
    for (const jwk of body.keys) {
        if (jwk.kid) {
            keys.set(jwk.kid, jwk);
        }
    }

    jwksCache = {
        expiresAt: Date.now() + maxAgeMs,
        keys
    };

    return keys;
}

async function verifyGoogleIdToken(idToken, expectedNonce) {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded?.header?.kid) {
        const error = new Error('Google ID token is malformed.');
        error.status = 401;
        throw error;
    }

    const keys = await loadGoogleKeys();
    const jwk = keys.get(decoded.header.kid);

    if (!jwk) {
        jwksCache.expiresAt = 0;
        const refreshedKeys = await loadGoogleKeys();
        const refreshedJwk = refreshedKeys.get(decoded.header.kid);
        if (!refreshedJwk) {
            const error = new Error('Unable to verify Google identity.');
            error.status = 401;
            throw error;
        }
        return jwt.verify(idToken, crypto.createPublicKey({ key: refreshedJwk, format: 'jwk' }), {
            algorithms: ['RS256'],
            audience: getGoogleConfig().clientId,
            issuer: GOOGLE_ISSUERS
        });
    }

    const payload = jwt.verify(idToken, crypto.createPublicKey({ key: jwk, format: 'jwk' }), {
        algorithms: ['RS256'],
        audience: getGoogleConfig().clientId,
        issuer: GOOGLE_ISSUERS
    });

    if (expectedNonce && payload.nonce !== expectedNonce) {
        const error = new Error('Google OAuth nonce validation failed.');
        error.status = 401;
        throw error;
    }

    return payload;
}

class GoogleOAuthService {
    static createAuthorizationRequest() {
        const { clientId, redirectUri } = getGoogleConfig();
        const state = toBase64Url(crypto.randomBytes(32));
        const codeVerifier = toBase64Url(crypto.randomBytes(64));
        const nonce = toBase64Url(crypto.randomBytes(32));

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: 'code',
            scope: 'openid email profile',
            access_type: 'offline',
            include_granted_scopes: 'true',
            prompt: 'select_account',
            state,
            nonce,
            code_challenge: buildCodeChallenge(codeVerifier),
            code_challenge_method: 'S256'
        });

        return {
            url: `${GOOGLE_AUTH_BASE_URL}?${params.toString()}`,
            state,
            nonce,
            codeVerifier,
            expiresAt: Date.now() + GOOGLE_STATE_TTL_MS
        };
    }

    static async exchangeCode({ code, codeVerifier, expectedNonce }) {
        const { clientId, clientSecret, redirectUri } = getGoogleConfig();

        const body = new URLSearchParams({
            code,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
            grant_type: 'authorization_code',
            code_verifier: codeVerifier
        });

        const tokenData = await fetchJson(GOOGLE_TOKEN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });

        if (!tokenData.id_token || !tokenData.access_token) {
            const error = new Error('Google token exchange did not return a usable identity.');
            error.status = 401;
            throw error;
        }

        const claims = await verifyGoogleIdToken(tokenData.id_token, expectedNonce);
        const userInfo = await fetchJson(GOOGLE_USERINFO_URL, {
            headers: {
                Authorization: `Bearer ${tokenData.access_token}`
            }
        });

        if (!claims.email || userInfo.email !== claims.email) {
            const error = new Error('Google account details could not be verified.');
            error.status = 401;
            throw error;
        }

        if (claims.email_verified !== true) {
            const error = new Error('Google account email is not verified.');
            error.status = 403;
            throw error;
        }

        return {
            googleId: claims.sub,
            email: claims.email.toLowerCase(),
            emailVerified: true,
            name: userInfo.name || claims.name || claims.email,
            givenName: userInfo.given_name || claims.given_name || null,
            familyName: userInfo.family_name || claims.family_name || null,
            avatarUrl: userInfo.picture || claims.picture || null
        };
    }
}

module.exports = GoogleOAuthService;
