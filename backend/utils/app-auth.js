const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const APP_ACCESS_TOKEN_ISSUER = 'ecommerce-fullstack';
const APP_ACCESS_TOKEN_AUDIENCE = 'ecommerce-api';
const APP_ACCESS_TOKEN_TYPE = 'app_access';
const APP_ACCESS_TOKEN_TTL = '1h';
const APP_REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

function createAppAccessToken(payload) {
    const { sub, ...claims } = payload;

    return jwt.sign(
        {
            ...claims,
            typ: APP_ACCESS_TOKEN_TYPE
        },
        process.env.JWT_SECRET,
        {
            algorithm: 'HS256',
            issuer: APP_ACCESS_TOKEN_ISSUER,
            audience: APP_ACCESS_TOKEN_AUDIENCE,
            subject: sub,
            expiresIn: APP_ACCESS_TOKEN_TTL
        }
    );
}

function verifyAppAccessToken(token) {
    return jwt.verify(token, process.env.JWT_SECRET, {
        algorithms: ['HS256'],
        issuer: APP_ACCESS_TOKEN_ISSUER,
        audience: APP_ACCESS_TOKEN_AUDIENCE
    });
}

function isAppAccessToken(token) {
    try {
        const decoded = jwt.decode(token);
        return decoded?.typ === APP_ACCESS_TOKEN_TYPE && decoded?.iss === APP_ACCESS_TOKEN_ISSUER;
    } catch {
        return false;
    }
}

function generateOpaqueToken() {
    return crypto.randomBytes(48).toString('hex');
}

function hashOpaqueToken(token) {
    return crypto.createHash('sha256').update(String(token)).digest('hex');
}

module.exports = {
    APP_ACCESS_TOKEN_TTL,
    APP_ACCESS_TOKEN_TYPE,
    APP_ACCESS_TOKEN_ISSUER,
    APP_ACCESS_TOKEN_AUDIENCE,
    APP_REFRESH_TOKEN_TTL_MS,
    createAppAccessToken,
    verifyAppAccessToken,
    isAppAccessToken,
    generateOpaqueToken,
    hashOpaqueToken
};
