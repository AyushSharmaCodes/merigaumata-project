import { apiClient } from '@/core/api/api-client';
import type { Order, ReturnRequest } from '../model/order.types';

export const orderApi = {
    // Orders
    getOrders: async (params?: any) => {
        const response = await apiClient.get('/orders', { params });
        return response.data;
    },

    getOrder: async (id: string) => {
        const response = await apiClient.get<Order>(`/orders/${id}`);
        return response.data;
    },

    updateStatus: async (id: string, status: string, notes?: string) => {
        const response = await apiClient.put(`/orders/${id}/status`, { status, notes });
        return response.data;
    },

    cancelOrder: async (id: string, reason: string, comments?: string) => {
        const response = await apiClient.post(`/orders/${id}/cancel`, { reason, comments });
        return response.data;
    },

    deleteOrder: async (id: string) => {
        const response = await apiClient.delete(`/orders/${id}`);
        return response.data;
    },

    // Returns
    getReturnRequest: async (id: string) => {
        const response = await apiClient.get<ReturnRequest>(`/returns/${id}`);
        return response.data;
    },

    getActiveReturnRequest: async (orderId: string) => {
        const response = await apiClient.get(`/returns/orders/${orderId}/active`);
        return response.data;
    },

    submitReturnRequest: async (orderId: string, formData: FormData) => {
        const response = await apiClient.post(`/orders/${orderId}/return`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data;
    },

    updateReturnStatus: async (id: string, status: string, notes?: string) => {
        const response = await apiClient.put(`/returns/${id}/status`, { status, notes });
        return response.data;
    },

    approveReturn: async (id: string, notes?: string) => {
        const response = await apiClient.post(`/returns/${id}/approve`, { notes });
        return response.data;
    },

    rejectReturn: async (id: string, reason: string) => {
        const response = await apiClient.post(`/returns/${id}/reject`, { reason });
        return response.data;
    },

    // Checkout
    getSummary: async (addressId?: string) => {
        const url = addressId ? `/checkout/summary?addressId=${addressId}` : '/checkout/summary';
        const response = await apiClient.get(url);
        return response.data;
    },

    validateStock: async () => {
        const response = await apiClient.get('/checkout/validate-stock');
        return response.data;
    },

    createPaymentOrder: async (data: any) => {
        const response = await apiClient.post('/checkout/create-payment-order', data);
        return response.data;
    },

    verifyPayment: async (data: any) => {
        const response = await apiClient.post('/checkout/verify-payment', data);
        return response.data;
    },

    // Invoices
    getInvoiceDownloadToken: async (invoiceId: string) => {
        const response = await apiClient.get(`/invoices/${invoiceId}/download-token`);
        return response.data;
    },

    regenerateInvoice: async (orderId: string) => {
        const response = await apiClient.post(`/invoices/orders/${orderId}/retry`);
        return response.data;
    }
};
