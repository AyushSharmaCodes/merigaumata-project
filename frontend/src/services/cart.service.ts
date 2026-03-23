import { apiClient } from '@/lib/api-client';
import type { CartResponse, CartTotals, Coupon } from '@/types';

export const cartService = {
    // Get user's cart with items and totals
    getCart: async (): Promise<CartResponse> => {
        const response = await apiClient.get('/cart');
        return response.data;
    },

    // Add item to cart (with optional variant)
    addItem: async (product_id: string, quantity: number = 1, variant_id?: string): Promise<CartResponse> => {
        const response = await apiClient.post('/cart/items', { product_id, quantity, variant_id });
        return response.data;
    },

    // Update cart item quantity (with optional variant)
    updateItem: async (product_id: string, quantity: number, variant_id?: string): Promise<CartResponse> => {
        const params = variant_id ? `?variant_id=${variant_id}` : '';
        const response = await apiClient.put(`/cart/items/${product_id}${params}`, { quantity });
        return response.data;
    },

    // Remove item from cart (with optional variant)
    removeItem: async (product_id: string, variant_id?: string): Promise<CartResponse> => {
        const params = variant_id ? `?variant_id=${variant_id}` : '';
        const response = await apiClient.delete(`/cart/items/${product_id}${params}`);
        return response.data;
    },

    // Apply coupon to cart
    applyCoupon: async (code: string): Promise<CartResponse & { coupon: Coupon }> => {
        const response = await apiClient.post('/cart/apply-coupon', { code });
        return response.data;
    },

    // Remove coupon from cart
    removeCoupon: async (): Promise<CartResponse> => {
        const response = await apiClient.delete('/cart/coupon');
        return response.data;
    },

    // Calculate cart totals
    calculateTotals: async (): Promise<CartTotals> => {
        const response = await apiClient.post('/cart/calculate');
        return response.data;
    },

    // Clear cart (after order)
    clearCart: async (): Promise<void> => {
        await apiClient.delete('/cart');
    },

    // Get dynamic delivery settings
    getDeliverySettings: async (): Promise<{ delivery_threshold: number; delivery_charge: number }> => {
        const response = await apiClient.get('/settings/delivery');
        return response.data;
    },
};
