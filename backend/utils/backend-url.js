function normalizeBaseUrl(url) {
    return String(url || '').trim().replace(/\/+$/, '');
}

function getBackendBaseUrl() {
    const backendUrl = normalizeBaseUrl(process.env.BACKEND_URL);

    if (backendUrl) {
        return backendUrl;
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error('BACKEND_URL must be configured in production for public links');
    }

    const frontendUrl = normalizeBaseUrl(process.env.FRONTEND_URL);
    if (frontendUrl) {
        return frontendUrl.replace(/:5173|:3000|:4173/, ':5001');
    }

    return 'http://localhost:5001';
}

module.exports = {
    getBackendBaseUrl
};
