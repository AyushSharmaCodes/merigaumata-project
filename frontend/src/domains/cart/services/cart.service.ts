import { cartApi } from "@/domains/cart";

// Compatibility layer for features/cart
export const cartService = {
    getCart: cartApi.getCart,
    addItem: (productId: string, quantity: number, variantId?: string) => cartApi.addItem(productId, variantId, quantity),
    updateItem: (productId: string, quantity: number, variantId?: string) => cartApi.updateQuantity(productId, variantId, quantity),
    removeItem: cartApi.removeItem,
    applyCoupon: cartApi.applyCoupon,
    removeCoupon: cartApi.removeCoupon,
    clearCart: cartApi.clearCart,
    // calculateTotals: cartApi.calculateTotals, // Not in new API yet if not used
    getDeliverySettings: async () => {
        // This is a settings call, maybe move to settings domain later
        const { apiClient } = await import("@/core/api/api-client");
        const response = await apiClient.get('/settings/delivery');
        return response.data;
    }
};
