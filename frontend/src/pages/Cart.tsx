import { logger } from "@/lib/logger";
import { useEffect, useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { ShieldCheck, Truck, RotateCcw, Headphones } from "lucide-react";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import { CartItem } from "@/components/cart/CartItem";
import { CartSummary } from "@/components/cart/CartSummary";
import { EmptyCart } from "@/components/cart/EmptyCart";
import { Skeleton } from "@/components/ui/skeleton";
import { BackButton } from "@/components/ui/BackButton";
import { couponService } from "@/services/coupon.service";
import { Coupon } from "@/types";
import { prefetchRazorpay } from "@/lib/razorpay";
import { CartMessages } from "@/constants/messages/CartMessages";

const Cart = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const items = useCartStore(state => state.items);
  const totals = useCartStore(state => state.totals);
  const isLoading = useCartStore(state => state.isLoading);
  const initialized = useCartStore(state => state.initialized);
  const fetchCart = useCartStore(state => state.fetchCart);
  const removeItem = useCartStore(state => state.removeItem);
  const updateQuantity = useCartStore(state => state.updateQuantity);
  const applyCoupon = useCartStore(state => state.applyCoupon);
  const removeCoupon = useCartStore(state => state.removeCoupon);
  const deliverySettings = useCartStore(state => state.deliverySettings);
  const isCalculating = useCartStore(state => state.isCalculating);
  const isSyncing = useCartStore(state => state.isSyncing);
  const isItemSyncing = useCartStore(state => state.isItemSyncing);
  const { isAuthenticated } = useAuthStore();
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  // Track if initial fetch has happened to prevent double-fetch in React strict mode
  const hasFetchedRef = useRef(false);

  // OPTIMIZED: Fetch cart and coupons immediately on mount
  // The cart service already handles guest vs authenticated via cookies
  useEffect(() => {
    // Prevent double-fetch in React strict mode
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchCartAndCoupons = async () => {
      // Run both fetches in parallel
      await Promise.all([
        fetchCart(), // Works for both guests and authenticated users
        (async () => {
          setCouponsLoading(true);
          try {
            const coupons = await couponService.getActive();
            setAvailableCoupons(coupons);
          } catch (error) {
            // Silently fail - coupons are optional
          } finally {
            setCouponsLoading(false);
          }
        })()
      ]);
    };

    fetchCartAndCoupons();
    // Refetch when authentication state changes to ensure guest cart merge is reflected
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]); // Added isAuthenticated dependency

  // Prefetch Razorpay SDK when cart has items (non-blocking)
  useEffect(() => {
    if (initialized && items.length > 0) {
      prefetchRazorpay();
    }
  }, [initialized, items.length]);

  // Refetch coupons when totals change (after cart operations) - but not on mount
  useEffect(() => {
    if (!initialized) return; // Skip on mount

    const fetchCoupons = async () => {
      try {
        const coupons = await couponService.getActive();
        setAvailableCoupons(coupons);
      } catch (error) {
        // Silently fail - coupons are optional
      }
    };
    fetchCoupons();
  }, [totals, initialized]); // Refetch when totals change (after cart operations)

  useEffect(() => {
    if (!initialized) return;
    fetchCart(true);
  }, [fetchCart, i18n.language, initialized]);

  const handlePlaceOrder = () => {
    navigate("/checkout");
  };

  const benefits = [
    {
      icon: <Truck className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_FAST_DELIVERY),
      description: t(CartMessages.BENEFITS_FAST_DELIVERY_DESC)
    },
    {
      icon: <ShieldCheck className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_SECURE_PAYMENT),
      description: t(CartMessages.BENEFITS_SECURE_PAYMENT_DESC)
    },
    {
      icon: <RotateCcw className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_EASY_RETURNS),
      description: t(CartMessages.BENEFITS_EASY_RETURNS_DESC)
    },
    {
      icon: <Headphones className="w-6 h-6" />,
      title: t(CartMessages.BENEFITS_SUPPORT),
      description: t(CartMessages.BENEFITS_SUPPORT_DESC)
    }
  ];

  // CRITICAL: Memoize enriched items BEFORE any early returns
  // This ensures hooks are called in the same order on every render (React Rules of Hooks)
  const enrichedItems = useMemo(() => {
    if (!items) return [];

    // O(N) lookup map for fast cart recalculation with high item counts
    const breakdownMap = new Map();
    if (totals?.itemBreakdown) {
      totals.itemBreakdown.forEach((id: any) => {
        const key = id.variant_id ? `var_${id.variant_id}` : `prod_${id.product_id}`;
        breakdownMap.set(key, id);
      });
    }

    const enriched = items.map((item) => {
      const key = item.variantId ? `var_${item.variantId}` : `prod_${item.productId}`;
      const itemDetail = breakdownMap.get(key);

      return {
        ...item,
        // Use breakdown detail if available, otherwise fall back to item-level charge (improved optimistic)
        delivery_charge: itemDetail?.delivery_charge ?? item.delivery_charge ?? 0,
        delivery_gst: itemDetail?.delivery_gst ?? item.delivery_gst ?? 0,
        delivery_meta: itemDetail?.delivery_meta ?? item.delivery_meta,
        coupon_discount: itemDetail?.coupon_discount ?? item.coupon_discount ?? 0,
        coupon_code: itemDetail?.coupon_code ?? item.coupon_code ?? ''
      };
    });

    // Debug logging to track surcharge data (remove in production)
    if (process.env.NODE_ENV === 'development') {
      const surchargeItems = enriched.filter(item =>
        item.delivery_meta?.source !== 'global' && (item.delivery_charge > 0 || item.delivery_gst > 0)
      );
    }

    return enriched;
  }, [items, totals?.itemBreakdown]);

  // Loading state - now AFTER all hooks
  if (isLoading && !initialized) {
    return (
      <div className="min-h-screen bg-background py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4 p-4 border rounded-xl">
                  <Skeleton className="h-24 w-24 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-2/3" />
                    <Skeleton className="h-4 w-1/3" />
                    <Skeleton className="h-8 w-1/4 mt-2" />
                  </div>
                </div>
              ))}
            </div>
            <div className="lg:col-span-1">
              <Skeleton className="h-96 w-full rounded-xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loaded but empty
  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-background py-8">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <BackButton to="/shop" label={t(CartMessages.CONTINUE)} />
          <EmptyCart />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-8 sm:py-16 animate-in fade-in duration-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-black tracking-tight font-playfair">{t(CartMessages.TITLE)}</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-primary" />
              {t(CartMessages.SHOPPING_BAG_COUNT, { count: items.length, item: items.length === 1 ? t(CartMessages.ITEM) : t(CartMessages.ITEMS) })}
            </p>
          </div>
          <BackButton to="/shop" label={t(CartMessages.CONTINUE)} variant="pill" className="rounded-full px-6" />
        </div>

        <div className="relative">
          {/* Non-blocking Global Progress (Only for Coupons/Auth) */}
          {isLoading && initialized && (
            <div className="absolute inset-x-0 -top-1 z-50 transform -translate-y-full px-4">
              <div className="h-1 w-full bg-primary/20 overflow-hidden rounded-full">
                <div className="h-full bg-primary animate-progress-indeterminate w-full origin-left-right" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 lg:gap-16 items-start">
            {/* Cart Items List */}
            <div className="lg:col-span-2 space-y-6 sm:space-y-8">
              <div className="space-y-6">
                {enrichedItems.map((item) => (
                  <CartItem
                    key={`${item.productId}-${item.variantId || 'base'}`}
                    item={item}
                    updateQuantity={updateQuantity}
                    removeItem={removeItem}
                    isLoading={isLoading}
                    isCalculating={isItemSyncing(item.productId, item.variantId)}
                    isFreeDelivery={totals?.deliveryCharge === 0}
                  />
                ))}
              </div>

              <div className="mt-12 pt-8 border-t border-dashed border-border/60 flex items-center justify-between">
                {items.some(item => (item.variant?.tax_applicable ?? item.product?.default_tax_applicable ?? false)) && (
                  <p className="text-sm text-muted-foreground italic">
                    {items.some(item =>
                      (item.variant?.tax_applicable ?? item.product?.default_tax_applicable ?? false) &&
                      !(item.variant?.price_includes_tax ?? item.product?.default_price_includes_tax ?? false)
                    )
                      ? t(CartMessages.TAX_DISCLAIMER_ADDITIONAL)
                      : t(CartMessages.TAX_DISCLAIMER_INCLUSIVE)}
                  </p>
                )}
              </div>
            </div>

            {/* Cart Summary Side Panel */}
            <div className="lg:col-span-1 relative lg:sticky lg:top-24">
              <CartSummary
                totals={totals}
                itemsCount={items.length}
                isLoading={isLoading}
                onApplyCoupon={applyCoupon}
                onRemoveCoupon={removeCoupon}
                onCheckout={handlePlaceOrder}
                availableCoupons={availableCoupons}
                deliverySettings={deliverySettings}
                isCalculating={isCalculating || isSyncing}
                items={enrichedItems}
              />
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 border-t border-border/60 pt-16">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col items-center text-center space-y-4 p-6 rounded-3xl hover:bg-muted/50 transition-all group border border-transparent hover:border-border/50">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
                {benefit.icon}
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-sm uppercase tracking-widest">{benefit.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed px-4">{benefit.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};

export default Cart;
