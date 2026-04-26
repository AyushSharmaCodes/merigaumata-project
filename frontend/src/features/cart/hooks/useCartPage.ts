import { useEffect, useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useCartStore } from "@/domains/cart";
import { useAuthStore } from "@/domains/auth";
import { useShallow } from "zustand/react/shallow";
import { couponService } from "@/domains/settings";
import { prefetchRazorpay } from "@/core/payments/razorpay";
import type { Coupon } from "@/shared/types";

export function useCartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const {
    items,
    totals,
    isLoading,
    initialized,
    fetchCart,
    removeItem,
    updateQuantity,
    applyCoupon,
    removeCoupon,
    deliverySettings,
    isCalculating,
    isSyncing,
    isItemSyncing
  } = useCartStore(useShallow(state => ({
    items: state.items,
    totals: state.totals,
    isLoading: state.isLoading,
    initialized: state.initialized,
    fetchCart: state.fetchCart,
    removeItem: state.removeItem,
    updateQuantity: state.updateQuantity,
    applyCoupon: state.applyCoupon,
    removeCoupon: state.removeCoupon,
    deliverySettings: state.deliverySettings,
    isCalculating: state.isCalculating,
    isSyncing: state.isSyncing,
    isItemSyncing: state.isItemSyncing
  })));

  const isAuthenticated = useAuthStore(state => state.isAuthenticated);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [availableCoupons, setAvailableCoupons] = useState<Coupon[]>([]);
  const [couponsLoading, setCouponsLoading] = useState(false);

  const hasFetchedRef = useRef(false);

  useEffect(() => {
    if (hasFetchedRef.current) return;
    hasFetchedRef.current = true;

    const fetchCartAndCoupons = async () => {
      await Promise.all([
        fetchCart(),
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
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    if (initialized && items.length > 0) {
      prefetchRazorpay();
    }
  }, [initialized, items.length]);

  useEffect(() => {
    if (!initialized) return;

    const fetchCoupons = async () => {
      try {
        const coupons = await couponService.getActive();
        setAvailableCoupons(coupons);
      } catch (error) {
        // Silently fail - coupons are optional
      }
    };
    fetchCoupons();
  }, [totals, initialized]);

  useEffect(() => {
    if (!initialized) return;
    fetchCart(true);
  }, [fetchCart, i18n.language, initialized]);

  const handlePlaceOrder = () => {
    navigate("/checkout");
  };

  const enrichedItems = useMemo(() => {
    if (!items) return [];

    const breakdownMap = new Map();
    if (totals?.itemBreakdown) {
      totals.itemBreakdown.forEach((id: any) => {
        const key = id.variant_id ? `var_${id.variant_id}` : `prod_${id.product_id}`;
        breakdownMap.set(key, id);
      });
    }

    return items.map((item) => {
      const key = item.variantId ? `var_${item.variantId}` : `prod_${item.productId}`;
      const itemDetail = breakdownMap.get(key);

      return {
        ...item,
        delivery_charge: itemDetail?.delivery_charge ?? item.delivery_charge ?? 0,
        delivery_gst: itemDetail?.delivery_gst ?? item.delivery_gst ?? 0,
        delivery_meta: itemDetail?.delivery_meta ?? item.delivery_meta,
        coupon_discount: itemDetail?.coupon_discount ?? item.coupon_discount ?? 0,
        coupon_code: itemDetail?.coupon_code ?? item.coupon_code ?? ''
      };
    });
  }, [items, totals?.itemBreakdown]);

  return {
    t,
    i18n,
    items,
    totals,
    isLoading,
    initialized,
    removeItem,
    updateQuantity,
    applyCoupon,
    removeCoupon,
    deliverySettings,
    isCalculating,
    isSyncing,
    isItemSyncing,
    authDialogOpen,
    setAuthDialogOpen,
    availableCoupons,
    couponsLoading,
    handlePlaceOrder,
    enrichedItems,
  };
}
