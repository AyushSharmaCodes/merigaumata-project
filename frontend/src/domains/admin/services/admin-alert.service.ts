import { apiClient } from "@/core/api/api-client";

export interface AdminAlert {
    id: string;
    type: string;
    reference_id: string;
    title: string;
    content: string;
    status: 'unread' | 'read' | 'archived';
    priority: 'low' | 'medium' | 'high';
    metadata: Record<string, unknown> | null;
    created_at: string;
}

export const adminAlertService = {
    getUnreadAlerts: async (): Promise<AdminAlert[]> => {
        const response = await apiClient.get('/admin/alerts');
        return response.data;
    },

    markAsRead: async (id: string): Promise<AdminAlert> => {
        const response = await apiClient.put(`/admin/alerts/${id}/read`);
        return response.data;
    },

    markAllAsRead: async (): Promise<{ count: number }> => {
        const response = await apiClient.put('/admin/alerts/read-all');
        return response.data;
    },

    markAsReadByReferenceId: async (type: string, referenceId: string): Promise<void> => {
        await apiClient.put(`/admin/alerts/by-reference/${type}/${referenceId}/read`);
    }
};
