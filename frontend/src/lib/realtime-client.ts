import { CONFIG } from "@/config";
import { logger } from "@/lib/logger";

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

    if (this.source && this.activeTopics === nextTopicsKey) {
      return;
    }

    this.disconnect();

    const url = `${CONFIG.API_BASE_URL}/realtime/stream?topics=${encodeURIComponent(nextTopicsKey)}`;
    const source = new EventSource(url, { withCredentials: true });

    source.addEventListener("realtime-event", (message) => {
      try {
        const payload = JSON.parse((message as MessageEvent<string>).data) as RealtimeEnvelope;
        this.dispatch(payload);
      } catch (error) {
        logger.warn("[Realtime] Failed to parse SSE payload", { error });
      }
    });

    source.addEventListener("connected", () => {
      logger.debug("[Realtime] Connected", { topics: nextTopicsKey });
    });

    source.onerror = () => {
      logger.warn("[Realtime] Stream error", { topics: nextTopicsKey });
    };

    this.source = source;
    this.activeTopics = nextTopicsKey;
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

    this.activeTopics = "";
  }
}

const realtimeClient = new RealtimeClient();

export function subscribeToRealtime(topics: string[], handler: (event: RealtimeEnvelope) => void): () => void {
  return realtimeClient.subscribe(topics, handler);
}
