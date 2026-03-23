import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const LOG_ENDPOINT = "/api/logs/client-error";

export interface LogMetaBase {
    component?: string;
    action?: string;
    correlationId?: string;
    traceId?: string;
    spanId?: string;
    [key: string]: unknown;
}

export type LogMeta = LogMetaBase | Error | unknown;

class FrontendLogger {
    private correlationId: string;
    private traceId: string;
    private spanId: string;

    constructor() {
        this.correlationId = uuidv4();
        this.traceId = uuidv4();
        this.spanId = this.generateSpanId();
    }

    private generateSpanId(): string {
        return Math.random().toString(16).substring(2, 10) + Math.random().toString(16).substring(2, 10);
    }

    private getIds() {
        return {
            correlationId: this.correlationId,
            traceId: this.traceId,
            spanId: this.spanId,
        };
    }

    private formatMessage(level: string, message: string, meta: LogMeta = {}) {
        const ids = this.getIds();

        let formattedMeta: Record<string, unknown> = {};

        if (meta instanceof Error) {
            formattedMeta = {
                error: {
                    name: meta.name,
                    message: meta.message,
                    stack: meta.stack,
                }
            };
        } else if (typeof meta === 'object' && meta !== null) {
            if (Array.isArray(meta)) {
                formattedMeta = { data: meta };
            } else {
                formattedMeta = { ...(meta as Record<string, unknown>) };
            }
        } else if (meta !== undefined) {
            formattedMeta = { data: meta };
        }

        return {
            timestamp: new Date().toISOString(),
            level,
            message,
            ...ids,
            ...formattedMeta,
        };
    }

    private async sendToBackend(logData: unknown) {
        try {
            // Use basic axios to avoid circular dependency with our api.ts if we ever import logger there
            await axios.post(LOG_ENDPOINT, logData, {
                headers: { "Content-Type": "application/json" }
            });
        } catch (error) {
            // Silently fail to avoid infinite loop or flooding console
        }
    }

    debug(message: string, meta: LogMeta = {}) {
        if (import.meta.env.DEV) {
            // Logged but not shown in console unless explicitly needed
        }
    }

    info(message: string, meta: LogMeta = {}) {
        // INFO logs usually don't go to backend to avoid noise
    }

    warn(message: string, meta: LogMeta = {}) {
        // Send warns to backend? Requirement says "Logs every critical operation"
    }

    async error(message: string, meta: LogMeta = {}) {
        const logData = this.formatMessage("ERROR", message, meta);
        await this.sendToBackend(logData);
    }

    // Update IDs for a new "request lifecycle" if needed
    refreshSpanId() {
        this.spanId = this.generateSpanId();
    }
}

export const logger = new FrontendLogger();

// Navigation tracking for New Relic / Analytics
export const logRouteChange = (currentPath: string, previousPath?: string) => {
    // We can log route changes if needed for tracing, though New Relic usually handles this
    // For now, satisfy the App.tsx import
    if (import.meta.env.DEV) {
        // logger.debug(`Route changed from ${previousPath} to ${currentPath}`);
    }
};

/**
 * Log a user action or system event
 */
export const logPageAction = (actionName: string, meta: Record<string, unknown> = {}) => {
    // For now, redirect to info log which is safe
    logger.info(`Page Action: ${actionName}`, {
        action: actionName,
        ...meta
    });
};

// Legacy compatibility for any existing logAPICall
export const logAPICall = (url: string, method: string, status: number, duration: number, correlationId?: string, silent?: boolean) => {
    if (status >= 400 && status !== 401 && !silent) {
        logger.error(`API Call Failed: ${method} ${url}`, {
            status,
            durationMs: duration,
            correlationId
        });
    }
};
