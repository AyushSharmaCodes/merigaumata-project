const logger = require('./logger');

/**
 * Proxy wrapper for Supabase client to log database queries.
 * Intercepts 'from' and 'rpc' calls to track query execution.
 * @param {Object} client - The original Supabase client
 * @returns {Object} - The proxied Supabase client
 */
const withQueryLogging = (client) => {
    // Handler for the main client
    const clientHandler = {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);

            // Intercept 'from' (table queries)
            if (prop === 'from' && typeof value === 'function') {
                return function (...args) {
                    const table = args[0];
                    const queryBuilder = value.apply(target, args);
                    return createQueryProxy(queryBuilder, { type: 'table', name: table });
                };
            }

            // Intercept 'rpc' (function calls)
            if (prop === 'rpc' && typeof value === 'function') {
                return function (...args) {
                    const funcName = args[0];
                    const params = args[1] || {};
                    // RPC calls return a promise/builder immediately, so we proxy that
                    const rpcBuilder = value.apply(target, args);
                    // Log immediately for RPC if it's not chainable in the same way (usually it is awaiting immediately)
                    // But RPC can also key modifiers like .eq() if it returns a table set, so we treat it as a builder.
                    // However, most RPC usage is `await rpc(...)`.
                    return createQueryProxy(rpcBuilder, { type: 'rpc', name: funcName, params });
                };
            }

            return value;
        }
    };

    return new Proxy(client, clientHandler);
};

/**
 * Creates a proxy for the QueryBuilder to intercept the final execution (then/await).
 * @param {Object} builder - The Supabase QueryBuilder
 * @param {Object} context - Metadata about the query (type, name, etc.)
 * @returns {Object} - Proxied QueryBuilder
 */
const createQueryProxy = (builder, context) => {
    // We maintain a chain description to log what happened (e.g. .select().eq().limit())
    // Since the builder is immutable-ish (returns new instances), we might simply log the final state or 
    // just intercept the promise resolution.

    // Supabase v2 postgrest-js uses a "then" method to execute.

    const builderHandler = {
        get(target, prop, receiver) {
            // Intercept 'then' which triggers execution
            if (prop === 'then') {
                return async function (onFulfilled, onRejected) {
                    const startTime = Date.now();
                    const queryId = Math.random().toString(36).substring(7);

                    // Attempt to extract query details (this is rough as postgrest-js doesn't easily expose the raw URL built yet)
                    // We can at least log the context we captured.
                    const logContext = {
                        queryId,
                        target: context.name,
                        type: context.type,
                        params: context.params ? 'PRESENT (masked)' : undefined
                    };

                    // We intentionally don't log exact params for RPC params in the "Started" log 
                    // to avoid spamming, but we will rely on the global logger redaction if we did.

                    try {
                        const result = await target; // Execute the original query

                        const duration = Date.now() - startTime;

                        // Check for error in result (Supabase returns { data, error })
                        if (result.error) {
                            logger.error({
                                ...logContext,
                                duration: `${duration}ms`,
                                error: result.error
                            }, `DB Query Failed: ${context.type} ${context.name}`);
                        } else {
                            // Optionally log specific operations like INSERT/UPDATE/DELETE more prominently
                            // For SELECTs (often hidden in 'from' without method calls until the end), 
                            // strictly speaking we don't know the exact method (select/insert/update) easily 
                            // without deep diving the builder state. 
                            // But usually, standard usage is tracked. 

                            // For now, we log complection.
                            logger.info({
                                ...logContext,
                                duration: `${duration}ms`,
                                rows: Array.isArray(result.data) ? result.data.length : (result.data ? 1 : 0)
                            }, `DB Query Completed: ${context.type} ${context.name}`);
                        }

                        return onFulfilled ? onFulfilled(result) : result;
                    } catch (err) {
                        const duration = Date.now() - startTime;
                        logger.error({
                            ...logContext,
                            duration: `${duration}ms`,
                            error: err
                        }, `DB Query Exception: ${context.type} ${context.name}`);

                        if (onRejected) return onRejected(err);
                        throw err;
                    }
                };
            }

            const value = Reflect.get(target, prop, receiver);

            // If the accessed property is a function (chaining methods like .eq, .select, etc.)
            // we need to wrap its result again in a proxy to keep capturing the chain.
            if (typeof value === 'function') {
                return function (...args) {
                    const nextBuilder = value.apply(target, args);

                    // Update context if possible (e.g. if method is 'select', 'insert', etc.)
                    // postgrest-js methods return new builder instances.
                    // We can track the "method" if we want.
                    if (['select', 'insert', 'update', 'delete', 'upsert'].includes(prop)) {
                        context.method = prop;
                    }

                    return createQueryProxy(nextBuilder, context);
                };
            }

            return value;
        }
    };

    return new Proxy(builder, builderHandler);
};

module.exports = { withQueryLogging };
