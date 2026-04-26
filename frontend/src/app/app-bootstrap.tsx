import { useEffect } from "react";
import { useAuthStore } from "@/domains/auth";
import { useCartStore } from "@/domains/cart";
import { useLocationStore } from "@/core/store/location.store";
import { logger } from "@/core/observability/logger";
import { scheduleBackgroundTask } from "@/core/observability/observability";
import CacheHelper from "@/core/utils/cacheHelper";

export const AppBootstrap = () => {
  const initializeAuth = useAuthStore((state) => state.initializeAuth);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const fetchCart = useCartStore((state) => state.fetchCart);

  useEffect(() => {
    if (isAuthenticated) {
      void fetchCart(true);
    }
  }, [isAuthenticated, fetchCart]);

  useEffect(() => {
    const cleanupTasks: Array<() => void> = [];
    const currentPath = window.location.pathname;
    const shouldWarmCartImmediately = [
      "/cart",
      "/checkout",
      "/order-summary",
      "/order-confirmation",
      "/my-orders",
      "/profile",
    ].some((path) => currentPath.startsWith(path));

    if (window.location.pathname === '/auth/callback') {
      return;
    }

    initializeAuth();

    cleanupTasks.push(
      scheduleBackgroundTask(() => {
        void useLocationStore.getState().initializeStore();
      }, { timeout: 2000 })
    );

    CacheHelper.initPageReloadHandler(true);

    const warmCart = () => {
      void useCartStore.getState().fetchCart().catch((error) => {
        logger.warn("Deferred cart bootstrap failed", { err: error });
      });
    };

    if (shouldWarmCartImmediately) {
      warmCart();
    } else {
      cleanupTasks.push(
        scheduleBackgroundTask(warmCart, { timeout: 1200 })
      );
    }

    return () => {
      cleanupTasks.forEach((cleanup) => cleanup());
    };
  }, [initializeAuth]);

  return null;
};
