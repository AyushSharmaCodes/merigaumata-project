import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/domains/auth";
import { useCartStore } from "@/domains/cart";
import { useUIStore } from "@/core/store/ui.store";
import { checkoutOrchestrator } from "@/application/checkout";
import { paymentOrchestrator } from "@/application/payment";
import { useToast } from "@/shared/hooks/use-toast";
import { logger } from "@/core/observability/logger";
import { couponService } from "@/domains/settings";
import type { Coupon } from "@/domains/cart";
import type { CheckoutAddress, CheckoutSummary } from "@/domains/order";
import type { Product } from "@/domains/product";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { CONFIG } from "@/app/config";
import { CheckoutMessages } from "@/shared/constants/messages/CheckoutMessages";
import { AuthMessages } from "@/shared/constants/messages/AuthMessages";
import { CartMessages } from "@/shared/constants/messages/CartMessages";
import { ProductMessages } from "@/shared/constants/messages/ProductMessages";
import { CommonMessages } from "@/shared/constants/messages/CommonMessages";
import { ValidationMessages } from "@/shared/constants/messages/ValidationMessages";
import { SystemMessages } from "@/shared/constants/messages/SystemMessages";

interface BuyNowState {
  buyNowItem?: {
    product: Product;
    quantity: number;
    variantId?: string;
  };
}

interface OrderConfirmationNavigationState {
  confirmation?: {
    orderId: string;
    orderNumber?: string;
    totalAmount?: number;
    status?: string;
    showSuccessToast?: boolean;
  };
}

const isCouponEligibleForSummary = (coupon: Coupon, summary: CheckoutSummary | null) => {
  if (!summary) return false;

  const now = new Date();
  const validFrom = new Date(coupon.valid_from);
  const validUntil = new Date(coupon.valid_until);
  const cartItems = summary.cart?.cart_items || [];
  const totalPrice = summary.totals?.totalPrice || 0;

  if (!coupon.is_active) return false;
  if (coupon.usage_limit !== undefined && coupon.usage_limit !== null && coupon.usage_count >= coupon.usage_limit) {
    return false;
  }
  if (now < validFrom || now > validUntil) return false;
  if (coupon.type !== "free_delivery" && coupon.min_purchase_amount && totalPrice < coupon.min_purchase_amount) {
    return false;
  }

  switch (coupon.type) {
    case "cart":
    case "free_delivery":
      return cartItems.length > 0;
    case "product":
      return cartItems.some((item) => item.product_id === coupon.target_id);
    case "variant":
      return cartItems.some((item) => item.variant_id === coupon.target_id);
    case "category":
      return cartItems.some((item) => item.products?.category === coupon.target_id);
    default:
      return false;
  }
};

