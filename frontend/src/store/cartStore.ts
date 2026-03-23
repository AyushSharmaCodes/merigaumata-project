import { logger } from "@/lib/logger";
import { create } from "zustand";
import { CartItem, Product, CartTotals } from "@/types";
import { cartService } from "@/services/cart.service";
import { couponService } from "@/services/coupon.service";
import { toast } from "sonner";
import { CartDTO } from "@/lib/dto/cart.dto";
import axios from "axios";
import { getErrorMessage } from "@/lib/errorUtils";
import { useAuthStore } from "./authStore";
import { getGuestId } from "@/lib/guestId";

interface CartState {
  items: CartItem[];
  totals: CartTotals | null;
  isLoading: boolean;
  isCalculating: boolean; // True when price/coupon calculation is in progress
  initialized: boolean;
  deliverySettings: { threshold: number; charge: number };

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
}

// Module-level variables to track timeouts, action queue, and pending requests
const updateTimeouts: Record<string, NodeJS.Timeout> = {};
let actionQueue: Promise<void> = Promise.resolve();
let pendingRequests = 0;

// Helper to calculate totals optimistically
const calculateOptimisticTotals = (items: CartItem[], currentTotals: CartTotals | null): CartTotals => {
  const itemsCount = items.reduce((acc, item) => acc + item.quantity, 0);
  const totalMrp = items.reduce((acc, item) => {
    const mrp = item.variant?.mrp ?? item.product.mrp ?? item.product.price;
    return acc + (mrp * item.quantity);
  }, 0);
  const totalPrice = items.reduce((acc, item) => {
    const price = item.variant?.selling_price ?? item.product.price;
    return acc + (price * item.quantity);
  }, 0);

  // Apply delivery charge threshold from dynamic settings
  const { threshold, charge } = useCartStore.getState().deliverySettings;

  // Calculate product-specific delivery charges (once per unique product)
  let productDeliveryCharges = 0;
  const processedProducts = new Set<string>();

  items.forEach(item => {
    if (!processedProducts.has(item.productId)) {
      const charge = item.product.delivery_charge || 0;
      productDeliveryCharges += charge;
      processedProducts.add(item.productId);
    }
  });

  const globalDeliveryCharge = totalPrice >= threshold ? 0 : charge;
  const deliveryCharge = productDeliveryCharges + globalDeliveryCharge;

  // Recalculate coupon discount if percentage-based coupon is applied
  const coupon = currentTotals?.coupon || null;
  let couponDiscount = 0;

  if (coupon && coupon.discount_percentage) {
    // For percentage-based coupons, recalculate discount proportionally
    let eligibleAmount = totalPrice;

    // For product/variant/category coupons, calculate eligible portion
    if (coupon.type === 'product' && coupon.target_id) {
      eligibleAmount = items
        .filter(item => item.productId === coupon.target_id)
        .reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    } else if (coupon.type === 'variant' && coupon.target_id) {
      eligibleAmount = items
        .filter(item => item.variantId === coupon.target_id)
        .reduce((acc, item) => acc + item.product.price * item.quantity, 0);
    }
    // For 'cart' type, eligibleAmount is already totalPrice

    couponDiscount = eligibleAmount * (coupon.discount_percentage / 100);

    // Apply max discount cap if exists
    if (coupon.max_discount_amount && couponDiscount > coupon.max_discount_amount) {
      couponDiscount = coupon.max_discount_amount;
    }

    couponDiscount = Math.round(couponDiscount * 100) / 100;
  } else if (currentTotals?.couponDiscount) {
    // For flat amount coupons, keep the existing discount
    couponDiscount = currentTotals.couponDiscount;
  }

  const discount = totalMrp - totalPrice;
  const finalAmount = totalPrice + deliveryCharge - couponDiscount;

  return {
    itemsCount,
    totalMrp,
    totalPrice,
    discount,
    couponDiscount,
    deliveryCharge,
    productDeliveryCharges,
    globalDeliveryCharge,
    finalAmount,
    coupon,
    itemBreakdown: (() => {
      const seen = new Set<string>();
      return items.map(item => {
        const showCharge = !seen.has(item.productId);
        seen.add(item.productId);
        return {
          product_id: item.productId,
          variant_id: item.variantId,
          delivery_charge: showCharge ? (item.product.delivery_charge || 0) : 0,
          coupon_discount: 0
        };
      });
    })()
  };
};

