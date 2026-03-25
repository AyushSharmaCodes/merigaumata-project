import { logger } from "@/lib/logger";
import { create } from "zustand";
import { CartItem, Product, CartTotals } from "@/types";
import { cartService } from "@/services/cart.service";
import { toast } from "sonner";
import { CartDTO } from "@/lib/dto/cart.dto";
import axios from "axios";
import { getErrorMessage } from "@/lib/errorUtils";
import i18n from "@/i18n/config";
import { useAuthStore } from "./authStore";
import { getGuestId } from "@/lib/guestId";
import { CartMessages } from "@/constants/messages/CartMessages";
import { subscribeToRealtime } from "@/lib/realtime-client";

interface CartState {
  items: CartItem[];
  totals: CartTotals | null;
  isLoading: boolean;
  isCalculating: boolean;
  initialized: boolean;
  deliverySettings: { threshold: number; charge: number };
  syncingItems: Set<string>;
  isSyncing: boolean;

  // Versioning for concurrent sync
  syncVersion: number;
  lastAppliedVersion: number;

  // Actions
  fetchCart: (force?: boolean) => Promise<void>;
  addItem: (product: Product, quantity?: number, variantId?: string) => Promise<void>;
  removeItem: (productId: string, variantId?: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
  applyCoupon: (code: string) => Promise<boolean>;
  removeCoupon: () => Promise<void>;
  clearCart: () => Promise<void>;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  fetchDeliverySettings: () => Promise<void>;
  isItemSyncing: (productId: string, variantId?: string) => boolean;
}

const updateTimeouts: Record<string, NodeJS.Timeout> = {};
const syncTimeouts: Record<string, NodeJS.Timeout> = {};
// Map to track number of in-flight requests per item to manage syncing state
const inFlightRequests: Record<string, number> = {};
let settingsRealtimeUnsubscribe: (() => void) | null = null;

const calculateFallbackTotals = (items: CartItem[]): CartTotals => {
  const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalMrp = items.reduce((acc, item) => {
    const mrp = item.variant?.mrp ?? item.product.mrp ?? item.product.price;
    return acc + (mrp * item.quantity);
  }, 0);
  const totalPrice = items.reduce((acc, item) => {
    const price = item.variant?.selling_price ?? item.product.price;
    return acc + (price * item.quantity);
  }, 0);

  return {
    itemsCount,
    totalMrp,
    totalPrice,
    discount: totalMrp - totalPrice,
    couponDiscount: 0,
    deliveryCharge: 0,
    deliveryGST: 0,
    finalAmount: totalPrice,
    coupon: null,
    itemBreakdown: items.map(item => ({
      product_id: item.productId,
      variant_id: item.variantId,
      quantity: item.quantity,
      mrp: item.variant?.mrp ?? item.product.mrp ?? item.product.price,
      price: item.variant?.selling_price ?? item.product.price,
      discounted_price: item.variant?.selling_price ?? item.product.price,
      delivery_charge: item.delivery_charge ?? 0,
      delivery_gst: item.delivery_gst ?? 0,
      delivery_meta: item.delivery_meta,
      coupon_discount: item.coupon_discount ?? 0,
      coupon_code: item.coupon_code ?? '',
      tax_breakdown: item.tax_breakdown
    }))
  };
};

const calculateOptimisticTotals = (items: CartItem[], currentTotals: CartTotals | null): CartTotals => {
  if (!currentTotals) {
    return calculateFallbackTotals(items);
  }

  const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const currentBreakdown = new Map(
    (currentTotals.itemBreakdown || []).map(item => {
      const key = item.variant_id ? `var_${item.variant_id}` : `prod_${item.product_id}`;
      return [key, item];
    })
  );

  return {
    ...currentTotals,
    itemsCount,
    itemBreakdown: items.map(item => {
      const key = item.variantId ? `var_${item.variantId}` : `prod_${item.productId}`;
      const existing = currentBreakdown.get(key);

      return {
        product_id: item.productId,
        variant_id: item.variantId,
        quantity: item.quantity,
        mrp: existing?.mrp ?? item.variant?.mrp ?? item.product.mrp ?? item.product.price,
        price: existing?.price ?? item.variant?.selling_price ?? item.product.price,
        discounted_price: existing?.discounted_price ?? existing?.price ?? item.variant?.selling_price ?? item.product.price,
        delivery_charge: existing?.delivery_charge ?? item.delivery_charge ?? 0,
        delivery_gst: existing?.delivery_gst ?? item.delivery_gst ?? 0,
        delivery_meta: existing?.delivery_meta ?? item.delivery_meta,
        coupon_discount: existing?.coupon_discount ?? item.coupon_discount ?? 0,
        coupon_code: existing?.coupon_code ?? item.coupon_code ?? '',
        tax_breakdown: existing?.tax_breakdown ?? item.tax_breakdown
      };
    })
  };
};

export const useCartStore = create<CartState>()((set, get) => {

  // Helper to manage syncingItems based on in-flight count with 150ms "latency buffer"
  const setSyncing = (itemKey: string, isSyncing: boolean) => {
    if (isSyncing) {
      inFlightRequests[itemKey] = (inFlightRequests[itemKey] || 0) + 1;

      // Delay showing "Syncing..." by 150ms to hide it for fast requests
      if (!syncTimeouts[itemKey]) {
        syncTimeouts[itemKey] = setTimeout(() => {
          if (inFlightRequests[itemKey] > 0) {
            set((state) => {
              const nextSyncing = new Set(state.syncingItems);
              nextSyncing.add(itemKey);
              return { syncingItems: nextSyncing, isSyncing: true };
            });
          }
          delete syncTimeouts[itemKey];
        }, 150);
      }
    } else {
      inFlightRequests[itemKey] = Math.max(0, (inFlightRequests[itemKey] || 0) - 1);

      if (inFlightRequests[itemKey] === 0) {
        // Immediately stop showing if no more in-flight for this item
        if (syncTimeouts[itemKey]) {
          clearTimeout(syncTimeouts[itemKey]);
          delete syncTimeouts[itemKey];
        }
        set((state) => {
          const nextSyncing = new Set(state.syncingItems);
          nextSyncing.delete(itemKey);
          return { syncingItems: nextSyncing, isSyncing: nextSyncing.size > 0 };
        });
      }
    }
  };

  return {
    items: [],
    totals: null,
    isLoading: false,
    isCalculating: false,
    isSyncing: false,
    initialized: false,
    deliverySettings: { threshold: 2000, charge: 100 },
    syncingItems: new Set(),
    syncVersion: 0,
    lastAppliedVersion: 0,

    isItemSyncing: (productId, variantId) => {
      const key = `${productId}:${variantId || 'no-variant'}`;
      return get().syncingItems.has(key);
    },

    fetchCart: async (force = false) => {
      if (get().initialized && !force) return;
      getGuestId();

      // Initialize real-time sync for delivery settings if not already done
      const state = get();
      if (!state.initialized && !settingsRealtimeUnsubscribe) {
        settingsRealtimeUnsubscribe = subscribeToRealtime(['store_settings'], (event) => {
          if (event.type === 'settings.updated') {
            logger.info("Store settings changed, refreshing...");
            get().fetchDeliverySettings();
          }
        });
      }

      set({ isLoading: true });
      try {
        const response = await cartService.getCart();
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

        // Forced fetches must always win so server truth can replace stale local state
        if (force || get().lastAppliedVersion === 0) {
          set((state) => ({
            items,
            totals,
            initialized: true,
            isLoading: false,
            deliverySettings: deliverySettings ? {
              threshold: deliverySettings.threshold,
              charge: deliverySettings.charge
            } : state.deliverySettings
          }));
        } else {
          set({ isLoading: false, initialized: true });
        }
      } catch (error: unknown) {
        set({ isLoading: false });
        if (!(axios.isAxiosError(error) && error.response?.status === 401)) {
          logger.error("Error fetching cart:", error);
          toast.error(getErrorMessage(error, i18n.t.bind(i18n), "errors.system.genericError"));
        }
      }
    },

    addItem: async (product, quantity = 1, variantId) => {
      const version = get().syncVersion + 1;
      set({ syncVersion: version });

      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const itemKey = `${product.id}:${variantId || 'no-variant'}`;

      // Optimistic
      set((state) => {
        const existingItem = state.items.find(item =>
          item.productId === product.id && (item.variantId || null) === (variantId || null)
        );
        let newItems;
        if (existingItem) {
          newItems = state.items.map(item =>
            (item.productId === product.id && (item.variantId || null) === (variantId || null))
              ? { ...item, quantity: item.quantity + quantity }
              : item
          );
        } else {
          const variant = variantId && product.variants ? product.variants.find(v => v.id === variantId) : undefined;
          newItems = [...state.items, {
            productId: product.id,
            variantId,
            quantity,
            product,
            variant,
            sizeLabel: variant?.size_label,
            delivery_charge: product.delivery_charge ?? 0
          }];
        }
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      setSyncing(itemKey, true);

      try {
        const response = await cartService.addItem(product.id, quantity, variantId);
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

        if (version >= get().lastAppliedVersion) {
          set((state) => ({
            items,
            totals,
            lastAppliedVersion: version,
            deliverySettings: deliverySettings ? {
              threshold: deliverySettings.threshold,
              charge: deliverySettings.charge
            } : state.deliverySettings
          }));
        }
      } catch (error: unknown) {
        set({ items: previousItems, totals: previousTotals });
        toast.error(getErrorMessage(error, i18n.t.bind(i18n), "errors.system.genericError"));
        throw error;
      } finally {
        setSyncing(itemKey, false);
      }
    },

    removeItem: async (productId, variantId) => {
      const version = get().syncVersion + 1;
      set({ syncVersion: version });

      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const itemKey = `${productId}:${variantId || 'no-variant'}`;

      // Optimistic
      set((state) => {
        const newItems = state.items.filter((item) => {
          const isProductMatch = String(item.productId).toLowerCase().trim() === String(productId).toLowerCase().trim();
          const vId1 = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
          const vId2 = variantId ? String(variantId).toLowerCase().trim() : null;
          return !(isProductMatch && vId1 === vId2);
        });
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      setSyncing(itemKey, true);

      try {
        const response = await cartService.removeItem(productId, variantId);
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

        if (version >= get().lastAppliedVersion) {
          set((state) => ({
            items,
            totals,
            lastAppliedVersion: version,
            deliverySettings: deliverySettings ? {
              threshold: deliverySettings.threshold,
              charge: deliverySettings.charge
            } : state.deliverySettings
          }));
        }
      } catch (error) {
        set({ items: previousItems, totals: previousTotals });
        toast.error(getErrorMessage(error, i18n.t.bind(i18n), CartMessages.REMOVE_ERROR));
      } finally {
        setSyncing(itemKey, false);
      }
    },

    updateQuantity: async (productId, quantity, variantId) => {
      const itemKey = `${productId}:${variantId || 'no-variant'}`;

      // Debounce logic
      if (updateTimeouts[itemKey]) {
        clearTimeout(updateTimeouts[itemKey]);
      }

      // Optimistic Update (Immediate)
      set((state) => {
        const newItems = state.items.map((item) => {
          const isProductMatch = String(item.productId).toLowerCase().trim() === String(productId).toLowerCase().trim();
          const vId1 = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
          const vId2 = variantId ? String(variantId).toLowerCase().trim() : null;
          return (isProductMatch && vId1 === vId2) ? { ...item, quantity } : item;
        });
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      updateTimeouts[itemKey] = setTimeout(async () => {
        const version = get().syncVersion + 1;
        set({ syncVersion: version });

        const previousItems = [...get().items];
        const previousTotals = get().totals ? { ...get().totals! } : null;

        setSyncing(itemKey, true);

        try {
          const response = await cartService.updateItem(productId, quantity, variantId);
          const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

          if (version >= get().lastAppliedVersion) {
            set((state) => ({
              items,
              totals,
              lastAppliedVersion: version,
              deliverySettings: deliverySettings ? {
                threshold: deliverySettings.threshold,
                charge: deliverySettings.charge
              } : state.deliverySettings
            }));
          }
          delete updateTimeouts[itemKey];
        } catch (error: unknown) {
          set({ items: previousItems, totals: previousTotals });
          toast.error(getErrorMessage(error, i18n.t.bind(i18n), CartMessages.UPDATE_ERROR));
          delete updateTimeouts[itemKey];
        } finally {
          setSyncing(itemKey, false);
        }
      }, 400);
    },

    applyCoupon: async (code: string): Promise<boolean> => {
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      if (!isAuthenticated) {
        toast.error(i18n.t("errors.auth.loginRequired"));
        return false;
      }
      set({ isLoading: true, isCalculating: true });
      try {
        const response = await cartService.applyCoupon(code);
        const { items, totals } = CartDTO.fromResponse(response);

        // Coupons are global, so we always increment version
        const version = get().syncVersion + 1;
        set({
          items,
          totals,
          isLoading: false,
          isCalculating: false,
          syncVersion: version,
          lastAppliedVersion: version
        });
        toast.success(i18n.t("success.cart.couponApplied"));
        return true;
      } catch (error: unknown) {
        set({ isLoading: false, isCalculating: false });
        toast.error(getErrorMessage(error, i18n.t.bind(i18n), "errors.payment.invalidCoupon"));
        return false;
      }
    },

    removeCoupon: async () => {
      set({ isLoading: true, isCalculating: true });
      try {
        const response = await cartService.removeCoupon();
        const { items, totals } = CartDTO.fromResponse(response);
        const version = get().syncVersion + 1;
        set({
          items,
          totals,
          isLoading: false,
          isCalculating: false,
          syncVersion: version,
          lastAppliedVersion: version
        });
        toast.success(i18n.t("success.cart.couponRemoved"));
      } catch (error) {
        set({ isLoading: false, isCalculating: false });
        toast.error(getErrorMessage(error, i18n.t.bind(i18n), "errors.system.genericError"));
      }
    },

    clearCart: async () => {
      try {
        await cartService.clearCart();
        set({ items: [], totals: null, syncVersion: get().syncVersion + 1 });
      } catch (error) {
        logger.error("Error clearing cart:", error);
      }
    },

    getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
    getTotalPrice: () => get().totals?.finalAmount || 0,

    fetchDeliverySettings: async () => {
      try {
        const settings = await cartService.getDeliverySettings();
        set({
          deliverySettings: {
            threshold: settings.delivery_threshold,
            charge: settings.delivery_charge
          }
        });
      } catch (error) {
        logger.error("Failed to fetch delivery settings:", error);
      }
    }
  };
});
