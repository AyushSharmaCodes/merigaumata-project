import { logger } from "@/core/observability/logger";
import { create } from "zustand";
import { toast } from "@/shared/hooks/use-toast";
import axios from "axios";
import { getErrorMessage } from "@/core/utils/errorUtils";
import i18n from "@/app/i18n/config";

// Domain Imports
import { Product } from "@/domains/product";
import { cartApi } from "../api/cart.api";
import { CartItem, CartTotals } from "../model/cart.types";
import { CartDTO } from "../model/cart.dto";

// Cross-Domain Imports (Auth)
// In a pure clean architecture, we might use an application layer or event bus, 
// but for now, direct store access is allowed for Auth/User.
import { useAuthStore } from "@/domains/auth"; 
import { getGuestId } from "@/shared/lib/guest-id";
import { CartMessages } from "@/shared/constants/messages/CartMessages";

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
  resetCart: () => void;
  getTotalItems: () => number;
  getTotalPrice: () => number;
  fetchDeliverySettings: () => Promise<void>;
  isItemSyncing: (productId: string, variantId?: string) => boolean;
}

const updateTimeouts: Record<string, NodeJS.Timeout> = {};
const syncTimeouts: Record<string, NodeJS.Timeout> = {};
const inFlightRequests: Record<string, number> = {};
let settingsPollingInterval: any = null;
const SETTINGS_POLL_INTERVAL_MS = 60_000;

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

let logoutHandler: (() => void) | null = null;

export const useCartStore = create<CartState>()((set, get) => {

  const setSyncing = (itemKey: string, isSyncing: boolean) => {
    if (isSyncing) {
      inFlightRequests[itemKey] = (inFlightRequests[itemKey] || 0) + 1;
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

  if (typeof window !== "undefined") {
    if (logoutHandler) {
      window.removeEventListener("auth:logout", logoutHandler);
    }
    logoutHandler = () => {
      logger.info("[CartStore] Resetting cart on logout");
      get().resetCart();
    };
    window.addEventListener("auth:logout", logoutHandler);
  }

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

    resetCart: () => {
      set({
        items: [],
        totals: null,
        syncVersion: get().syncVersion + 1,
        lastAppliedVersion: 0,
        initialized: false
      });
    },

    fetchCart: async (force = false) => {
      if (get().initialized && !force) return;
      getGuestId();

      const state = get();
      if (!state.initialized && typeof window !== "undefined") {
        if (!settingsPollingInterval) {
          settingsPollingInterval = window.setInterval(() => {
            get().fetchDeliverySettings();
          }, SETTINGS_POLL_INTERVAL_MS);
        }
      }

      set({ isLoading: true });
      try {
        const response = await cartApi.getCart();
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

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
          toast({
            title: i18n.t("common.error"),
            description: getErrorMessage(error, i18n.t.bind(i18n), "errors.system.genericError"),
            variant: "destructive",
          });
        }
      }
    },

    addItem: async (product, quantity = 1, variantId) => {
      const version = get().syncVersion + 1;
      set({ syncVersion: version });

      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const itemKey = `${product.id}:${variantId || 'no-variant'}`;

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
          } as CartItem];
        }
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      setSyncing(itemKey, true);

      try {
        const response = await cartApi.addItem(product.id, variantId, quantity);
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
        toast({
          title: i18n.t("common.error"),
          description: getErrorMessage(error, i18n.t.bind(i18n), "errors.system.genericError"),
          variant: "destructive",
        });
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
        const response = await cartApi.removeItem(productId, variantId);
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
        toast({
          title: i18n.t("common.error"),
          description: getErrorMessage(error, i18n.t.bind(i18n), CartMessages.REMOVE_ERROR),
          variant: "destructive",
        });
      } finally {
        setSyncing(itemKey, false);
      }
    },

    updateQuantity: async (productId, quantity, variantId) => {
      const itemKey = `${productId}:${variantId || 'no-variant'}`;
      if (updateTimeouts[itemKey]) {
        clearTimeout(updateTimeouts[itemKey]);
      }

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
          const response = await cartApi.updateQuantity(productId, variantId, quantity);
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
          toast({
            title: i18n.t("common.error"),
            description: getErrorMessage(error, i18n.t.bind(i18n), CartMessages.UPDATE_ERROR),
            variant: "destructive",
          });
          delete updateTimeouts[itemKey];
        } finally {
          setSyncing(itemKey, false);
        }
      }, 400);
    },

    applyCoupon: async (code: string): Promise<boolean> => {
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      if (!isAuthenticated) {
        toast({
          title: i18n.t("common.error"),
          description: i18n.t("errors.auth.loginRequired"),
          variant: "destructive",
        });
        return false;
      }
      set({ isLoading: true, isCalculating: true });
      try {
        const response = await cartApi.applyCoupon(code);
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
        toast({
          title: i18n.t("common.success"),
          description: i18n.t("success.cart.couponApplied"),
        });
        return true;
      } catch (error: unknown) {
        set({ isLoading: false, isCalculating: false });
        toast({
          title: i18n.t("common.error"),
          description: getErrorMessage(error, i18n.t.bind(i18n), "errors.payment.invalidCoupon"),
          variant: "destructive",
        });
        return false;
      }
    },

    removeCoupon: async () => {
      set({ isLoading: true, isCalculating: true });
      try {
        const response = await cartApi.removeCoupon();
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
        toast({
          title: i18n.t("common.success"),
          description: i18n.t("success.cart.couponRemoved"),
        });
      } catch (error) {
        set({ isLoading: false, isCalculating: false });
        toast({
          title: i18n.t("common.error"),
          description: getErrorMessage(error, i18n.t.bind(i18n), "errors.system.genericError"),
          variant: "destructive",
        });
      }
    },

    clearCart: async () => {
      try {
        await cartApi.clearCart();
        set({ items: [], totals: null, syncVersion: get().syncVersion + 1 });
      } catch (error) {
        logger.error("Error clearing cart:", error);
      }
    },

    getTotalItems: () => get().items.reduce((total, item) => total + item.quantity, 0),
    getTotalPrice: () => get().totals?.finalAmount || 0,

    fetchDeliverySettings: async () => {
        // This is a bit of a cross-domain leak but let's keep it for now
        // Ideally should be in a settings domain
        try {
            const response = await axios.get('/settings/delivery');
            const settings = response.data;
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
