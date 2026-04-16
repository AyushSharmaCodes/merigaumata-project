import axios from "axios";
import { v4 as uuidv4 } from "uuid";

const HAS_EXPLICIT_BACKEND_URL = Boolean(import.meta.env.VITE_BACKEND_URL);
const USE_SAME_ORIGIN_API =
    import.meta.env.PROD
        ? (HAS_EXPLICIT_BACKEND_URL ? false : import.meta.env.VITE_USE_SAME_ORIGIN_API !== "false")
        : false;
const BACKEND_URL = USE_SAME_ORIGIN_API
    ? ""
    : (import.meta.env.VITE_BACKEND_URL || "").replace(/\/+$/, "");
const LOG_ENDPOINT = USE_SAME_ORIGIN_API || !BACKEND_URL
    ? "/api/logs/client-error"
    : `${BACKEND_URL}/api/logs/client-error`;
const SHOULD_LOG_TO_CONSOLE = import.meta.env.DEV;

export interface TraceContext {
    correlationId: string;
    traceId: string;
    spanId: string;
}

export interface LogMetaBase {
    component?: string;
    action?: string;
    correlationId?: string;
    traceId?: string;
    spanId?: string;
    [key: string]: unknown;
}

export type LogMeta = LogMetaBase | Error | unknown;

const loggingClient = axios.create({
    baseURL: BACKEND_URL,
    withCredentials: true,
    timeout: 5000,
});

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

    private getIds(): TraceContext {
        return {
            correlationId: this.correlationId,
            traceId: this.traceId,
            spanId: this.spanId,
        };
    }

    getTraceContext(): TraceContext {
        return this.getIds();
    }

    createRequestTraceContext(): TraceContext {
        return {
            correlationId: this.correlationId,
            traceId: uuidv4(),
            spanId: this.generateSpanId(),
        };
    }

    buildRequestTraceHeaders() {
        const traceContext = this.createRequestTraceContext();
        return {
            traceContext,
            headers: {
                'X-Correlation-ID': traceContext.correlationId,
                'X-Trace-ID': traceContext.traceId,
                'X-Span-ID': traceContext.spanId,
            },
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
            // Use dedicated logging client to avoid recursion with the main apiClient interceptors
            await loggingClient.post("/api/logs/client-error", logData);
        } catch (error) {
            if (SHOULD_LOG_TO_CONSOLE) {
                console.warn("[FrontendLogger] Failed to ship log to backend", error);
            }
        }
    }

    private writeToConsole(level: string, message: string, meta: LogMeta = {}) {
        if (!SHOULD_LOG_TO_CONSOLE) return;

        const payload = this.formatMessage(level, message, meta);
        const consoleMethod =
            level === "ERROR" ? console.error :
                level === "WARN" ? console.warn :
                    level === "INFO" ? console.info :
                        console.debug;

        consoleMethod(message, payload);
    }

    debug(message: string, meta: LogMeta = {}) {
        this.writeToConsole("DEBUG", message, meta);
    }

    info(message: string, meta: LogMeta = {}) {
        this.writeToConsole("INFO", message, meta);
    }

    warn(message: string, meta: LogMeta = {}) {
        const logData = this.formatMessage("WARN", message, meta);
        this.writeToConsole("WARN", message, meta);
        void this.sendToBackend(logData);
    }

    async error(message: string, meta: LogMeta = {}) {
        const logData = this.formatMessage("ERROR", message, meta);
        this.writeToConsole("ERROR", message, meta);
        await this.sendToBackend(logData);
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
    logger.info(`Page Action: ${actionName}`, {
        action: actionName,
        ...meta
    });
};

export const logAPIRequest = (
    url: string,
    method: string,
    traceContext?: Partial<TraceContext>,
    meta: Record<string, unknown> = {},
    silent?: boolean
) => {
    if (silent) return;

    logger.info(`API Request: ${method} ${url}`, {
        action: "api_request_start",
        url,
        method,
        correlationId: traceContext?.correlationId,
        traceId: traceContext?.traceId,
        spanId: traceContext?.spanId,
        ...meta
    });
};

// Legacy compatibility for any existing logAPICall
export const logAPICall = (
    url: string,
    method: string,
    status: number,
    duration: number,
    traceContext?: Partial<TraceContext>,
    silent?: boolean
) => {
    if (silent) return;

    const payload = {
        action: status >= 400 ? "api_request_failure" : "api_request_success",
        status,
        durationMs: duration,
        correlationId: traceContext?.correlationId,
        traceId: traceContext?.traceId,
        spanId: traceContext?.spanId,
    };

    if (status >= 500) {
        void logger.error(`API Call Failed: ${method} ${url}`, payload);
        return;
    }

    if (status >= 400) {
        logger.warn(`API Call Warning: ${method} ${url}`, payload);
        return;
    }

    logger.info(`API Call Succeeded: ${method} ${url}`, payload);
};

export const logFrontendAuthEvent = (message: string, meta: Record<string, unknown> = {}) => {
    logger.info(message, {
        component: "Auth",
        action: "auth_flow_event",
        ...meta
    });
};
