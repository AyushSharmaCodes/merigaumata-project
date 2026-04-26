import {
  checkoutApi,
  type BuyNowCheckoutInput,
  type BuyNowCheckoutPaymentVerificationRequest,
  type CheckoutPaymentOrderRequest,
  type CheckoutPaymentVerificationRequest,
  type CheckoutStockValidationResponse,
  type CheckoutSummary,
  type Order,
  type RazorpayOrderResponse,
} from "@/domains/order";
import { transformToCheckoutAddress } from "@/domains/user/services/address.service";

const normalizeCheckoutSummary = <T extends CheckoutSummary>(data: T): T => {
  if (data.shipping_address) {
    data.shipping_address = transformToCheckoutAddress(data.shipping_address);
  }

  if (data.billing_address) {
    data.billing_address = transformToCheckoutAddress(data.billing_address);
  }

  return data;
};

export const checkoutOrchestrator = {
  getSummary: async (addressId?: string): Promise<CheckoutSummary> =>
    normalizeCheckoutSummary(await checkoutApi.getSummary(addressId)),

  validateStock: (): Promise<CheckoutStockValidationResponse> => checkoutApi.validateStock(),

  createPaymentOrder: async (
    amount: number,
    userProfile: unknown,
    addressId?: string
  ): Promise<RazorpayOrderResponse> => {
    const payload: CheckoutPaymentOrderRequest = {
      amount,
      user_profile: userProfile,
      address_id: addressId,
    };

    return checkoutApi.createPaymentOrder(payload);
  },

  verifyPayment: (payload: CheckoutPaymentVerificationRequest): Promise<{ success: boolean; order: Order }> =>
    checkoutApi.verifyPayment(payload),

  getSummaryForBuyNow: async (buyNowData: BuyNowCheckoutInput): Promise<CheckoutSummary & { isBuyNow: true }> =>
    normalizeCheckoutSummary(await checkoutApi.getSummaryForBuyNow(buyNowData)),

  validateStockForBuyNow: (buyNowData: BuyNowCheckoutInput): Promise<CheckoutStockValidationResponse> =>
    checkoutApi.validateStockForBuyNow(buyNowData),

  createPaymentOrderForBuyNow: (buyNowData: BuyNowCheckoutInput) =>
    checkoutApi.createPaymentOrderForBuyNow(buyNowData),

  verifyPaymentForBuyNow: (payload: BuyNowCheckoutPaymentVerificationRequest) =>
    checkoutApi.verifyPaymentForBuyNow(payload),
};
