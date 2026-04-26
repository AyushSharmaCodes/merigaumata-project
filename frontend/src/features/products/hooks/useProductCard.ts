import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useShallow } from "zustand/react/shallow";
import { Product } from "@/shared/types";
import { useCartStore } from "@/domains/cart";
import { useToast } from "@/shared/hooks/use-toast";
import { getLocalizedContent } from "@/core/utils/localizationUtils";

interface UseProductCardProps {
  product: Product;
}

export const useProductCard = ({ product }: UseProductCardProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const { addItem, items, updateQuantity, removeItem } = useCartStore(
    useShallow((state) => ({
      addItem: state.addItem,
      items: state.items,
      updateQuantity: state.updateQuantity,
      removeItem: state.removeItem,
    }))
  );

  const localizedTitle = getLocalizedContent(product, i18n.language, "title");
  const expectedVariantId = product.variants?.[0]?.id;

  const normalizedProductId = String(product.id).toLowerCase().trim();
  const normalizedExpectedVariantId = expectedVariantId
    ? String(expectedVariantId).toLowerCase().trim()
    : null;

  const specificCartItem = useMemo(
    () =>
      items.find((item) => {
        const isProductMatch =
          String(item.productId).toLowerCase().trim() === normalizedProductId;
        const vId = item.variantId
          ? String(item.variantId).toLowerCase().trim()
          : null;
        return isProductMatch && vId === normalizedExpectedVariantId;
      }),
    [items, normalizedProductId, normalizedExpectedVariantId]
  );

  const specificQuantity = specificCartItem?.quantity || 0;

  const totalProductQuantity = useMemo(() => {
    const allProductItems = items.filter(
      (item) =>
        String(item.productId).toLowerCase().trim() === normalizedProductId
    );
    return allProductItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [items, normalizedProductId]);

  const hasMultipleVariants = product.variants && product.variants.length > 1;

  const effectiveStock =
    product.variants && product.variants.length > 0
      ? product.variants[0].stock_quantity
      : product.inventory;

  const handleAddToCart = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (hasMultipleVariants) {
        navigate(`/product/${product.id}`);
        return;
      }

      const variantId = product.variants?.[0]?.id;
      try {
        await addItem(product, 1, variantId);
        toast({
          title: t("common.success"),
          description: t("success.cart.added", { product: localizedTitle }),
        });
      } catch (error) {
        // Store handles failure toast
      }
    },
    [addItem, hasMultipleVariants, navigate, product, localizedTitle, t, toast]
  );

  const handleIncreaseQuantity = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      updateQuantity(product.id, specificQuantity + 1, expectedVariantId);
    },
    [updateQuantity, product.id, specificQuantity, expectedVariantId]
  );

  const handleDecreaseQuantity = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (specificQuantity > 1) {
        updateQuantity(product.id, specificQuantity - 1, expectedVariantId);
      } else {
        removeItem(product.id, expectedVariantId);
        toast({
          title: t("common.success"),
          description: t("success.cart.removed", { product: localizedTitle }),
        });
      }
    },
    [
      removeItem,
      updateQuantity,
      product.id,
      specificQuantity,
      expectedVariantId,
      t,
      localizedTitle,
      toast,
    ]
  );

  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  return {
    t,
    i18n,
    navigate,
    specificQuantity,
    totalProductQuantity,
    hasMultipleVariants,
    effectiveStock,
    localizedTitle,
    handleAddToCart,
    handleIncreaseQuantity,
    handleDecreaseQuantity,
    calculateDiscount,
  };
};
