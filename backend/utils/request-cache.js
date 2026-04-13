const { getContext } = require('./async-context');

function getRequestCacheStore() {
    const context = getContext();
    if (!context) return null;

    if (!context.requestCache) {
        context.requestCache = new Map();
    }

    return context.requestCache;
}

async function rememberForRequest(key, loader) {
    const store = getRequestCacheStore();
    if (!store) {
        return loader();
    }

    if (store.has(key)) {
        return store.get(key);
    }

    const pending = Promise.resolve().then(loader);
    store.set(key, pending);

    try {
        const value = await pending;
        store.set(key, value);
        return value;
    } catch (error) {
        store.delete(key);
        throw error;
    }
}

function invalidateRequestCache(key) {
    const store = getRequestCacheStore();
    if (!store) return;
    store.delete(key);
}

function invalidateRequestCacheByPrefix(prefix) {
    const store = getRequestCacheStore();
    if (!store) return;

    for (const key of store.keys()) {
        if (String(key).startsWith(prefix)) {
            store.delete(key);
        }
    }
}

module.exports = {
    getRequestCacheStore,
    rememberForRequest,
    invalidateRequestCache,
    invalidateRequestCacheByPrefix
};
