import { apiClient } from "@/lib/api-client";

export interface ContactFormData {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

export interface ContactResponse {
    success: boolean;
    message: string;
    data?: {
        id: string;
    };
}

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    phone: string;
    subject?: string;
    message: string;
    status: 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

export interface ContactMessagesResponse {
    messages: ContactMessage[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const contactService = {
    /**
     * Send a contact message
     */
    sendMessage: async (data: ContactFormData): Promise<ContactResponse> => {
        const response = await apiClient.post('/contact', data);
        return response.data;
    },

    /**
     * Get all contact messages (Admin)
     */
    getMessages: async (params?: { page?: number; limit?: number; search?: string; status?: ContactMessage['status'] | 'ALL' }): Promise<ContactMessagesResponse> => {
        const response = await apiClient.get('/contact', { params });
        return response.data.data;
    },

    /**
     * Get contact message by ID (Admin)
     */
    getMessageById: async (id: string): Promise<ContactMessage> => {
        const response = await apiClient.get(`/contact/${id}`);
        return response.data.data;
    },

    updateMessageStatus: async (id: string, status: ContactMessage['status']): Promise<ContactMessage> => {
        const response = await apiClient.patch(`/contact/${id}/status`, { status });
        return response.data.data;
    }
};