export function useCheckoutPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const user = useAuthStore(state => state.user);
  
  const { fetchCart, removeItem } = useCartStore(useShallow(state => ({
    fetchCart: state.fetchCart,
    removeItem: state.removeItem
  })));

  const setBlocking = useUIStore(state => state.setBlocking);

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const isPaymentSuccess = useRef(false);

  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponBusy, setCouponBusy] = useState(false);

  const [isBuyNow, setIsBuyNow] = useState(false);
  const [buyNowData, setBuyNowData] = useState<{
    productId: string;
    variantId?: string;
    quantity: number;
    couponCode?: string;
    addressId?: string;
  } | null>(null);

  const [shippingAddress, setShippingAddress] = useState<CheckoutAddress | null>(null);
  const [billingAddress, setBillingAddress] = useState<CheckoutAddress | null>(null);
  const [billingSameAsShipping, setBillingSameAsShipping] = useState(true);
  const [showPhoneWarning, setShowPhoneWarning] = useState(false);
  const [addressIdToEdit, setAddressIdToEdit] = useState<string | null>(null);
  const [stockIssues, setStockIssues] = useState<any[]>([]);
  const [showStockModal, setShowStockModal] = useState(false);

  const fetchAvailableCoupons = useCallback(async () => {
    setCouponsLoading(true);
    try {
      const coupons = await couponService.getActive();
      setAvailableCoupons(coupons);
    } catch (error) {
      logger.warn("Checkout coupon fetch failed", error);
    } finally {
      setCouponsLoading(false);
    }
  }, []);

  const fetchCheckoutSummary = useCallback(async (addressId?: string) => {
    try {
      setLoading(true);
      const data = await checkoutOrchestrator.getSummary(addressId);

      if (!data.cart || !data.cart.cart_items || data.cart.cart_items.length === 0) {
        toast({
          title: t("common.info"),
          description: t(CartMessages.EMPTY),
        });
        navigate("/cart");
        return;
      }

      setSummary(data);
      fetchCart();

      if (data.shipping_address && !addressId) {
        const newShipping = data.shipping_address;
        setShippingAddress(prev => (!prev || prev.id !== newShipping.id) ? newShipping : prev);
      }
      if (data.billing_address) {
        const newBilling = data.billing_address;
        setBillingAddress(prev => (!prev || prev.id !== newBilling.id) ? newBilling : prev);
      }

    } finally {
      setLoading(false);
      useUIStore.getState().clearAllBlocking();
    }
  }, [fetchCart, navigate, t, toast]);

  const fetchBuyNowSummary = useCallback(async (
    nextBuyNowData: {
      productId: string;
      variantId?: string;
      quantity: number;
      couponCode?: string;
      addressId?: string;
    },
    addressId?: string
  ) => {
    const resolvedAddressId = addressId ?? nextBuyNowData.addressId;
    try {
      setLoading(true);
      const requestData = { ...nextBuyNowData, addressId: resolvedAddressId };
      const data = await checkoutOrchestrator.getSummaryForBuyNow(requestData);

      setSummary(data);
      setBuyNowData({ ...nextBuyNowData, addressId: resolvedAddressId });

      if (data.shipping_address) {
        setShippingAddress(prev => prev?.id === data.shipping_address?.id ? prev : (data.shipping_address || null));
      }
      if (data.billing_address) {
        setBillingAddress(prev => prev?.id === data.billing_address?.id ? prev : (data.billing_address || null));
      }
      return data;
    } catch (error) {
      logger.error(t(SystemMessages.BUY_NOW_LOG_ERROR), error);
      throw error;
    } finally {
      setLoading(false);
      useUIStore.getState().clearAllBlocking();
    }
  }, [t]);

  useEffect(() => {
    const initCheckout = async () => {
      if (!isAuthenticated) {
        toast({
          title: t("common.info"),
          description: t(AuthMessages.LOGIN_TO_CHECKOUT),
        });
        navigate("/auth?returnUrl=/checkout");
        return;
      }
      if (isBuyNow) return;

      const state = location.state as BuyNowState | undefined;
      if (state?.buyNowItem) {
        const { product, quantity, variantId } = state.buyNowItem;
        setIsBuyNow(true);
        const initialBuyNowData = { productId: product.id, variantId, quantity };
        navigate(location.pathname, { replace: true, state: {} });
        try {
          await fetchBuyNowSummary(initialBuyNowData);
          paymentOrchestrator.prefetchGateway();
        } catch (error) {
          const errorMsg = getErrorMessage(error, t, CheckoutMessages.LOAD_ERROR);
          toast({ title: t("common.error"), description: errorMsg, variant: "destructive" });
          navigate("/shop");
        }
        return;
      }
      fetchCheckoutSummary();
    };
    initCheckout();
  }, [isAuthenticated, navigate, fetchBuyNowSummary, fetchCheckoutSummary, isBuyNow, location, t, toast]);

  useEffect(() => {
    if (isAuthenticated) fetchAvailableCoupons();
  }, [fetchAvailableCoupons, isAuthenticated]);

  useEffect(() => {
    if (summary && !loading) paymentOrchestrator.prefetchGateway();
  }, [summary, loading]);

  const eligibleCoupons = useMemo(
    () => availableCoupons.filter((coupon) => isCouponEligibleForSummary(coupon, summary)),
    [availableCoupons, summary]
  );

  const handleApplyCoupon = useCallback(async (code: string) => {
    if (!isBuyNow || !summary || !buyNowData) return;
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) return;

    setCouponBusy(true);
    try {
      const addressId = shippingAddress?.id || buyNowData.addressId;
      const result = await checkoutOrchestrator.getSummaryForBuyNow({ ...buyNowData, couponCode: normalizedCode, addressId });
      
      if ((result.totals?.coupon?.code || "").toUpperCase() !== normalizedCode) {
        toast({ title: t("common.error"), description: t("errors.payment.invalidCoupon"), variant: "destructive" });
        return;
      }
      setSummary(result);
      setBuyNowData(prev => prev ? { ...prev, couponCode: normalizedCode, addressId } : null);
      toast({ title: t("common.success"), description: t("success.cart.couponApplied") });
    } finally {
      setCouponBusy(false);
    }
  }, [buyNowData, isBuyNow, shippingAddress?.id, summary, t, toast]);

  const handleRemoveCoupon = useCallback(async () => {
    if (!isBuyNow || !summary || !buyNowData) return;
    setCouponBusy(true);
    try {
      const { couponCode: _, ...remainingBuyNowData } = buyNowData;
      const addressId = shippingAddress?.id || buyNowData.addressId;
      const result = await checkoutOrchestrator.getSummaryForBuyNow({ ...remainingBuyNowData, addressId });
      setSummary(result);
      setBuyNowData({ ...remainingBuyNowData, addressId });
      toast({ title: t("common.success"), description: t("success.cart.couponRemoved") });
    } finally {
      setCouponBusy(false);
    }
  }, [buyNowData, isBuyNow, shippingAddress?.id, summary, t, toast]);

  const handleShippingAddressSelect = useCallback((address: CheckoutAddress) => {
    if (shippingAddress?.id !== address.id) {
      setShippingAddress(address);
      if (isBuyNow && buyNowData) fetchBuyNowSummary(buyNowData, address.id);
      else fetchCheckoutSummary(address.id);
    }
  }, [shippingAddress?.id, isBuyNow, buyNowData, fetchBuyNowSummary, fetchCheckoutSummary]);

  const handlePayment = async () => {
    if (!shippingAddress) {
      toast({ title: t("common.error"), description: t(ValidationMessages.REQUIRED_FIELD, { field: t(CheckoutMessages.SHIPPING) }), variant: "destructive" });
      return;
    }
    if (!shippingAddress.phone || shippingAddress.phone.trim() === '') {
      setShowPhoneWarning(true);
      return;
    }
    if (!billingSameAsShipping && !billingAddress) {
      toast({ title: t("common.error"), description: t(ValidationMessages.REQUIRED_FIELD, { field: t(CheckoutMessages.BILLING) }), variant: "destructive" });
      return;
    }
    if (!summary) return;

    try {
      setProcessing(true);
      setBlocking(true);

      let orderData;
      if (isBuyNow && buyNowData) {
        orderData = await checkoutOrchestrator.createPaymentOrderForBuyNow({ ...buyNowData, addressId: shippingAddress.id });
      } else {
        orderData = await checkoutOrchestrator.createPaymentOrder(summary.totals.finalAmount, summary.user_profile, shippingAddress.id);
      }

      if (!window.Razorpay) {
        const isLoaded = await paymentOrchestrator.loadGateway();
        if (!isLoaded) {
          toast({ title: t("common.error"), description: t(CheckoutMessages.PAYMENT_GATEWAY_LOAD_ERROR), variant: "destructive" });
          setProcessing(false);
          setBlocking(false);
          return;
        }
      }

      const options = {
        key: summary.razorpay_key_id || orderData.key_id,
        amount: orderData.amount,
        currency: orderData.currency,
        name: t(CommonMessages.BRAND_NAME),
        description: isBuyNow ? t(ProductMessages.BUY_NOW) : t(CheckoutMessages.TITLE),
        image: CONFIG.APP_LOGO_URL,
        order_id: orderData.order_id,
        handler: async function (response: any) {
          if (isPaymentSuccess.current) return;
          isPaymentSuccess.current = true;
          setLoading(true);
          setProcessing(true);
          setStatusMessage(t(CheckoutMessages.VERIFYING_PAYMENT));
          try {
            let result;
            const commonVerificationData = {
              razorpay_order_id: response.razorpay_order_id || orderData.order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              payment_id: orderData.payment_id,
              shipping_address_id: shippingAddress.id,
              billing_address_id: billingSameAsShipping ? shippingAddress.id : billingAddress!.id,
            };
            if (isBuyNow && buyNowData) {
              result = await checkoutOrchestrator.verifyPaymentForBuyNow({ ...commonVerificationData, buyNowData });
            } else {
              result = await checkoutOrchestrator.verifyPayment(commonVerificationData);
            }

            if (result.success) {
              setStatusMessage(t(CheckoutMessages.FINALIZING_ORDER));
              setStatusMessage(t(CheckoutMessages.REDIRECTING));

              setBlocking(false);
              setProcessing(false);
              setLoading(false);

              if (!isBuyNow) {
                void fetchCart(true).catch((cartError) => {
                  logger.warn("Checkout cart refresh failed after payment", cartError);
                });
              }

              navigate(`/order-confirmation/${result.order.id}`, {
                replace: true,
                state: {
                  confirmation: {
                    orderId: result.order.id,
                    orderNumber: result.order.order_number,
                    totalAmount: result.order.total_amount,
                    status: result.order.status,
                    showSuccessToast: true,
                  },
                } satisfies OrderConfirmationNavigationState,
              });
            }
          } catch (error) {
            isPaymentSuccess.current = false;
            logger.error(t(SystemMessages.ORDER_CREATION_LOG_ERROR), error);
            const userMsg = getErrorMessage(error, t) || t(CheckoutMessages.ORDER_ERROR);
            toast({ title: t("common.error"), description: userMsg, variant: "destructive" });
            setProcessing(false);
            setBlocking(false);
            setLoading(false);
          }
        },
        prefill: { name: user?.name || "", email: user?.email || "", contact: shippingAddress.phone || "" },
        theme: { color: "#16a34a" },
        modal: {
          ondismiss: function () {
            if (!isPaymentSuccess.current) {
              setProcessing(false);
              setBlocking(false);
              toast({ title: t("common.info"), description: t(CheckoutMessages.PAYMENT_CANCELLED) });
            }
          }
        }
      };

      const rzp1 = new (window as any).Razorpay(options);
      rzp1.open();
    } catch (error: any) {
      if (error?.response?.data?.stockIssue || error?.response?.data?.stockIssues) {
        setStockIssues(error.response.data.stockIssues || [error.response.data.stockIssue]);
        setShowStockModal(true);
      } else {
        const serverMsg = getErrorMessage(error, t);
        toast({ title: t("common.error"), description: serverMsg || t(CheckoutMessages.PAYMENT_INIT_ERROR), variant: "destructive" });
      }
    } finally {
      setProcessing(false);
      setBlocking(false);
    }
  };

  const cartItems = useMemo(() => {
    if (!summary) return [];
    return summary.cart.cart_items.map((item) => {
      const itemDetail = summary.totals.itemBreakdown?.find((id: any) =>
        (id.variant_id && id.variant_id === item.variant_id) || (!id.variant_id && id.product_id === item.product_id)
      );
      return {
        ...item,
        productId: item.product_id,
        product: item.products,
        variant: item.product_variants,
        delivery_charge: itemDetail?.delivery_charge || 0,
        delivery_gst: itemDetail?.delivery_gst || 0,
        delivery_meta: itemDetail?.delivery_meta,
        coupon_discount: itemDetail?.coupon_discount || 0,
        coupon_code: itemDetail?.coupon_code || "",
        tax_breakdown: itemDetail?.tax_breakdown
      };
    });
  }, [summary]);

  return {
    t,
    loading,
    processing,
    statusMessage,
    summary,
    availableCoupons,
    couponsLoading,
    couponBusy,
    isBuyNow,
    shippingAddress,
    setShippingAddress,
    billingAddress,
    setBillingAddress,
    billingSameAsShipping,
    setBillingSameAsShipping,
    showPhoneWarning,
    addressIdToEdit,
    setAddressIdToEdit,
    stockIssues,
    setStockIssues,
    showStockModal,
    setShowStockModal,
    eligibleCoupons,
    handleApplyCoupon,
    handleRemoveCoupon,
    handleShippingAddressSelect,
    handlePayment,
    cartItems,
    user,
    removeItem,
    fetchCheckoutSummary,
  };
}
