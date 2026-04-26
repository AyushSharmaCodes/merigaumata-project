import { apiClient } from "@/core/api/api-client";
import type {
  BuyNowCheckoutInput,
  BuyNowCheckoutPaymentVerificationRequest,
  CheckoutPaymentOrderRequest,
  CheckoutPaymentVerificationRequest,
  CheckoutStockValidationResponse,
  CheckoutSummary,
  Order,
  RazorpayOrderResponse,
} from "../model/order.types";

export const checkoutApi = {
  getSummary: async (addressId?: string): Promise<CheckoutSummary> => {
    const url = addressId ? `/checkout/summary?addressId=${addressId}` : "/checkout/summary";
    const response = await apiClient.get<CheckoutSummary>(url);
    return response.data;
  },

  validateStock: async (): Promise<CheckoutStockValidationResponse> => {
    const response = await apiClient.get<CheckoutStockValidationResponse>("/checkout/validate-stock");
    return response.data;
  },

  createPaymentOrder: async (payload: CheckoutPaymentOrderRequest): Promise<RazorpayOrderResponse> => {
    const response = await apiClient.post<RazorpayOrderResponse>("/checkout/create-payment-order", payload);
    return response.data;
  },

  verifyPayment: async (
    payload: CheckoutPaymentVerificationRequest
  ): Promise<{ success: boolean; order: Order }> => {
    const response = await apiClient.post<{ success: boolean; order: Order }>("/checkout/verify-payment", payload);
    return response.data;
  },

  getSummaryForBuyNow: async (
    payload: BuyNowCheckoutInput
  ): Promise<CheckoutSummary & { isBuyNow: true }> => {
    const response = await apiClient.post<CheckoutSummary & { isBuyNow: true }>("/checkout/buy-now/summary", payload);
    return response.data;
  },

  validateStockForBuyNow: async (payload: BuyNowCheckoutInput): Promise<CheckoutStockValidationResponse> => {
    const response = await apiClient.post<CheckoutStockValidationResponse>("/checkout/buy-now/validate-stock", payload);
    return response.data;
  },

  createPaymentOrderForBuyNow: async (
    payload: BuyNowCheckoutInput
  ): Promise<RazorpayOrderResponse & { isBuyNow: true; buyNowData: BuyNowCheckoutInput }> => {
    const response = await apiClient.post<RazorpayOrderResponse & { isBuyNow: true; buyNowData: BuyNowCheckoutInput }>(
      "/checkout/buy-now/create-payment-order",
      payload
    );
    return response.data;
  },

  verifyPaymentForBuyNow: async (
    payload: BuyNowCheckoutPaymentVerificationRequest
  ): Promise<{ success: boolean; order: Order }> => {
    const response = await apiClient.post<{ success: boolean; order: Order }>(
      "/checkout/buy-now/verify-payment",
      payload
    );
    return response.data;
  },
};