export const useCartStore = create<CartState>()((set, get) => {
  // Helper to append actions to the queue with coordination
  const queueAction = (action: () => Promise<void>) => {
    pendingRequests++;
    actionQueue = actionQueue
      .then(action)
      .finally(() => {
        pendingRequests--;
      })
      .catch((error) => {
        logger.error("Cart action failed in queue:", error);
      });
    return actionQueue;
  };

  return {
    items: [],
    totals: null,
    isLoading: false,
    isCalculating: false,
    initialized: false,
    deliverySettings: { threshold: 1500, charge: 50 }, // Default values

    fetchCart: async (force = false) => {
      // Don't overwrite if we have pending mutations or if already initialized (unless forced)
      if (pendingRequests > 0 || (get().initialized && !force)) return;

      // Ensure guest ID exists
      getGuestId();

      set({ isLoading: true });
      try {
        const response = await cartService.getCart();
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

        // Coordination: Only apply if no requests were started while we were fetching
        if (pendingRequests === 0) {
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
        }
      } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          set({ items: [], totals: null, initialized: true, isLoading: false });
        } else {
          logger.error("Error fetching cart:", error);
          set({ isLoading: false });
          toast.error("Failed to load cart");
        }
      }
    },

    addItem: async (product, quantity = 1, variantId) => {
      // 1. Optimistic Update (Immediate)
      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;

      // Find variant if variantId is provided
      const variant = variantId && product.variants
        ? product.variants.find(v => v.id === variantId)
        : undefined;

      set((state) => {
        // Match by productId AND variantId (treating null/undefined as same)
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

      // 2. Queue the Backend Sync
      return queueAction(async () => {
        try {
          const response = await cartService.addItem(product.id, quantity, variantId);
          const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

          if (pendingRequests === 1) {
            set((state) => ({
              items,
              totals,
              deliverySettings: deliverySettings ? {
                threshold: deliverySettings.threshold,
                charge: deliverySettings.charge
              } : state.deliverySettings
            }));
          }
        } catch (error: unknown) {
          await get().fetchCart();
          const isAuthenticated = useAuthStore.getState().isAuthenticated;

          if (axios.isAxiosError(error) && error.response?.status === 401) {
            if (isAuthenticated) {
              toast.error("Please login to add items to cart");
            }
            // Guest users: suppress the toast
          } else {
            toast.error("Failed to add to cart");
          }
          throw error;
        }
      });
    },

    removeItem: async (productId, variantId) => {
      // 1. Optimistic Update
      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const removedItem = previousItems.find(item => {
        const isProductMatch = String(item.productId).toLowerCase().trim() === String(productId).toLowerCase().trim();
        const vId1 = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
        const vId2 = variantId ? String(variantId).toLowerCase().trim() : null;
        return isProductMatch && vId1 === vId2;
      });

      if (!removedItem) return;

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

      // 2. Queue the Backend Sync
      return queueAction(async () => {
        try {
          const response = await cartService.removeItem(productId, variantId);
          const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

          if (pendingRequests === 1) {
            set((state) => ({
              items,
              totals,
              deliverySettings: deliverySettings ? {
                threshold: deliverySettings.threshold,
                charge: deliverySettings.charge
              } : state.deliverySettings
            }));
          }
        } catch (error) {
          await get().fetchCart();
          const isAuthenticated = useAuthStore.getState().isAuthenticated;

          if (axios.isAxiosError(error) && error.response?.status === 401) {
            if (isAuthenticated) {
              toast.error("Please login to remove items");
            }
            // Guest users: suppress the toast
          } else {
            toast.error("Failed to remove item");
          }
        }
      });
    },

    updateQuantity: async (productId, quantity, variantId) => {
      // 1. Optimistic Update
      const previousItems = [...get().items];
      const previousTotals = get().totals ? { ...get().totals! } : null;
      const itemToUpdate = previousItems.find(item => {
        const isProductMatch = String(item.productId).toLowerCase().trim() === String(productId).toLowerCase().trim();
        const vId1 = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
        const vId2 = variantId ? String(variantId).toLowerCase().trim() : null;
        return isProductMatch && vId1 === vId2;
      });

      if (!itemToUpdate) return;
      const quantityDiff = quantity - itemToUpdate.quantity;
      const itemKey = `${productId}:${variantId || 'no-variant'}`;

      set((state) => {
        const newItems = state.items.map((item) => {
          const isProductMatch = String(item.productId).toLowerCase().trim() === String(productId).toLowerCase().trim();
          const vId1 = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
          const vId2 = variantId ? String(variantId).toLowerCase().trim() : null;

          return (isProductMatch && vId1 === vId2)
            ? { ...item, quantity }
            : item;
        });
        return {
          items: newItems,
          totals: calculateOptimisticTotals(newItems, state.totals)
        };
      });

      // 2. Debounce + Queue Action
      if (updateTimeouts[itemKey]) {
        clearTimeout(updateTimeouts[itemKey]);
      }

      // Set calculating state when debounce starts
      set({ isCalculating: true });

      updateTimeouts[itemKey] = setTimeout(() => {
        queueAction(async () => {
          try {
            const response = await cartService.updateItem(productId, quantity, variantId);
            const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

            if (pendingRequests === 1) {
              set((state) => ({
                items,
                totals,
                isCalculating: false,
                deliverySettings: deliverySettings ? {
                  threshold: deliverySettings.threshold,
                  charge: deliverySettings.charge
                } : state.deliverySettings
              }));
            }
            delete updateTimeouts[itemKey];
          } catch (error: unknown) {
            set({ isCalculating: false });
            await get().fetchCart();
            const isAuthenticated = useAuthStore.getState().isAuthenticated;

            if (axios.isAxiosError(error) && error.response?.status === 401) {
              if (isAuthenticated) {
                toast.error("Please login to update quantity");
              }
              // Guest users: suppress the toast
            } else {
              toast.error("Failed to update cart");
            }
            delete updateTimeouts[itemKey];
          }
        });
      }, 300);
    },

    applyCoupon: async (code: string): Promise<boolean> => {
      const isAuthenticated = useAuthStore.getState().isAuthenticated;
      if (!isAuthenticated) {
        toast.error("Please login to apply the coupon codes");
        return false;
      }

      set({ isLoading: true, isCalculating: true });
      try {
        const response = await cartService.applyCoupon(code);
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

        set((state) => ({
          items,
          totals,
          isLoading: false,
          isCalculating: false,
          deliverySettings: deliverySettings ? {
            threshold: deliverySettings.threshold,
            charge: deliverySettings.charge
          } : state.deliverySettings
        }));
        toast.success("Coupon applied successfully");
        return true;
      } catch (error: unknown) {
        set({ isLoading: false, isCalculating: false });
        const errorMessage = getErrorMessage(error, undefined, "Invalid coupon code");
        toast.error(errorMessage);
        return false;
      }
    },

    removeCoupon: async () => {
      set({ isLoading: true, isCalculating: true });
      try {
        const response = await cartService.removeCoupon();
        const { items, totals, deliverySettings } = CartDTO.fromResponse(response);

        set((state) => ({
          items,
          totals,
          isLoading: false,
          isCalculating: false,
          deliverySettings: deliverySettings ? {
            threshold: deliverySettings.threshold,
            charge: deliverySettings.charge
          } : state.deliverySettings
        }));
        toast.success("Coupon removed");
      } catch (error) {
        set({ isLoading: false, isCalculating: false });
        toast.error("Failed to remove coupon");
      }
    },

    clearCart: async () => {
      try {
        await cartService.clearCart();
        set({ items: [], totals: null });
      } catch (error) {
        logger.error("Error clearing cart:", error);
      }
    },

    getTotalItems: () => {
      const state = get();
      return state.items.reduce((total, item) => total + item.quantity, 0);
    },

    getTotalPrice: () => {
      const state = get();
      return state.totals?.finalAmount || 0;
    },

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
