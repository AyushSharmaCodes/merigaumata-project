import { CONFIG } from "@/app/config";
import { logger } from "@/core/observability/logger";

export type RealtimeEnvelope<T = unknown> = {
  topic: string;
  type: string;
  payload: T;
  sentAt: string;
};

type RealtimeListener = {
  id: number;
  topics: Set<string>;
  handler: (event: RealtimeEnvelope) => void;
};

class RealtimeClient {
  private source: EventSource | null = null;
  private listeners = new Map<number, RealtimeListener>();
  private listenerId = 0;
  private activeTopics = "";
  private reconnectTimer: ReturnType<typeof window.setTimeout> | null = null;
  private consecutiveErrors = 0;
  private firstErrorAt = 0;
  private disabledUntil = 0;

  private static readonly ERROR_WINDOW_MS = 20_000;
  private static readonly MAX_CONSECUTIVE_ERRORS = 3;
  private static readonly DISABLE_DURATION_MS = 5 * 60_000;
  private static readonly RECONNECT_DELAY_MS = 10_000;

  subscribe(topics: string[], handler: (event: RealtimeEnvelope) => void): () => void {
    const normalizedTopics = [...new Set(topics.filter(Boolean))];
    const id = ++this.listenerId;

    this.listeners.set(id, {
      id,
      topics: new Set(normalizedTopics),
      handler,
    });

    this.ensureConnection();

    return () => {
      this.listeners.delete(id);
      this.ensureConnection();
    };
  }

  private ensureConnection() {
    if (typeof window === "undefined") {
      return;
    }

    const topics = this.getUnionTopics();
    const nextTopicsKey = topics.join(",");

    if (!topics.length) {
      this.disconnect();
      return;
    }

    if (this.disabledUntil > Date.now()) {
      return;
    }

    if (this.source && this.activeTopics === nextTopicsKey) {
      return;
    }

    this.disconnect();

    const url = `${CONFIG.API_BASE_URL}/realtime/stream?topics=${encodeURIComponent(nextTopicsKey)}`;
    const source = new EventSource(url, { withCredentials: true });

    source.onopen = () => {
      this.resetErrorState();
      logger.debug("[Realtime] Stream opened", { topics: nextTopicsKey });
    };

    source.addEventListener("realtime-event", (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as RealtimeEnvelope;
        this.dispatch(payload);
      } catch (error) {
        logger.warn("[Realtime] Failed to parse SSE payload", { error });
      }
    });

    source.addEventListener("connected", () => {
      this.resetErrorState();
      logger.debug("[Realtime] Connected", { topics: nextTopicsKey });
    });

    source.onerror = () => {
      this.registerError(nextTopicsKey);
    };

    this.source = source;
    this.activeTopics = nextTopicsKey;
  }

  private registerError(topics: string) {
    const now = Date.now();

    if (!this.firstErrorAt || now - this.firstErrorAt > RealtimeClient.ERROR_WINDOW_MS) {
      this.firstErrorAt = now;
      this.consecutiveErrors = 0;
    }

    this.consecutiveErrors += 1;

    logger.warn("[Realtime] Stream error", {
      topics,
      consecutiveErrors: this.consecutiveErrors,
    });

    this.disconnect();

    if (this.consecutiveErrors >= RealtimeClient.MAX_CONSECUTIVE_ERRORS) {
      this.disabledUntil = now + RealtimeClient.DISABLE_DURATION_MS;
      logger.warn("[Realtime] Stream temporarily disabled after repeated failures", {
        topics,
        disabledUntil: new Date(this.disabledUntil).toISOString(),
      });
      return;
    }

    this.scheduleReconnect();
  }

  private scheduleReconnect() {
    if (typeof window === "undefined" || this.reconnectTimer) {
      return;
    }

    this.reconnectTimer = window.setTimeout(() => {
      this.reconnectTimer = null;
      this.ensureConnection();
    }, RealtimeClient.RECONNECT_DELAY_MS);
  }

  private resetErrorState() {
    this.consecutiveErrors = 0;
    this.firstErrorAt = 0;
    this.disabledUntil = 0;

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private getUnionTopics(): string[] {
    const topics = new Set<string>();

    for (const listener of this.listeners.values()) {
      listener.topics.forEach((topic) => topics.add(topic));
    }

    return [...topics].sort();
  }

  private dispatch(event: RealtimeEnvelope) {
    for (const listener of this.listeners.values()) {
      if (listener.topics.has(event.topic)) {
        listener.handler(event);
      }
    }
  }

  private disconnect() {
    if (this.source) {
      this.source.close();
      this.source = null;
    }

    if (this.reconnectTimer) {
      window.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.activeTopics = "";
  }
}

const realtimeClient = new RealtimeClient();

export function subscribeToRealtime(topics: string[], handler: (event: RealtimeEnvelope) => void): () => void {
  return realtimeClient.subscribe(topics, handler);
}
