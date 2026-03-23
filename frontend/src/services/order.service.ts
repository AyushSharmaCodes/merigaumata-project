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
};
