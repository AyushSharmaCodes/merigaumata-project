import { apiClient } from "@/lib/api-client";
import type { Address, Order, OrderItem } from "@/types";

export const orderService = {
    // Get all orders (for user)
    getMyOrders: async (params?: {
        page?: number;
        limit?: number;
        status?: string;
        payment_status?: string;
        orderNumber?: string;
        startDate?: string;
        endDate?: string;
    }) => {
        const { data } = await apiClient.get<{ data: Order[]; meta: { page: number; limit: number; total: number; totalPages: number }; success: boolean }>("/orders", { params });
        return data;
    },

    // Get all orders (Admin/Manager)
    getAll: async (params?: {
        page?: number;
        limit?: number;
        userId?: string;
        all?: string; // 'true' to get all
        status?: string;
        payment_status?: string;
        orderNumber?: string;
        startDate?: string;
        endDate?: string;
        shallow?: string; // 'true' to exclude large JSON fields like items
    }) => {
        const { data } = await apiClient.get<{ data: Order[]; meta: { total: number; pages: number; totalPages: number }; success: boolean }>("/orders", { params });
        return data;
    },

    // Get single order
    getOrderById: async (id: string) => {
        const { data } = await apiClient.get<Order>(`/orders/${id}`);
        return data;
    },

    // Admin: Update order status
    updateStatus: async (id: string, status: string, notes?: string) => {
        const { data } = await apiClient.put(`/orders/${id}/status`, { status, notes });
        return data;
    },

    // Admin: Update return request status
    updateReturnRequestStatus: async (id: string, action: 'approve' | 'reject' | 'picked_up' | 'item_returned', notes?: string) => {
        if (action === 'approve') {
            const { data } = await apiClient.post(`/returns/${id}/approve`, { notes });
            return data;
        } else if (action === 'reject') {
            const { data } = await apiClient.post(`/returns/${id}/reject`, { reason: notes || "Rejected by admin" });
            return data;
        } else {
            // picked_up, item_returned, or other status transitions
            const { data } = await apiClient.post(`/returns/${id}/status`, { status: action, notes });
            return data;
        }
    },

    // Admin: Update specific return item status
    updateReturnItemStatus: async (itemId: string, status: string) => {
        const { data } = await apiClient.put(`/returns/items/${itemId}/status`, { status });
        return data;
    },

    // Admin: Delete order
    deleteOrder: async (id: string) => {
        const { data } = await apiClient.delete(`/orders/${id}`);
        return data;
    },

    // Admin/User: Get active return request for order
    getActiveReturnRequest: async (orderId: string) => {
        const { data } = await apiClient.get(`/returns/orders/${orderId}/all`);
        if (Array.isArray(data)) {
            return data.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
        }
        return data;
    },

    // Cancel order (User initiated)
    cancelOrder: async (id: string, reason: string, comments?: string) => {
        const { data } = await apiClient.post(`/orders/${id}/cancel`, {
            reason,
            comments,
        });
        return data;
    },

    // Return order items
    returnOrder: async (id: string, returnData: FormData) => {
        const { data } = await apiClient.post(`/orders/${id}/return`, returnData, {
            headers: {
                "Content-Type": "multipart/form-data",
            },
        });
        return data;
    },

    // Get a one-time download token for an invoice
    getInvoiceDownloadToken: async (invoiceId: string) => {
        const { data } = await apiClient.get<{ token: string; expiresInSeconds: number }>(`/invoices/${invoiceId}/download-token`);
        return data;
    },

    // Admin: Regenerate invoice for an order
    regenerateInvoice: async (orderId: string) => {
        const { data } = await apiClient.post(`/invoices/orders/${orderId}/retry`);
        return data;
    },
};
