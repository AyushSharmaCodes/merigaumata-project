import { apiClient } from "@/lib/api-client";

export interface NewsletterSubscriber {
    id: string;
    email: string;
    name?: string;
    is_active: boolean;
    subscribed_at: string;
    unsubscribed_at?: string;
    created_at: string;
    updated_at: string;
}

export interface NewsletterConfig {
    id?: string;
    sender_name: string;
    sender_email: string;
    footer_text?: string;
    created_at?: string;
    updated_at?: string;
}

export interface NewsletterStats {
    total: number;
    active: number;
    inactive: number;
}

export const newsletterService = {
    // Subscribers
    getAllSubscribers: async (active?: boolean): Promise<NewsletterSubscriber[]> => {
        const params = active !== undefined ? { active: active.toString() } : {};
        const response = await apiClient.get("/newsletter/subscribers", { params });
        return response.data;
    },

    createSubscriber: async (data: { email: string; name?: string }): Promise<NewsletterSubscriber> => {
        const response = await apiClient.post("/newsletter/subscribers", data);
        return response.data;
    },

    updateSubscriber: async (id: string, data: Partial<Omit<NewsletterSubscriber, "id">>): Promise<NewsletterSubscriber> => {
        const response = await apiClient.put(`/newsletter/subscribers/${id}`, data);
        return response.data;
    },

    deleteSubscriber: async (id: string): Promise<void> => {
        await apiClient.delete(`/newsletter/subscribers/${id}`);
    },

    getStats: async (): Promise<NewsletterStats> => {
        const response = await apiClient.get("/newsletter/subscribers/stats");
        return response.data;
    },

    // Configuration
    getConfig: async (): Promise<NewsletterConfig> => {
        const response = await apiClient.get("/newsletter/config");
        return response.data;
    },

    updateConfig: async (data: Partial<NewsletterConfig>): Promise<NewsletterConfig> => {
        const response = await apiClient.put("/newsletter/config", data);
        return response.data;
    },
};
