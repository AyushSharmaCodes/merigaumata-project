import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useCartStore } from "@/domains/cart";
import { useAuthStore } from "@/domains/auth";
import { useToast } from "@/shared/hooks/use-toast";
import { useUIStore } from "@/core/store/ui.store";
import { logger } from "@/core/observability/logger";
import { CartMessages } from "@/shared/constants/messages/CartMessages";
import { ProductMessages } from "@/shared/constants/messages/ProductMessages";
import type { Product, ProductVariant } from "@/domains/product";
import { getLocalizedContent } from "@/core/utils/localizationUtils";

interface UseProductActionsParams {
  product: Product;
  selectedVariant: ProductVariant | null;
  localizedTitle: string;
}

export function useProductActions({ product, selectedVariant, localizedTitle }: UseProductActionsParams) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const { user } = useAuthStore();
  const setBlocking = useUIStore((state) => state.setBlocking);

  const [isBuying, setIsBuying] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const cartItem = useMemo(
    () =>
      items.find((item) => {
        const isProductMatch = String(item.productId) === String(product.id);
        const isVariantMatch = (item.variantId || null) === (selectedVariant?.id || null);
        return isProductMatch && isVariantMatch;
      }),
    [items, product.id, selectedVariant?.id]
  );

  const quantity = cartItem?.quantity || 0;

  const handleAddToCart = useCallback(async () => {
    setIsAdding(true);
    try {
      await addItem(product, 1, selectedVariant?.id);
      const localizedSizeLabel = selectedVariant
        ? ` (${getLocalizedContent(selectedVariant, i18n.language, "size_label")})`
        : "";
      toast({
        title: t("common.success"),
        description: t(CartMessages.ADDED, { product: `${localizedTitle}${localizedSizeLabel}` }),
      });
    } catch (error) {
      logger.error("Add to cart failed", { err: error });
    } finally {
      setIsAdding(false);
    }
  }, [addItem, i18n.language, localizedTitle, product, selectedVariant, t, toast]);

  const handleBuyNow = useCallback(async () => {
    setIsBuying(true);
    setBlocking(true);

    try {
      if (!user) {
        toast({
          title: t("common.error"),
          description: t(ProductMessages.LOGIN_TO_CONTINUE),
        });
        return;
      }

      if (!user.email || user.email.trim() === "") {
        toast({
          title: t("common.error"),
          description: t(ProductMessages.EMAIL_NEEDED_DESC),
          variant: "destructive",
        });
        return;
      }

      navigate("/checkout", {
        state: {
          buyNowItem: {
            product,
            quantity: 1,
            variantId: selectedVariant?.id,
          },
        },
      });
    } catch (error) {
      logger.error("Buy now navigation failed", { err: error });
    } finally {
      setIsBuying(false);
      setBlocking(false);
    }
  }, [navigate, product, selectedVariant?.id, setBlocking, t, toast, user]);

  const handleIncreaseQuantity = useCallback(async () => {
    try {
      if (cartItem) {
        await updateQuantity(product.id, quantity + 1, selectedVariant?.id);
      } else {
        await addItem(product, 1, selectedVariant?.id);
      }
    } catch {
      // noop: UI state is optimistic and cart store already handles toasts
    }
  }, [addItem, cartItem, product, quantity, selectedVariant?.id, updateQuantity]);

  const handleDecreaseQuantity = useCallback(async () => {
    if (!cartItem) return;

    try {
      if (quantity > 1) {
        await updateQuantity(product.id, quantity - 1, selectedVariant?.id);
        return;
      }

      await removeItem(product.id, selectedVariant?.id);
      toast({
        title: t("common.success"),
        description: t(CartMessages.REMOVED, { product: localizedTitle }),
      });
    } catch {
      // noop: cart store handles core error cases
    }
  }, [cartItem, localizedTitle, product.id, quantity, removeItem, selectedVariant?.id, t, toast, updateQuantity]);

  return {
    quantity,
    isBuying,
    isAdding,
    handleAddToCart,
    handleBuyNow,
    handleIncreaseQuantity,
    handleDecreaseQuantity,
  };
}
