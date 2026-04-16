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
import { CheckoutCouponSection } from "@/components/checkout/CheckoutCouponSection";
import { CheckoutPaymentSection } from "@/components/checkout/CheckoutPaymentSection";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2, Lock, ShieldCheck, ShoppingBag, Sparkles, TicketPercent, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
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
import { CheckoutSkeleton } from "@/components/ui/page-skeletons";
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
import { useUIStore } from "@/store/uiStore";


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
  const { toast } = useToast();
  const setBlocking = useUIStore(state => state.setBlocking);

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
        toast({
          title: t("common.info"),
          description: t(CartMessages.EMPTY),
        });
        navigate("/cart");
        return;
      }

      setSummary(data);

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

    } finally {
      setLoading(false);
      // Safety: Clear any orphaned blocking state (e.g. from Buy Now navigation)
      useUIStore.getState().clearAllBlocking();
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
      // Safety: Clear any orphaned blocking state
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
          toast({
            title: t("common.error"),
            description: errorMsg,
            variant: "destructive",
          });
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

  const handleApplyCoupon = useCallback(async (code: string) => {
    // Safety check: Coupon application on checkout is ONLY for Buy Now
    if (!isBuyNow) {
      toast({
        title: t("common.error"),
        description: t("errors.payment.invalidCoupon"),
        variant: "destructive",
      });
      return;
    }

    const normalizedCode = code.trim().toUpperCase();

    if (!normalizedCode) {
      toast({
        title: t("common.error"),
        description: t("cart.summary.enterCoupon"),
        variant: "destructive",
      });
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
          toast({
            title: t("common.error"),
            description: t("errors.payment.invalidCoupon"),
            variant: "destructive",
          });
          return;
        }

        setSummary(result);
        setBuyNowData({
          ...nextBuyNowData,
          addressId
        });
        toast({
          title: t("common.success"),
          description: t("success.cart.couponApplied"),
        });
      }
    } finally {
      setCouponBusy(false);
    }
  }, [buyNowData, isBuyNow, shippingAddress?.id, summary, t]);

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
        toast({
          title: t("common.success"),
          description: t("success.cart.couponRemoved"),
        });
      }
    } finally {
      setCouponBusy(false);
    }
  }, [buyNowData, isBuyNow, shippingAddress?.id, summary, t]);


  const handleShippingAddressSelect = useCallback((address: CheckoutAddress) => {
    // Only refetch if address actually changed
    if (shippingAddress?.id !== address.id) {
      setShippingAddress(address);
      if (isBuyNow && buyNowData) {
        fetchBuyNowSummary(buyNowData, address.id);
      } else {
        fetchCheckoutSummary(address.id);
      }
    }
  }, [shippingAddress?.id, isBuyNow, buyNowData, fetchBuyNowSummary, fetchCheckoutSummary]);

  const handleEditOpened = useCallback(() => setAddressIdToEdit(null), []);

  const handlePayment = async () => {
    if (!shippingAddress) {
      toast({
        title: t("common.error"),
        description: t(ValidationMessages.REQUIRED_FIELD, { field: t(CheckoutMessages.SHIPPING) }),
        variant: "destructive",
      });
      return;
    }

    // Validate phone number
    if (!shippingAddress.phone || shippingAddress.phone.trim() === '') {
      setShowPhoneWarning(true);
      return;
    }

    if (!billingSameAsShipping && !billingAddress) {
      toast({
        title: t("common.error"),
        description: t(ValidationMessages.REQUIRED_FIELD, { field: t(CheckoutMessages.BILLING) }),
        variant: "destructive",
      });
      return;
    }

    if (!summary) return;

    try {
      setProcessing(true);
      setBlocking(true);

      // PHASE 2B OPTIMIZATION: Stock validation now inline for both Buy Now AND Cart
      // No separate validation API call needed - backend validates during payment creation

      // 1. Create Payment Order on Backend (stock validation inline)
      let orderData;
      try {
        if (isBuyNow && buyNowData) {
          orderData = await checkoutService.createPaymentOrderForBuyNow({
            ...buyNowData,
            addressId: shippingAddress.id
          });
        } else {
          // PHASE 3A: Pass profile from summary to avoid duplicate fetch
          // Pass shippingAddress.id to ensure backend calculates delivery/tax correctly for THIS address
          orderData = await checkoutService.createPaymentOrder(
            summary.totals.finalAmount,
            summary.user_profile,
            shippingAddress?.id
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
          setBlocking(false);
          return;
        } else if (error?.response?.data?.stockIssues) {
          // Cart multi-item failure
          setStockIssues(error.response.data.stockIssues);
          setShowStockModal(true);
          setProcessing(false);
          setBlocking(false);
          return;
        }
        // Re-throw other errors to be handled by outer catch
        throw error;
      }

      // 2. Ensure Razorpay SDK is loaded (verify preload or load now)
      if (!window.Razorpay) {
        const isLoaded = await loadRazorpay();
        if (!isLoaded) {
          toast({
            title: t("common.error"),
            description: t(CheckoutMessages.PAYMENT_GATEWAY_LOAD_ERROR),
            variant: "destructive",
          });
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
              toast({
                title: t("common.success"),
                description: t(CheckoutMessages.ORDER_PLACE_SUCCESS),
              });

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
              toast({
                title: t("common.error"),
                description: t(CheckoutMessages.NETWORK_ERROR),
                variant: "destructive",
              });
            } else {
              // Use server error message - it's now user-friendly
              const serverMsg = getErrorMessage(error, t);

              // The backend now provides user-friendly messages
              const userMsg = serverMsg || t(CheckoutMessages.ORDER_ERROR);

              toast({
                title: t("common.error"),
                description: userMsg,
                variant: "destructive",
              });
            }
            // Only stop processing on error
            setProcessing(false);
            setBlocking(false);
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
              setBlocking(false);
              toast({
                title: t("common.info"),
                description: t(CheckoutMessages.PAYMENT_CANCELLED),
              });
            }
          }
        }
      };

      const rzp1 = new window.Razorpay(options);
      rzp1.on('payment.failed', function (response: { error: { description: string } }) {
        logger.error(t(SystemMessages.PAYMENT_FAILED_LOG), response.error);
        toast({
          title: t("common.error"),
          description: t(CheckoutMessages.PAYMENT_FAILED, { error: response.error.description || t(CommonMessages.UNKNOWN_ERROR) }),
          variant: "destructive",
        });
        setProcessing(false);
        setBlocking(false);
      });
      rzp1.open();

    } catch (error) {
      logger.error(t(SystemMessages.PAYMENT_INIT_LOG_ERROR), error);
      const serverMsg = getErrorMessage(error, t);
      toast({
        title: t("common.error"),
        description: serverMsg || t(CheckoutMessages.PAYMENT_INIT_ERROR),
        variant: "destructive",
      });
      setProcessing(false);
      setBlocking(false);
    }
  };

  const handleRemoveOutOfStock = async (productId: string, variantId: string | null) => {
    try {
      await removeItem(productId, variantId || undefined);
      // Wait a bit for store to update and then refetch summary
      setTimeout(() => fetchCheckoutSummary(), 100);
      setStockIssues(prev => prev.filter(item => !(item.productId === productId && item.variantId === variantId)));
    } catch (error) {
      toast({
        title: t("common.error"),
        description: getErrorMessage(error, t, CartMessages.REMOVE_ERROR),
        variant: "destructive",
      });
    }
  };


  if (loading && !summary) {
    return <CheckoutSkeleton />;
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
                    onSelect={handleShippingAddressSelect}
                    forceEditId={addressIdToEdit}
                    onEditOpened={handleEditOpened}
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
                      <CheckoutCouponSection
                        isBuyNow={isBuyNow}
                        summary={summary}
                        couponBusy={couponBusy}
                        couponsLoading={couponsLoading}
                        eligibleCoupons={eligibleCoupons}
                        onApply={handleApplyCoupon}
                        onRemove={handleRemoveCoupon}
                      />

                    <PriceBreakdown totals={summary.totals} items={cartItems} />

                    <CheckoutPaymentSection
                      finalAmount={summary.totals.finalAmount}
                      processing={processing}
                      onPayment={handlePayment}
                    />
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
