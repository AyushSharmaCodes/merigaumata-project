import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useShallow } from "zustand/react/shallow";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { checkoutService } from "@/services/checkout.service";
import { couponService } from "@/services/coupon.service";
import { AddressSelector } from "@/components/checkout/AddressSelector";
import { PriceBreakdown } from "@/components/checkout/PriceBreakdown";
import { OutOfStockModal } from "@/components/checkout/OutOfStockModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckoutCouponSection } from "@/components/checkout/CheckoutCouponSection";
import { CheckoutPaymentSection } from "@/components/checkout/CheckoutPaymentSection";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { loadRazorpay, prefetchRazorpay } from "@/lib/razorpay";
import type { CheckoutSummary, CheckoutAddress, Product, Coupon } from "@/types";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
import { CheckoutSkeleton } from "@/components/ui/page-skeletons";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { AuthMessages } from "@/constants/messages/AuthMessages";
import { CartMessages } from "@/constants/messages/CartMessages";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import { ValidationMessages } from "@/constants/messages/ValidationMessages";
import { SystemMessages } from "@/constants/messages/SystemMessages";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CONFIG } from "@/config";
import { useUIStore } from "@/store/uiStore";

// Modularized components
import { CheckoutHeader } from "./components/CheckoutHeader";
import { CheckoutItemsSummary } from "./components/CheckoutItemsSummary";

// Type for Buy Now navigation state
interface BuyNowState {
  buyNowItem?: {
    product: Product;
    quantity: number;
    variantId?: string;
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

export default function Checkout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Granular store subscriptions
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

  // Buy Now state
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
      const data = await checkoutService.getSummary(addressId);

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
      const data = await checkoutService.getSummaryForBuyNow(requestData);

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
          prefetchRazorpay();
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
    if (summary && !loading) prefetchRazorpay();
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
      const result = await checkoutService.getSummaryForBuyNow({ ...buyNowData, couponCode: normalizedCode, addressId });
      
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
      const result = await checkoutService.getSummaryForBuyNow({ ...remainingBuyNowData, addressId });
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
        orderData = await checkoutService.createPaymentOrderForBuyNow({ ...buyNowData, addressId: shippingAddress.id });
      } else {
        orderData = await checkoutService.createPaymentOrder(summary.totals.finalAmount, summary.user_profile, shippingAddress.id);
      }

      if (!window.Razorpay) {
        const isLoaded = await loadRazorpay();
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
              result = await checkoutService.verifyPaymentForBuyNow({ ...commonVerificationData, buyNowData });
            } else {
              result = await checkoutService.verifyPayment(commonVerificationData);
            }

            if (result.success) {
              setStatusMessage(t(CheckoutMessages.FINALIZING_ORDER));
              toast({ title: t("common.success"), description: t(CheckoutMessages.ORDER_PLACE_SUCCESS) });
              if (!isBuyNow) await fetchCart(true);
              setStatusMessage(t(CheckoutMessages.REDIRECTING));
              
              // Explicitly clear blocking before navigation to ensure UI responsiveness
              setBlocking(false);
              
              setTimeout(() => {
                navigate(`/order-confirmation/${result.order.id}`, { state: { order: result.order } });
              }, 500);
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

      const rzp1 = new window.Razorpay(options);
      rzp1.open();
    } catch (error: any) {
      if (error?.response?.data?.stockIssue || error?.response?.data?.stockIssues) {
        setStockIssues(error.response.data.stockIssues || [error.response.data.stockIssue]);
        setShowStockModal(true);
      } else {
        const serverMsg = getErrorMessage(error, t);
        toast({ title: t("common.error"), description: serverMsg || t(CheckoutMessages.PAYMENT_INIT_ERROR), variant: "destructive" });
      }
      setProcessing(false);
      setBlocking(false);
    }
  };

  if (loading && !summary) return <CheckoutSkeleton />;
  if (!summary) return null;

  const cartItems = summary.cart.cart_items.map((item) => {
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

  return (
    <div className="min-h-screen bg-background pb-20">
      <CheckoutHeader />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="space-y-8">
          <CheckoutItemsSummary items={cartItems} />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            <div className="lg:col-span-8 space-y-8">
              {/* Shipping Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">1</div>
                    {t(CheckoutMessages.SHIPPING)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <AddressSelector
                    type="shipping"
                    selectedAddressId={shippingAddress?.id}
                    onSelect={handleShippingAddressSelect}
                    forceEditId={addressIdToEdit}
                    onEditOpened={() => setAddressIdToEdit(null)}
                  />
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">2</div>
                    {t(CheckoutMessages.BILLING)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center space-x-2 bg-muted/20 p-4 rounded-lg border border-border/40">
                    <input
                      type="checkbox"
                      id="billingSameAsShipping"
                      checked={billingSameAsShipping}
                      onChange={(e) => setBillingSameAsShipping(e.target.checked)}
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <label htmlFor="billingSameAsShipping" className="text-sm font-medium leading-none cursor-pointer">
                      {t(CheckoutMessages.BILLING_SAME)}
                    </label>
                  </div>

                  {!billingSameAsShipping && (
                    <div className="animate-in slide-in-from-top-2 duration-300">
                      <AddressSelector
                        type="billing"
                        selectedAddressId={billingAddress?.id}
                        onSelect={setBillingAddress}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Coupon Section (Only for Buy Now) */}
              {isBuyNow && (
                <Card className="border-none shadow-sm overflow-hidden">
                  <CardHeader className="bg-muted/30 pb-4">
                    <CardTitle className="flex items-center gap-3">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">3</div>
                      {t(CartMessages.COUPON_TITLE)}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <CheckoutCouponSection
                      onApply={handleApplyCoupon}
                      onRemove={handleRemoveCoupon}
                      appliedCoupon={summary.totals.coupon}
                      availableCoupons={eligibleCoupons}
                      isLoading={couponBusy || couponsLoading}
                    />
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sidebar - Order Summary & Payment */}
            <div className="lg:col-span-4 space-y-6 sticky top-8">
              <Card className="border-none shadow-lg overflow-hidden ring-1 ring-primary/5">
                <CardHeader className="bg-primary text-primary-foreground pb-6">
                  <CardTitle className="text-xl">{t(CheckoutMessages.SUMMARY)}</CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <PriceBreakdown
                    totals={summary.totals}
                    items={cartItems}
                  />
                  
                  <CheckoutPaymentSection
                    onPayment={handlePayment}
                    isProcessing={processing}
                    statusMessage={statusMessage}
                    totalAmount={summary.totals.finalAmount}
                  />

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <OutOfStockModal
        open={showStockModal}
        onOpenChange={setShowStockModal}
        stockIssues={stockIssues}
        onRemoveItem={async (pid, vid) => {
          await removeItem(pid, vid || undefined);
          setTimeout(() => fetchCheckoutSummary(), 100);
          setStockIssues(prev => prev.filter(item => !(item.productId === pid && item.variantId === vid)));
        }}
      />
    </div>
  );
}
