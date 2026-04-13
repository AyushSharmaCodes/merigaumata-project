import { apiClient } from '@/lib/api-client';
import type { CheckoutSummary, RazorpayOrderResponse, Order } from '@/types';
import { transformToCheckoutAddress } from './address.service';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface BuyNowData {
    productId: string;
    variantId?: string;
    quantity: number;
    couponCode?: string;
    addressId?: string;
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

    // Create Razorpay payment order via Supabase Edge Function
    createPaymentOrder: async (amount: number, userProfile: any, addressId?: string, cartItems: any[] = [], totals: any = {}): Promise<RazorpayOrderResponse> => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase.functions.invoke('checkout', {
            body: {
                items: cartItems.map(item => ({
                    product_id: item.product_id,
                    variant_id: item.variant_id,
                    quantity: item.quantity,
                    price_per_unit: item.price_per_unit || item.product_variants?.selling_price || item.products?.price || 0,
                    is_returnable: item.products?.is_returnable ?? true
                })),
                subtotal: totals.subtotal || 0,
                total_amount: amount,
                delivery_charge: totals.deliveryCharge || 0,
                delivery_gst: totals.deliveryGST || 0,
                coupon_code: totals.couponCode || null,
                coupon_discount: totals.couponDiscount || 0,
                shipping_address_id: addressId,
                billing_address_id: addressId, // Default to same for now
                notes: `Order for ${userProfile?.name || 'User'}`
            }
        });

        if (error) throw error;
        
        // Transform response to match expected RazorpayOrderResponse
        return {
            order_id: data.razorpay_order_id, // Map Razorpay Order ID to order_id
            amount: data.amount,
            currency: data.currency,
            db_order_id: data.order_id,
            payment_id: data.payment_id,
            key_id: import.meta.env.VITE_RAZORPAY_KEY_ID
        };
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

    // Create payment order for Buy Now (also uses Edge Function)
    createPaymentOrderForBuyNow: async (buyNowData: BuyNowData, userProfile: any, totals: any = {}): Promise<RazorpayOrderResponse & { isBuyNow: true; buyNowData: BuyNowData }> => {
        const supabase = getSupabaseBrowserClient();
        if (!supabase) throw new Error('Supabase client not initialized');

        const { data, error } = await supabase.functions.invoke('checkout', {
            body: {
                items: [{
                    product_id: buyNowData.productId,
                    variant_id: buyNowData.variantId,
                    quantity: buyNowData.quantity,
                    price_per_unit: totals.itemPrice || 0,
                    is_returnable: true
                }],
                subtotal: totals.subtotal || 0,
                total_amount: totals.finalAmount || 0,
                delivery_charge: totals.deliveryCharge || 0,
                delivery_gst: totals.deliveryGST || 0,
                coupon_code: buyNowData.couponCode || null,
                coupon_discount: totals.couponDiscount || 0,
                shipping_address_id: buyNowData.addressId,
                billing_address_id: buyNowData.addressId,
                notes: `Buy Now - Order for ${userProfile?.name || 'User'}`
            }
        });

        if (error) throw error;

        return {
            order_id: data.razorpay_order_id,
            amount: data.amount,
            currency: data.currency,
            db_order_id: data.order_id,
            payment_id: data.payment_id,
            key_id: import.meta.env.VITE_RAZORPAY_KEY_ID,
            isBuyNow: true,
            buyNowData
        };
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
