import { apiClient } from "@/core/api/api-client";
import { logger } from "@/core/observability/logger";
import { uploadService } from "@/core/upload/upload-client";
import type { Order, ReturnRequest, ReturnableItem } from "@/shared/types";
import type { CreateReturnRequestResponse, SubmitReturnInput, UserOrderDetailOrder } from "../model/user-order-detail.types";
import { buildReturnRequestPayload } from "./order-utils.service";

export const orderService = {
    // --- User Order Methods ---
    
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
        return data ?? null;
    },

    // Get single order with full details
    getOrderDetail: async (orderId: string): Promise<UserOrderDetailOrder> => {
        const response = await apiClient.get<UserOrderDetailOrder>(`/orders/${orderId}`);
        return response.data;
    },

    // Get basic order details
    getOrderById: async (id: string) => {
        const { data } = await apiClient.get<Order>(`/orders/${id}`);
        return data ?? null;
    },

    // Cancel order (User initiated)
    cancelOrder: async (id: string, reason: string, comments?: string) => {
        const { data } = await apiClient.post(`/orders/${id}/cancel`, {
            reason,
            comments,
        });
        return data;
    },

    // --- Return Management ---

    getOrderReturns: async (orderId: string): Promise<ReturnRequest[]> => {
        const response = await apiClient.get<ReturnRequest[]>(`/returns/orders/${orderId}/all`);
        return response.data;
    },

    getReturnableItems: async (orderId: string): Promise<ReturnableItem[]> => {
        const response = await apiClient.get<ReturnableItem[]>(`/returns/orders/${orderId}/items`);
        return response.data;
    },

    getReturnDetail: async (returnId: string): Promise<ReturnRequest> => {
        const response = await apiClient.get<ReturnRequest>(`/returns/${returnId}`);
        return response.data;
    },

    cancelReturn: async (returnId: string) => {
        const response = await apiClient.post(`/returns/${returnId}/cancel`);
        return response.data;
    },

    deleteUploadedImages: async (urls: string[]) => {
        await Promise.allSettled(urls.map((url) => uploadService.deleteImageByUrl(url)));
    },

    submitReturnRequest: async (orderId: string, input: SubmitReturnInput): Promise<CreateReturnRequestResponse> => {
        const uploadedImageUrls: string[] = [];

        try {
            for (const file of input.images) {
                const folder = `${orderId}/return-proofs`;
                const uploadResponse = await uploadService.uploadImage(file, "return", folder);
                uploadedImageUrls.push(uploadResponse.url);
            }

            const payload = buildReturnRequestPayload(orderId, input, uploadedImageUrls);
            const response = await apiClient.post<CreateReturnRequestResponse>("/returns/request", payload);
            return response.data;
        } catch (error) {
            if (uploadedImageUrls.length > 0) {
                logger.warn("Return request failed, cleaning up uploaded images", {
                    orderId,
                    uploadedCount: uploadedImageUrls.length,
                });
                await orderService.deleteUploadedImages(uploadedImageUrls);
            }

            throw error;
        }
    },

    // --- Admin/Manager Order Methods ---

    // Get all orders
    getAll: async (params?: {
        page?: number;
        limit?: number;
        userId?: string;
        all?: string;
        status?: string;
        payment_status?: string;
        orderNumber?: string;
        startDate?: string;
        endDate?: string;
        shallow?: string;
    }) => {
        const { data } = await apiClient.get<{ data: Order[]; meta: { total: number; pages: number; totalPages: number }; success: boolean }>("/orders", { params });
        return data ?? null;
    },

    // Update order status
    updateStatus: async (id: string, status: string, notes?: string) => {
        const { data } = await apiClient.put(`/orders/${id}/status`, { status, notes });
        return data;
    },

    // Update return request status
    updateReturnRequestStatus: async (id: string, action: string, notes?: string) => {
        if (action === 'approve') {
            const { data } = await apiClient.post(`/returns/${id}/approve`, { notes });
            return data;
        } else if (action === 'reject') {
            const { data } = await apiClient.post(`/returns/${id}/reject`, { reason: notes || "Rejected by admin" });
            return data;
        } else {
            const { data } = await apiClient.put(`/returns/${id}/status`, { status: action, notes });
            return data;
        }
    },

    // Submit QC result for a return item
    submitQCResult: async (returnItemId: string, qcData: any) => {
        const { data } = await apiClient.post(`/returns/items/${returnItemId}/qc`, qcData);
        return data;
    },

    // Delete order
    deleteOrder: async (id: string) => {
        const { data } = await apiClient.delete(`/orders/${id}`);
        return data;
    },

    // Get invoice download token
    getInvoiceDownloadToken: async (invoiceId: string) => {
        const { data } = await apiClient.get<{ token: string; expiresInSeconds: number }>(`/invoices/${invoiceId}/download-token`);
        return data;
    },

    // Regenerate invoice
    regenerateInvoice: async (orderId: string) => {
        const { data } = await apiClient.post(`/invoices/orders/${orderId}/retry`);
        return data;
    },
};

// Alias for backward compatibility if needed within the feature
export const ordersApi = orderService;
