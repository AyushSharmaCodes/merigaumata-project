/**
const logger = require('../utils/logger');
 * Supabase wrapper with New Relic instrumentation for query logging and tracing.
 * Provides automatic performance monitoring for database operations.
 */
const { createClient } = require('@supabase/supabase-js');
const newrelic = require('newrelic');
const Logger = require('../utils/NewRelicLogger');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    logger.warn('Supabase URL or Service Role Key is missing in backend environment.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

/**
 * Supabase Logger wrapper for instrumented database operations
 */
class SupabaseLogger {
    /**
     * Execute a Supabase query with New Relic segment tracking
     * @param {string} operation - Description of the operation (e.g., 'SELECT from users')
     * @param {Function} callback - Async function that performs the Supabase query
     */
    static async query(operation, callback) {
        const startTime = Date.now();
        const segmentName = `Database/Supabase/${operation}`;

        try {
            const result = await newrelic.startSegment(segmentName, true, callback);
            const duration = Date.now() - startTime;

            Logger.info(`Supabase query completed: ${operation}`, {
                operation,
                duration: `${duration}ms`,
                success: !result.error,
                recordEvent: false // Don't create separate event for every query
            });

            Logger.recordMetric(`Custom/Supabase/${operation.split(' ')[0]}/Duration`, duration);

            if (result.error) {
                Logger.warn(`Supabase query returned error: ${operation}`, {
                    operation,
                    duration: `${duration}ms`,
                    errorCode: result.error.code,
                    errorMessage: result.error.message
                });
            }

            return result;
        } catch (error) {
            const duration = Date.now() - startTime;

            Logger.error(`Supabase query failed: ${operation}`, error, {
                operation,
                duration: `${duration}ms`
            });

            throw error;
        }
    }

    /**
     * Select query with logging
     * @param {string} table - Table name
     * @param {object} options - Query options { select, filter, order, limit }
     */
    static async select(table, options = {}) {
        return this.query(`SELECT from ${table}`, async () => {
            let builder = supabase.from(table).select(options.select || '*');

            if (options.filter) {
                Object.entries(options.filter).forEach(([key, value]) => {
                    builder = builder.eq(key, value);
                });
            }

            if (options.order) {
                builder = builder.order(options.order.column, { ascending: options.order.ascending ?? true });
            }

            if (options.limit) {
                builder = builder.limit(options.limit);
            }

            return await builder;
        });
    }

    /**
     * Insert query with logging
     * @param {string} table - Table name
     * @param {object|object[]} data - Data to insert
     * @param {object} options - Insert options { returning }
     */
    static async insert(table, data, options = {}) {
        return this.query(`INSERT into ${table}`, async () => {
            let builder = supabase.from(table).insert(data);

            if (options.returning !== false) {
                builder = builder.select();
            }

            return await builder;
        });
    }

    /**
     * Update query with logging
     * @param {string} table - Table name
     * @param {string|number} id - Record ID
     * @param {object} data - Data to update
     * @param {string} idColumn - ID column name (default: 'id')
     */
    static async update(table, id, data, idColumn = 'id') {
        return this.query(`UPDATE ${table}`, async () => {
            return await supabase
                .from(table)
                .update(data)
                .eq(idColumn, id)
                .select();
        });
    }

    /**
     * Delete query with logging
     * @param {string} table - Table name
     * @param {string|number} id - Record ID
     * @param {string} idColumn - ID column name (default: 'id')
     */
    static async delete(table, id, idColumn = 'id') {
        return this.query(`DELETE from ${table}`, async () => {
            return await supabase
                .from(table)
                .delete()
                .eq(idColumn, id);
        });
    }

    /**
     * RPC call with logging
     * @param {string} functionName - Postgres function name
     * @param {object} params - Function parameters
     */
    static async rpc(functionName, params = {}) {
        return this.query(`RPC ${functionName}`, async () => {
            return await supabase.rpc(functionName, params);
        });
    }

    /**
     * Get the raw Supabase client for advanced queries
     * Note: Queries using the raw client won't be automatically logged
     */
    static get client() {
        return supabase;
    }
    /**
     * Verify connection to Supabase
     * @returns {Promise<boolean>}
     */
    static async checkConnection() {
        // Try a lightweight query to verify connectivity
        // Using 'contact_info' as it should exist and be accessible
        const { error } = await supabase
            .from('contact_info')
            .select('id')
            .limit(1);

        if (error) {
            throw new Error(`Supabase connection check failed: ${error.message}`);
        }
        return true;
    }
}

module.exports = { supabase, SupabaseLogger };
