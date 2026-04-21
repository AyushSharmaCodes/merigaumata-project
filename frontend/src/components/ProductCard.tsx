import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { getLocalizedTags } from '@/utils/tagUtils';
import { Star, Eye, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "@/components/ui/Tag";
import { Product } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { useToast } from "@/hooks/use-toast";
import { AVAILABLE_TAGS } from "@/constants/productConstants";
import { useCurrency } from "@/contexts/CurrencyContext";
import React, { memo, useCallback, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { stripHtml } from "@/utils/stringUtils";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  showAddToCart?: boolean;
  className?: string;
}

export const ProductCard = memo(({
  product,
  onQuickView,
  showAddToCart = true,
  className = "",
}: ProductCardProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  // Atomic subscription to cart actions and items slice
  const { addItem, items, updateQuantity, removeItem } = useCartStore(useShallow(state => ({
    addItem: state.addItem,
    items: state.items,
    updateQuantity: state.updateQuantity,
    removeItem: state.removeItem
  })));
  const { formatAmount } = useCurrency();
  const { toast } = useToast();
  const localizedTitle = getLocalizedContent(product, i18n.language, 'title');

  // Get the expected variantId for single-variant products
  const expectedVariantId = product.variants?.[0]?.id;

  // Normalize IDs for comparison
  const normalizedProductId = String(product.id).toLowerCase().trim();
  const normalizedExpectedVariantId = expectedVariantId ? String(expectedVariantId).toLowerCase().trim() : null;

  // 1. Find specific cart item (for single-variant controls)
  const specificCartItem = useMemo(() => items.find((item) => {
    const isProductMatch = String(item.productId).toLowerCase().trim() === normalizedProductId;
    const vId = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
    return isProductMatch && vId === normalizedExpectedVariantId;
  }), [items, normalizedProductId, normalizedExpectedVariantId]);
  const specificQuantity = specificCartItem?.quantity || 0;

  // 2. Find ALL items for this product (for total count badge/indicator)
  const totalProductQuantity = useMemo(() => {
    const allProductItems = items.filter((item) =>
      String(item.productId).toLowerCase().trim() === normalizedProductId
    );
    return allProductItems.reduce((acc, item) => acc + item.quantity, 0);
  }, [items, normalizedProductId]);

  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  // Check if product has multiple variants
  const hasMultipleVariants = product.variants && product.variants.length > 1;

  // Get effective stock (uses default variant or product inventory)
  const effectiveStock = product.variants && product.variants.length > 0
    ? product.variants[0].stock_quantity
    : product.inventory;

  const handleAddToCart = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For multi-variant products, navigate to PDP for variant selection
    if (hasMultipleVariants) {
      navigate(`/product/${product.id}`);
      return;
    }

    // For single-variant or no-variant products, add directly
    const variantId = product.variants?.[0]?.id;
    try {
      await addItem(product, 1, variantId);
      toast({
        title: t("common.success"),
        description: t("success.cart.added", { product: localizedTitle }),
      });
    } catch (error) {
      // Store handles failure toast and rollback
    }
  }, [addItem, hasMultipleVariants, navigate, product, localizedTitle, t, toast]);

  const handleIncreaseQuantity = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, specificQuantity + 1, expectedVariantId);
  }, [updateQuantity, product.id, specificQuantity, expectedVariantId]);

  const handleDecreaseQuantity = useCallback((e: React.MouseEvent) => {
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
  }, [removeItem, updateQuantity, product.id, specificQuantity, expectedVariantId, t, localizedTitle, toast]);

  const handleQuickView = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    }
  }, [onQuickView, product]);

  // Use centralized tag localization
  const allLocalizedTags = getLocalizedTags(product, i18n.language);

  return (
    <Link to={`/product/${product.id}`} className="block h-full">
      <Card
        className={`group cursor-pointer shadow-soft hover:shadow-elevated hover:-translate-y-2 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] h-full flex flex-col border-none bg-white rounded-[2rem] overflow-hidden isolate promote-gpu ${className}`}
      >
        <div className="relative overflow-hidden aspect-square rounded-t-[2rem]">
          <img
            src={product.images[0]}
            alt={localizedTitle}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 promote-gpu"
            style={{ backfaceVisibility: 'hidden' }}
          />

          {/* Premium Overlays */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Action Buttons Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
            {onQuickView && (
              <Button
                onClick={handleQuickView}
                size="icon"
                className="h-10 w-10 rounded-full bg-white text-foreground hover:bg-primary hover:text-background shadow-lg border-none"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>

          {(product.isNew || product.is_new) && (
            <div className="absolute top-4 left-4 z-10">
              <span className="bg-gradient-to-r from-primary to-primary/80 backdrop-blur-md text-primary-foreground text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full shadow-xl border border-white/20 animate-in fade-in zoom-in duration-500">
                {t("products.new")}
              </span>
            </div>
          )}

          {allLocalizedTags.length > 0 && (
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-1 max-w-[80%] z-10 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
              {allLocalizedTags.slice(0, 2).map((tag) => (
                <span key={tag} className="bg-white/95 backdrop-blur-sm text-foreground text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md shadow-sm">
                  {AVAILABLE_TAGS.includes(tag.toLowerCase()) ? t(`products.tags.${tag.toLowerCase()}`) : tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-grow flex flex-col gap-2">
          <div className="space-y-1">
            <h3 className="font-playfair text-lg font-bold text-foreground line-clamp-1 group-hover:text-primary transition-colors duration-500">
              {getLocalizedContent(product, i18n.language, 'title')}
            </h3>
            <p className="text-[11px] text-muted-foreground line-clamp-2 font-light leading-relaxed">
              {stripHtml(getLocalizedContent(product, i18n.language, 'description'))}
            </p>
          </div>

          <div className="mt-auto pt-1">
            <div className="flex items-center justify-between">
              <div className="space-y-0">
                <p className="text-lg font-bold text-foreground">
                  {formatAmount(product.price)}
                  {product.default_tax_applicable && product.default_price_includes_tax === false && (
                    <span className="text-[10px] font-normal text-muted-foreground ml-1">{t("products.taxPlus")}</span>
                  )}
                </p>
                {product.mrp && product.mrp > product.price && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground/60 line-through font-light">
                      {formatAmount(product.mrp)}
                    </span>
                    <span className="text-[9px] font-black text-primary uppercase tracking-tighter">
                      {t("products.save")} {calculateDiscount(product.mrp, product.price)}%
                    </span>
                  </div>
                )}
              </div>

              {Number(product.reviewCount) > 0 && (
                <div className="flex items-center gap-1.5 bg-brand-amber/5 hover:bg-brand-amber/10 px-2 py-0.5 rounded-full border border-brand-amber/20 transition-colors duration-300">
                  <Star className="h-3 w-3 fill-brand-amber text-brand-amber" />
                  <span className="text-[10px] font-bold text-foreground">
                    {Number(product.rating || 0).toFixed(1)}
                    <span className="mx-1 text-foreground/40 font-normal">|</span>
                    <span className="text-foreground/60">{product.reviewCount}</span>
                  </span>
                </div>
              )}
            </div>
          </div>
        </CardContent>

        {showAddToCart && (
          <CardFooter className="p-4 pt-0 mt-auto flex flex-col gap-1.5">
            {/* Logic for Multi-Variant Products */}
            {hasMultipleVariants ? (
              totalProductQuantity > 0 ? (
                <Button
                  variant="secondary"
                  className="w-full h-9 text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    navigate("/cart");
                  }}
                >
                  {t("products.viewInCart")} ({totalProductQuantity})
                </Button>
              ) : (
                <Button
                  variant="default"
                  className="w-full h-9 text-xs"
                  onClick={handleAddToCart}
                  disabled={!effectiveStock || effectiveStock === 0}
                >
                  {!effectiveStock || effectiveStock === 0
                    ? t("products.outOfStock")
                    : t("products.selectOptions")}
                </Button>
              )
            ) : (
              /* Logic for Single/No Variant Products */
              specificQuantity > 0 ? (
                <>
                  <div className="flex items-center gap-2 w-full">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleDecreaseQuantity}
                      className="h-8 w-8"
                    >
                      <span className="sr-only">{t("products.decrease")}</span>
                      <Minus className="h-3 w-3" />
                    </Button>
                    <span className="flex-1 text-center font-bold text-sm">
                      {specificQuantity}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleIncreaseQuantity}
                      className="h-8 w-8"
                      disabled={
                        effectiveStock !== undefined &&
                        specificQuantity >= effectiveStock
                      }
                    >
                      <span className="sr-only">{t("products.increase")}</span>
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    className="w-full text-[10px] h-7"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate("/cart");
                    }}
                  >
                    {t("cart.goToCart")}
                  </Button>
                </>
              ) : (
                <Button
                  variant="default"
                  className="w-full h-9 text-xs"
                  onClick={handleAddToCart}
                  disabled={!effectiveStock || effectiveStock === 0}
                >
                  {!effectiveStock || effectiveStock === 0
                    ? t("products.outOfStock")
                    : t("products.addToCart")}
                </Button>
              )
            )
            }
          </CardFooter>
        )}
      </Card>
    </Link>
  );
});
ProductCard.displayName = "ProductCard";
