import { apiClient } from '@/core/api/api-client';
import type { CartResponse, Coupon } from '../model/cart.types';

export const cartApi = {
    getCart: async () => {
        const response = await apiClient.get<CartResponse>('/cart');
        return response.data;
    },

    addItem: async (productId: string, variantId?: string, quantity: number = 1) => {
        const response = await apiClient.post<CartResponse>('/cart/items', {
            productId,
            variantId,
            quantity,
        });
        return response.data;
    },

    updateQuantity: async (productId: string, variantId: string | undefined, quantity: number) => {
        const response = await apiClient.put<CartResponse>('/cart/items', {
            productId,
            variantId,
            quantity,
        });
        return response.data;
    },

    removeItem: async (productId: string, variantId?: string) => {
        const response = await apiClient.delete<CartResponse>('/cart/items', {
            data: { productId, variantId },
        });
        return response.data;
    },

    clearCart: async () => {
        const response = await apiClient.delete<CartResponse>('/cart');
        return response.data;
    },

    applyCoupon: async (code: string) => {
        const response = await apiClient.post<CartResponse>('/cart/coupon', { code });
        return response.data;
    },

    removeCoupon: async () => {
        const response = await apiClient.delete<CartResponse>('/cart/coupon');
        return response.data;
    },

    getCoupons: async () => {
        const response = await apiClient.get<Coupon[]>('/coupons');
        return response.data;
    }
};
