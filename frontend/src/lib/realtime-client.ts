import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "@/lib/supabase-browser";
import { logger } from "@/lib/logger";

export type RealtimeEnvelope<T = unknown> = {
  topic: string;
  type: string;
  payload: T;
  sentAt: string;
};

type TopicRule = {
  schema: string;
  table: string;
  event?: "*" | "INSERT" | "UPDATE" | "DELETE";
  requiresAuth?: boolean;
};

const TOPIC_RULES: Record<string, TopicRule[]> = {
  admin_alerts: [
    { schema: "public", table: "admin_alerts", event: "*", requiresAuth: true },
  ],
  store_settings: [
    { schema: "public", table: "store_settings", event: "*", requiresAuth: false },
  ],
  products: [
    { schema: "public", table: "products", event: "*", requiresAuth: false },
    { schema: "public", table: "product_variants", event: "*", requiresAuth: false },
    { schema: "public", table: "delivery_configs", event: "*", requiresAuth: true },
  ],
  categories: [
    { schema: "public", table: "categories", event: "*", requiresAuth: false },
  ],
  blogs: [
    { schema: "public", table: "blogs", event: "*", requiresAuth: false },
  ],
  comments: [
    { schema: "public", table: "comments", event: "*", requiresAuth: false },
    { schema: "public", table: "comment_flags", event: "*", requiresAuth: true },
  ],
  reviews: [
    { schema: "public", table: "reviews", event: "*", requiresAuth: false },
    { schema: "public", table: "products", event: "*", requiresAuth: false },
  ],
  events: [
    { schema: "public", table: "events", event: "*", requiresAuth: false },
    { schema: "public", table: "event_registrations", event: "*", requiresAuth: true },
  ],
  faqs: [
    { schema: "public", table: "faqs", event: "*", requiresAuth: false },
  ],
  gallery: [
    { schema: "public", table: "gallery_folders", event: "*", requiresAuth: false },
    { schema: "public", table: "gallery_items", event: "*", requiresAuth: false },
    { schema: "public", table: "gallery_videos", event: "*", requiresAuth: false },
  ],
  carousel: [
    { schema: "public", table: "carousel_slides", event: "*", requiresAuth: false },
  ],
  contact_content: [
    { schema: "public", table: "contact_info", event: "*", requiresAuth: false },
    { schema: "public", table: "contact_phones", event: "*", requiresAuth: false },
    { schema: "public", table: "contact_emails", event: "*", requiresAuth: false },
    { schema: "public", table: "contact_office_hours", event: "*", requiresAuth: false },
    { schema: "public", table: "social_media", event: "*", requiresAuth: false },
    { schema: "public", table: "bank_details", event: "*", requiresAuth: false },
    { schema: "public", table: "newsletter_subscribers", event: "*", requiresAuth: true },
    { schema: "public", table: "newsletter_config", event: "*", requiresAuth: true },
  ],
  contact_messages: [
    { schema: "public", table: "contact_messages", event: "*", requiresAuth: true },
  ],
  about_content: [
    { schema: "public", table: "about_cards", event: "*", requiresAuth: false },
    { schema: "public", table: "about_impact_stats", event: "*", requiresAuth: false },
    { schema: "public", table: "about_timeline", event: "*", requiresAuth: false },
    { schema: "public", table: "about_team_members", event: "*", requiresAuth: false },
    { schema: "public", table: "about_future_goals", event: "*", requiresAuth: false },
    { schema: "public", table: "about_settings", event: "*", requiresAuth: false },
  ],
  policies: [
    { schema: "public", table: "policy_pages", event: "*", requiresAuth: false },
  ],
  testimonials: [
    { schema: "public", table: "testimonials", event: "*", requiresAuth: false },
  ],
  orders: [
    { schema: "public", table: "orders", event: "*", requiresAuth: true },
    { schema: "public", table: "order_items", event: "*", requiresAuth: true },
    { schema: "public", table: "payments", event: "*", requiresAuth: true },
    { schema: "public", table: "returns", event: "*", requiresAuth: true },
    { schema: "public", table: "refunds", event: "*", requiresAuth: true },
    { schema: "public", table: "invoices", event: "*", requiresAuth: true },
  ],
  donations: [
    { schema: "public", table: "donations", event: "*", requiresAuth: true },
    { schema: "public", table: "donation_subscriptions", event: "*", requiresAuth: true },
    { schema: "public", table: "payments", event: "*", requiresAuth: true },
  ],
  managers: [
    { schema: "public", table: "profiles", event: "*", requiresAuth: true },
    { schema: "public", table: "manager_permissions", event: "*", requiresAuth: true },
  ],
  deletion_jobs: [
    { schema: "public", table: "account_deletion_jobs", event: "*", requiresAuth: true },
    { schema: "public", table: "event_cancellation_jobs", event: "*", requiresAuth: true },
    { schema: "public", table: "refunds", event: "*", requiresAuth: true },
    { schema: "public", table: "email_notifications", event: "*", requiresAuth: true },
  ],
  dashboard: [
    { schema: "public", table: "donations", event: "*", requiresAuth: true },
    { schema: "public", table: "orders", event: "*", requiresAuth: true },
    { schema: "public", table: "payments", event: "*", requiresAuth: true },
    { schema: "public", table: "event_registrations", event: "*", requiresAuth: true },
    { schema: "public", table: "returns", event: "*", requiresAuth: true },
    { schema: "public", table: "events", event: "*", requiresAuth: true },
    { schema: "public", table: "products", event: "*", requiresAuth: true },
    { schema: "public", table: "blogs", event: "*", requiresAuth: true },
    { schema: "public", table: "profiles", event: "*", requiresAuth: true },
  ],
};

function buildEnvelope(
  topic: string,
  payload: RealtimePostgresChangesPayload<Record<string, unknown>>,
): RealtimeEnvelope<RealtimePostgresChangesPayload<Record<string, unknown>>> {
  return {
    topic,
    type: `${payload.table}.${payload.eventType.toLowerCase()}`,
    payload,
    sentAt: new Date().toISOString(),
  };
}

export function subscribeToRealtime(
  topics: string[],
  handler: (event: RealtimeEnvelope) => void,
): () => void {
  const client = getSupabaseBrowserClient();
  const normalizedTopics = [...new Set(topics.filter(Boolean))];

  if (!client) {
    logger.warn("[Realtime] Supabase client is not configured; realtime subscription skipped", {
      topics: normalizedTopics,
    });
    return () => undefined;
  }

  const rules = normalizedTopics.flatMap((topic) =>
    (TOPIC_RULES[topic] || []).map((rule) => ({ topic, rule })),
  );

  if (!rules.length) {
    logger.warn("[Realtime] No topic rules found for requested topics", {
      topics: normalizedTopics,
    });
    return () => undefined;
  }

  const channelName = `app-realtime:${normalizedTopics.join(",")}:${Date.now()}`;
  let channel: RealtimeChannel = client.channel(channelName);

  rules.forEach(({ topic, rule }) => {
    channel = channel.on(
      "postgres_changes",
      {
        event: rule.event || "*",
        schema: rule.schema,
        table: rule.table,
      },
      (payload) => {
        handler(buildEnvelope(topic, payload as RealtimePostgresChangesPayload<Record<string, unknown>>));
      },
    );
  });

  channel.subscribe((status) => {
    logger.debug("[Realtime] Subscription status changed", {
      channelName,
      status,
      topics: normalizedTopics,
    });
  });

  return () => {
    void client.removeChannel(channel).catch((error) => {
      logger.warn("[Realtime] Failed to clean up realtime channel", {
        channelName,
        error,
      });
    });
  };
}
