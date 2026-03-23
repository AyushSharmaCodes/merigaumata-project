import { apiClient } from '@/lib/api-client';
import type { CheckoutSummary, RazorpayOrderResponse, Order } from '@/types';
import { transformToCheckoutAddress } from './address.service';

interface BuyNowData {
    productId: string;
    variantId?: string;
    quantity: number;
}

export const checkoutService = {
    // Get checkout summary (cart + addresses + totals)
    getSummary: async (addressId?: string): Promise<CheckoutSummary> => {
        const url = addressId ? `/checkout/summary?addressId=${addressId}` : '/checkout/summary';
        const response = await apiClient.get(url);
        const data = response.data;

        // Transform addresses if they exist
        if (data.shipping_address) {
            data.shipping_address = transformToCheckoutAddress(data.shipping_address);
        }
        if (data.billing_address) {
            data.billing_address = transformToCheckoutAddress(data.billing_address);
        }

        return data;
    },

    // Validate stock availability before payment
    validateStock: async (): Promise<{
        valid: boolean;
        items: Array<{
            productId: string;
            variantId: string | null;
            title: string;
            variantLabel: string | null;
            requestedQty: number;
            availableStock: number;
            image: string | null;
        }>;
    }> => {
        const response = await apiClient.get('/checkout/validate-stock');
        return response.data;
    },

    // Create Razorpay payment order
    // PHASE 3A: Now accepts user_profile to avoid duplicate fetch
    createPaymentOrder: async (amount: number, userProfile: any, addressId?: string): Promise<RazorpayOrderResponse> => {
        const response = await apiClient.post('/checkout/create-payment-order', {
            amount,
            user_profile: userProfile,
            address_id: addressId
        });
        return response.data;
    },

    // Verify payment and complete order
    verifyPayment: async (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        payment_id: string;
        shipping_address_id: string;
        billing_address_id: string;
        notes?: string;
    }): Promise<{ success: boolean; order: Order }> => {
        const response = await apiClient.post('/checkout/verify-payment', data);
        return response.data;
    },

    // =========================================
    // BUY NOW METHODS
    // =========================================

    // Get Buy Now summary (single item + addresses + totals)
    getSummaryForBuyNow: async (buyNowData: BuyNowData): Promise<CheckoutSummary & { isBuyNow: true }> => {
        const response = await apiClient.post('/checkout/buy-now/summary', buyNowData);
        const data = response.data;

        // Transform addresses if they exist
        if (data.shipping_address) {
            data.shipping_address = transformToCheckoutAddress(data.shipping_address);
        }
        if (data.billing_address) {
            data.billing_address = transformToCheckoutAddress(data.billing_address);
        }

        return data;
    },

    // Validate stock for Buy Now item
    validateStockForBuyNow: async (buyNowData: BuyNowData): Promise<{
        valid: boolean;
        items: Array<{
            productId: string;
            variantId: string | null;
            title: string;
            variantLabel: string | null;
            requestedQty: number;
            availableStock: number;
            image: string | null;
        }>;
    }> => {
        const response = await apiClient.post('/checkout/buy-now/validate-stock', buyNowData);
        return response.data;
    },

    // Create payment order for Buy Now
    createPaymentOrderForBuyNow: async (buyNowData: BuyNowData): Promise<RazorpayOrderResponse & { isBuyNow: true; buyNowData: BuyNowData }> => {
        const response = await apiClient.post('/checkout/buy-now/create-payment-order', buyNowData);
        return response.data;
    },

    // Verify payment for Buy Now order
    verifyPaymentForBuyNow: async (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        payment_id: string;
        shipping_address_id: string;
        billing_address_id: string;
        buyNowData: BuyNowData;
        notes?: string;
    }): Promise<{ success: boolean; order: Order }> => {
        const response = await apiClient.post('/checkout/buy-now/verify-payment', data);
        return response.data;
    },
};

