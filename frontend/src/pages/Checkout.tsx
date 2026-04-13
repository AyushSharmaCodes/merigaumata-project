import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/store/authStore";
import { useCartStore } from "@/store/cartStore";
import { checkoutService } from "@/services/checkout.service";
import { couponService } from "@/services/coupon.service";
import { AddressSelector } from "@/components/checkout/AddressSelector";
import { OrderSummary } from "@/components/checkout/OrderSummary";
import { PriceBreakdown } from "@/components/checkout/PriceBreakdown";
import { OutOfStockModal } from "@/components/checkout/OutOfStockModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock, ShieldCheck, ShoppingBag, Sparkles, TicketPercent, X } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { loadRazorpay, prefetchRazorpay } from "@/lib/razorpay";
import type { CheckoutSummary, CheckoutAddress, Product, Coupon } from "@/types";
import { getErrorMessage, isNetworkError } from "@/lib/errorUtils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { BackButton } from "@/components/ui/BackButton";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { AuthMessages } from "@/constants/messages/AuthMessages";
import { CartMessages } from "@/constants/messages/CartMessages";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import { ValidationMessages } from "@/constants/messages/ValidationMessages";
import { SystemMessages } from "@/constants/messages/SystemMessages";
import { useCurrency } from "@/contexts/CurrencyContext";
import { CONFIG } from "@/config";


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
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, user } = useAuthStore();
  const { fetchCart, removeItem, applyCoupon: applyCartCoupon, removeCoupon: removeCartCoupon } = useCartStore();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const isPaymentSuccess = useRef(false);
  const [summary, setSummary] = useState<CheckoutSummary | null>(null);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);
  const [couponCode, setCouponCode] = useState("");
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
  const [stockIssues, setStockIssues] = useState<Array<{
    productId: string;
    variantId: string | null;
    title: string;
    variantLabel: string | null;
    requestedQty: number;
    availableStock: number;
    image: string | null;
  }>>([]);
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

  // Moved fetchCheckoutSummary definition up
  const fetchCheckoutSummary = useCallback(async (addressId?: string) => {
    try {
      setLoading(true);
      const data = await checkoutService.getSummary(addressId);

      if (!data.cart || !data.cart.cart_items || data.cart.cart_items.length === 0) {
        toast.error(t(CartMessages.EMPTY));
        navigate("/cart");
        return;
      }

      setSummary(data);
      setCouponCode(data.totals?.coupon?.code || data.cart?.applied_coupon_code || "");

      // Sync global cart store to ensure Navbar count is accurate
      // This handles cases where user navigates directly to checkout or hard refreshes
      fetchCart();

      // Pre-select addresses if available, but DON'T overwrite if we specifically requested an address (user selection)
      // This prevents race conditions where backend fallback logic reverts the user's selection
      if (data.shipping_address && !addressId) {
        const newShipping = data.shipping_address;
        setShippingAddress(prev => {
          // Only update if current is null or ID differs
          if (!prev || prev.id !== newShipping.id) {
            return newShipping;
          }
          return prev;
        });
      }
      if (data.billing_address) {
        const newBilling = data.billing_address;
        setBillingAddress(prev => {
          if (!prev || prev.id !== newBilling.id) {
            return newBilling;
          }
          return prev;
        });
      }

    } catch (error: any) {
      logger.error(t(SystemMessages.CHECKOUT_LOG_ERROR), error);

      // PHASE 3A: Explicitly handle 401 to prevent ghost carts or broken states
      // If the backend firmly rejects the session, force a full re-login
      if (error?.response?.status === 401) {
        toast.error(t(AuthMessages.SESSION_EXPIRED_TOAST));
        window.location.href = `/?auth=login&returnUrl=${encodeURIComponent('/checkout')}`;
        return;
      }

      toast.error(getErrorMessage(error, t, CheckoutMessages.LOAD_ERROR));
    } finally {
      setLoading(false);
    }
  }, [fetchCart, navigate, t]);

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

      const requestData = {
        ...nextBuyNowData,
        addressId: resolvedAddressId
      };

      const data = await checkoutService.getSummaryForBuyNow(requestData);

      setSummary(data);
      setBuyNowData({
        ...nextBuyNowData,
        addressId: resolvedAddressId
      });
      setCouponCode(data.totals?.coupon?.code || data.cart?.applied_coupon_code || "");

      if (data.shipping_address) {
        const newShipping = data.shipping_address;
        setShippingAddress(prev => prev?.id === newShipping.id ? prev : newShipping);
      }
      if (data.billing_address) {
        const newBilling = data.billing_address;
        setBillingAddress(prev => prev?.id === newBilling.id ? prev : newBilling);
      }

      return data;
    } catch (error) {
      logger.error(t(SystemMessages.BUY_NOW_LOG_ERROR), error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const initCheckout = async () => {
      if (!isAuthenticated) {
        toast.error(t(AuthMessages.LOGIN_TO_CHECKOUT));
        navigate("/auth?returnUrl=/checkout");
        return;
      }

      // If we are already in Buy Now mode (e.g. after state clear), don't fallback to cart
      if (isBuyNow) return;

      // Check for Buy Now flow
      const state = location.state as BuyNowState | undefined;
      if (state?.buyNowItem) {
        const { product, quantity, variantId } = state.buyNowItem;

        // Set Buy Now mode
        setIsBuyNow(true);
        const initialBuyNowData = {
          productId: product.id,
          variantId: variantId,
          quantity
        };

        // Clear the state to prevent re-loading on refresh
        navigate(location.pathname, { replace: true, state: {} });

        // Fetch Buy Now summary (not cart-based)
        try {
          await fetchBuyNowSummary(initialBuyNowData);

          // Prefetch Razorpay SDK in background (non-blocking)
          prefetchRazorpay();
        } catch (error) {
          const errorMsg = getErrorMessage(error, t, CheckoutMessages.LOAD_ERROR);
          toast.error(errorMsg);
          navigate("/shop");
        }
        return;
      }

      // Regular cart checkout flow
      fetchCheckoutSummary();
    };

    initCheckout();
  }, [isAuthenticated, navigate, fetchBuyNowSummary, fetchCheckoutSummary, isBuyNow, location, t]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchAvailableCoupons();
  }, [fetchAvailableCoupons, isAuthenticated]);

  // Prefetch Razorpay SDK after summary loads (non-blocking)
  useEffect(() => {
    if (summary && !loading) {
      prefetchRazorpay();
    }
  }, [summary, loading]);

  const eligibleCoupons = useMemo(
    () => availableCoupons.filter((coupon) => isCouponEligibleForSummary(coupon, summary)),
    [availableCoupons, summary]
  );

  const handleApplyCoupon = useCallback(async (codeOverride?: string) => {
    // Safety check: Coupon application on checkout is ONLY for Buy Now
    if (!isBuyNow) {
      toast.error(t("errors.payment.invalidCoupon"));
      return;
    }

    const normalizedCode = (codeOverride || couponCode).trim().toUpperCase();

    if (!normalizedCode) {
      toast.error(t("cart.summary.enterCoupon"));
      return;
    }

    if (!summary) return;

    setCouponBusy(true);
    try {
      if (buyNowData) {
        const nextBuyNowData = {
          ...buyNowData,
          couponCode: normalizedCode
        };
        const addressId = shippingAddress?.id || buyNowData.addressId;
        const result = await checkoutService.getSummaryForBuyNow({
          ...nextBuyNowData,
          addressId
        });

        if ((result.totals?.coupon?.code || "").toUpperCase() !== normalizedCode) {
          toast.error(t("errors.payment.invalidCoupon"));
          return;
        }

        setSummary(result);
        setBuyNowData({
          ...nextBuyNowData,
          addressId
        });
        setCouponCode("");
        toast.success(t("success.cart.couponApplied"));
      }
    } finally {
      setCouponBusy(false);
    }
  }, [buyNowData, couponCode, isBuyNow, shippingAddress?.id, summary, t]);

  const handleRemoveCoupon = useCallback(async () => {
    // Safety check: Coupon removal on checkout is ONLY for Buy Now
    if (!isBuyNow) return;

    if (!summary) return;

    setCouponBusy(true);
    try {
      if (buyNowData) {
        const { couponCode: _couponCode, ...remainingBuyNowData } = buyNowData;
        const addressId = shippingAddress?.id || buyNowData.addressId;
        const result = await checkoutService.getSummaryForBuyNow({
          ...remainingBuyNowData,
          addressId
        });

        setSummary(result);
        setBuyNowData({
          ...remainingBuyNowData,
          addressId
        });
        setCouponCode("");
        toast.success(t("success.cart.couponRemoved"));
      }
    } finally {
      setCouponBusy(false);
    }
  }, [buyNowData, isBuyNow, shippingAddress?.id, summary, t]);

  const handlePayment = async () => {
    if (!shippingAddress) {
      toast.error(t(ValidationMessages.REQUIRED_FIELD, { field: t(CheckoutMessages.SHIPPING) }));
      return;
    }

    // Validate phone number
    if (!shippingAddress.phone || shippingAddress.phone.trim() === '') {
      setShowPhoneWarning(true);
      return;
    }

    if (!billingSameAsShipping && !billingAddress) {
      toast.error(t(ValidationMessages.REQUIRED_FIELD, { field: t(CheckoutMessages.BILLING) }));
      return;
    }

    if (!summary) return;

    try {
      setProcessing(true);

      // PHASE 2B OPTIMIZATION: Stock validation now inline for both Buy Now AND Cart
      // No separate validation API call needed - backend validates during payment creation

      // 1. Create Payment Order on Backend (stock validation inline)
      let orderData;
      try {
        if (isBuyNow && buyNowData) {
          orderData = await checkoutService.createPaymentOrderForBuyNow(
            { ...buyNowData, addressId: shippingAddress.id },
            summary.user_profile,
            summary.totals
          );
        } else {
          // PHASE 3A: Pass profile, items, and totals to Edge Function
          orderData = await checkoutService.createPaymentOrder(
            summary.totals.finalAmount,
            summary.user_profile,
            shippingAddress?.id,
            summary.cart.cart_items,
            summary.totals
          );
        }
      } catch (error: any) {
        // Handle inline stock validation failures from payment creation
        if (error?.response?.data?.stockIssue && isBuyNow) {
          // Buy Now single item failure
          const stockIssue = error.response.data.stockIssue;
          const errorMsg = error.response.data.error || '';

          // Build title from available data instead of regex
          let productTitle = t(ProductMessages.PRODUCT_LABEL);

          // Try to find name in Buy Now state state first
          if (location.state && (location.state as any).buyNowItem?.product?.id === stockIssue.productId) {
            productTitle = (location.state as any).buyNowItem.product.title;
          } else if (summary?.cart?.cart_items) {
            // Fallback to searching in summary if somehow we have it
            const foundItem = summary.cart.cart_items.find(item => item.product_id === stockIssue.productId);
            if (foundItem?.products?.title) {
              productTitle = foundItem.products.title;
            }
          }

          setStockIssues([{
            productId: stockIssue.productId,
            variantId: stockIssue.variantId || null,
            title: productTitle,
            variantLabel: null,
            requestedQty: stockIssue.requestedQty,
            availableStock: stockIssue.availableStock,
            image: null
          }]);
          setShowStockModal(true);
          setProcessing(false);
          return;
        } else if (error?.response?.data?.stockIssues) {
          // Cart multiple items failure  
          setStockIssues(error.response.data.stockIssues);
          setShowStockModal(true);
          setProcessing(false);
          return;
        }
        // Re-throw other errors to be handled by outer catch
        throw error;
      }

      // 2. Ensure Razorpay SDK is loaded (verify preload or load now)
      if (!window.Razorpay) {
        const isLoaded = await loadRazorpay();
        if (!isLoaded) {
          toast.error(t(CheckoutMessages.PAYMENT_GATEWAY_LOAD_ERROR));
          setProcessing(false);
          return;
        }
      }

      // 3. Initialize Razorpay Options
      const options = {
        key: summary.razorpay_key_id || orderData.key_id, // PHASE 2B: Use key from summary (fallback to orderData for compatibility)
        amount: orderData.amount,
        currency: orderData.currency,
        name: t(CommonMessages.BRAND_NAME),
        description: isBuyNow ? t(ProductMessages.BUY_NOW) : t(CheckoutMessages.TITLE),
        image: CONFIG.APP_LOGO_URL,
        order_id: orderData.order_id,
        handler: async function (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
          // Prevent double submission or interference
          if (isPaymentSuccess.current) return;
          isPaymentSuccess.current = true;

          // Show full screen loader during verification
          setLoading(true);
          setProcessing(true);
          setStatusMessage(t(CheckoutMessages.VERIFYING_PAYMENT));

          try {
            // 3. Verify Payment on Backend (different endpoints for buy now vs cart)
            let result;
            if (isBuyNow && buyNowData) {
              result = await checkoutService.verifyPaymentForBuyNow({
                razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_id: orderData.payment_id,
                shipping_address_id: shippingAddress.id,
                billing_address_id: billingSameAsShipping ? shippingAddress.id : billingAddress!.id,
                buyNowData
              });
            } else {
              result = await checkoutService.verifyPayment({
                razorpay_order_id: response.razorpay_order_id || orderData.order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                payment_id: orderData.payment_id,
                shipping_address_id: shippingAddress.id,
                billing_address_id: billingSameAsShipping ? shippingAddress.id : billingAddress!.id,
              });
            }

            if (result.success || (result as any).id) {
              setStatusMessage(t(CheckoutMessages.FINALIZING_ORDER));
              toast.success(t(CheckoutMessages.ORDER_PLACE_SUCCESS));

              if (!isBuyNow) {
                try {
                  await fetchCart(true);
                } catch (err) {
                  logger.error("Post-checkout cart refresh failed", err);
                }
              }

              setStatusMessage(t(CheckoutMessages.REDIRECTING));

              // Immediate navigation
              setTimeout(() => {
                navigate(`/order-confirmation/${result.order.id}`, { state: { order: result.order } });
              }, 500);
            }
          } catch (error: unknown) {
            // Reset success flag on error so user can retry
            isPaymentSuccess.current = false;
            logger.error(t(SystemMessages.ORDER_CREATION_LOG_ERROR), error);

            if (isNetworkError(error)) {
              toast.error(
                t(CheckoutMessages.NETWORK_ERROR),
                { duration: 10000 }
              );
            } else {
              // Use server error message - it's now user-friendly
              const serverMsg = getErrorMessage(error, t);

              // The backend now provides user-friendly messages
              const userMsg = serverMsg || t(CheckoutMessages.ORDER_ERROR);

              // Extend duration for important messages
              const duration = serverMsg?.includes('refund') || serverMsg?.includes('contact support') ? 8000 : 5000;

              toast.error(userMsg, { duration });
            }
            // Only stop processing on error
            setProcessing(false);
            setLoading(false);
          }
        },
        prefill: {
          name: user?.name || "",
          email: user?.email || "",
          contact: shippingAddress.phone || "",
        },
        notes: {
          address: t(CheckoutMessages.RZP_ADDRESS),
        },
        theme: {
          color: "#16a34a",
        },
        modal: {
          ondismiss: function () {
            // Only trigger if we haven't already marked payment as successful
            if (!isPaymentSuccess.current) {
              setProcessing(false);
              toast(t(CheckoutMessages.PAYMENT_CANCELLED));
            }
          }
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: { error: { description: string } }) {
        logger.error(t(SystemMessages.PAYMENT_FAILED_LOG), response.error);
        toast.error(t(CheckoutMessages.PAYMENT_FAILED, { error: response.error.description || t(CommonMessages.UNKNOWN_ERROR) }));
        setProcessing(false);
      });
      rzp1.open();

    } catch (error) {
      logger.error(t(SystemMessages.PAYMENT_INIT_LOG_ERROR), error);
      const serverMsg = getErrorMessage(error, t);
      toast.error(serverMsg || t(CheckoutMessages.PAYMENT_INIT_ERROR));
      setProcessing(false);
    }
  };

  const handleRemoveOutOfStock = async (productId: string, variantId: string | null) => {
    try {
      await removeItem(productId, variantId || undefined);
      // Wait a bit for store to update and then refetch summary
      setTimeout(() => fetchCheckoutSummary(), 100);
      setStockIssues(prev => prev.filter(item => !(item.productId === productId && item.variantId === variantId)));
    } catch (error) {
      toast.error(getErrorMessage(error, t, CartMessages.REMOVE_ERROR));
    }
  };

  if (loading && !summary) {
    return <LoadingOverlay isLoading={true} message={t(CheckoutMessages.PREPARING)} />;
  }

  if (!summary) return null;

  // Prepare cart items with delivery details embedded
  const cartItems = summary.cart.cart_items.map((item) => {
    const itemDetail = summary.totals.itemBreakdown?.find((id: any) =>
      (id.variant_id && id.variant_id === item.variant_id) ||
      (!id.variant_id && id.product_id === item.product_id)
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
      <LoadingOverlay
        isLoading={processing && loading}
        message={statusMessage || t(CheckoutMessages.PROCESSING)}
      />

      {/* Compact Premium Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 relative overflow-hidden shadow-2xl mb-8">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <ShoppingBag className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#B85C3C]/10 rounded-full blur-[100px]" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            <BackButton to="/cart" label={t(CheckoutMessages.BACK_TO_CART)} className="text-white/80 hover:text-white hover:bg-white/10" />
            <div className="space-y-1">
              <h1 className="text-3xl md:text-4xl font-bold font-playfair">
                {t(CheckoutMessages.SECURE)} <span className="text-[#B85C3C]">{t(CheckoutMessages.TITLE)}</span>
              </h1>
              <p className="text-white/60 text-sm font-light">
                {t(CheckoutMessages.SECURE_CHECKOUT_SUB)}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="space-y-8">
          {/* Top Section: Order Items */}
          <Card className="border-none shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader className="bg-muted/30 pb-4">
              <CardTitle className="flex items-center gap-3">
                <ShoppingBag className="w-5 h-5 text-primary" />
                {t(CheckoutMessages.ITEMS_IN_ORDER)}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <OrderSummary items={cartItems} />
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-start">
            {/* Left Column - Addresses */}
            <div className="lg:col-span-8 space-y-8">
              {/* Shipping Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">
                      1
                    </div>
                    {t(CheckoutMessages.SHIPPING)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                  <AddressSelector
                    type="shipping"
                    selectedAddressId={shippingAddress?.id}
                    onSelect={(address) => {
                      // Only refetch if address actually changed
                      if (shippingAddress?.id !== address.id) {
                        setShippingAddress(address);
                        if (isBuyNow && buyNowData) {
                          fetchBuyNowSummary(buyNowData, address.id);
                        } else {
                          fetchCheckoutSummary(address.id);
                        }
                      }
                    }}
                    forceEditId={addressIdToEdit}
                    onEditOpened={() => setAddressIdToEdit(null)}
                  />
                </CardContent>
              </Card>

              {/* Billing Address */}
              <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4">
                  <CardTitle className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground font-bold text-sm shadow-md">
                      2
                    </div>
                    {t(CheckoutMessages.BILLING)}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  <div className="flex items-center space-x-3 bg-muted/20 p-4 rounded-lg border border-border/50">
                    <Checkbox
                      id="billing-same"
                      checked={billingSameAsShipping}
                      onCheckedChange={(checked) => setBillingSameAsShipping(checked as boolean)}
                    />
                    <Label className="cursor-pointer font-medium">
                      {t(CheckoutMessages.SAME_AS_SHIPPING)}
                    </Label>
                  </div>

                  {!billingSameAsShipping && (
                    <div className="animate-in fade-in slide-in-from-top-2 pt-2">
                      <AddressSelector
                        type="billing"
                        selectedAddressId={billingAddress?.id}
                        onSelect={setBillingAddress}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Order Summary */}
            <div className="lg:col-span-4 space-y-6">
              <div className="sticky top-24 space-y-6">
                <Card className="border-none shadow-elevated overflow-hidden">
                  <CardContent className="p-5 space-y-2">
                      {/* Coupon Management Card - Only shown if Buy Now (unrestricted) or if a coupon is already applied (read-only for cart) */}
                      {(isBuyNow || summary.totals.coupon) && (
                        <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
                          <div className="flex items-center gap-2">
                            <div className="rounded-full bg-primary/10 p-2">
                              <TicketPercent className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-semibold">{t("profile.coupon")}</p>
                              <p className="text-xs text-muted-foreground">
                                {isBuyNow ? t(ProductMessages.BUY_NOW) : t(CheckoutMessages.TITLE)}
                              </p>
                            </div>
                          </div>

                          {summary.totals.coupon ? (
                            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="space-y-1">
                                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                                    {summary.totals.coupon.code}
                                  </p>
                                  <p className="text-sm text-emerald-900">
                                    {summary.totals.coupon.type === "free_delivery"
                                      ? t("products.freeShipping")
                                      : t("products.off", { percent: summary.totals.coupon.discount_percentage || 0 })}
                                  </p>
                                </div>
                                {isBuyNow && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
                                    onClick={handleRemoveCoupon}
                                    disabled={couponBusy}
                                    aria-label={t("success.cart.couponRemoved")}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                            </div>
                          ) : (
                            isBuyNow && (
                              <div className="space-y-3">
                                <div className="flex gap-2">
                                  <Input
                                    value={couponCode}
                                    onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                                    placeholder={t("cart.summary.enterCoupon")}
                                    className="h-11 bg-background"
                                    disabled={couponBusy}
                                  />
                                  <Button
                                    type="button"
                                    className="h-11 px-4"
                                    onClick={() => handleApplyCoupon()}
                                    disabled={couponBusy}
                                  >
                                    {couponBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : t("cart.summary.apply")}
                                  </Button>
                                </div>

                                {eligibleCoupons.length > 0 && (
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                                      <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                                      {t("cart.summary.availableOffers")}
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                      {eligibleCoupons.map((coupon) => (
                                        <button
                                          key={coupon.id}
                                          type="button"
                                          onClick={() => handleApplyCoupon(coupon.code)}
                                          className="rounded-full border border-primary/20 bg-background px-3 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                                          disabled={couponBusy}
                                        >
                                          <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                                            {coupon.code}
                                          </span>
                                          <span className="block text-[11px] text-muted-foreground">
                                            {coupon.type === "free_delivery"
                                              ? t("products.freeShipping")
                                              : t("products.off", { percent: coupon.discount_percentage || 0 })}
                                          </span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {couponsLoading && (
                                  <p className="text-xs text-muted-foreground">
                                    {t("common.loading", "Loading...")}
                                  </p>
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}

                    <PriceBreakdown totals={summary.totals} items={cartItems} />

                    <Button
                      className="w-full h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all"
                      onClick={handlePayment}
                      disabled={processing}
                    >
                      {processing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          {t(CheckoutMessages.PROCESSING)}
                        </>
                      ) : (
                        <>
                          <Lock className="mr-2 h-4 w-4" />
                          {t(CheckoutMessages.PAY)} {formatAmount(summary.totals.finalAmount)}
                        </>
                      )}
                    </Button>

                    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/30 py-1.5 rounded-full">
                      <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      <span>{t(CheckoutMessages.SECURE_GATEWAY)}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        <AlertDialog open={showPhoneWarning} onOpenChange={setShowPhoneWarning}>
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="font-playfair text-2xl text-destructive">{t(CheckoutMessages.PHONE_WARNING_TITLE)}</AlertDialogTitle>
              <AlertDialogDescription className="text-base">
                {t(CheckoutMessages.PHONE_WARNING_DESC)}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => {
                if (shippingAddress) setAddressIdToEdit(shippingAddress.id);
                setShowPhoneWarning(false);
              }} className="rounded-full px-6">
                {t(CheckoutMessages.PHONE_WARNING_ACTION)}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <OutOfStockModal
          open={showStockModal}
          onClose={() => setShowStockModal(false)}
          items={stockIssues}
          onRemoveItem={handleRemoveOutOfStock}
        />
      </div>
    </div>
  );
}
