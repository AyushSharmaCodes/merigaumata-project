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
import { toast } from "sonner";
import { AVAILABLE_TAGS } from "@/constants/productConstants";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductCardProps {
  product: Product;
  onQuickView?: (product: Product) => void;
  showAddToCart?: boolean;
  className?: string;
}

export const ProductCard = ({
  product,
  onQuickView,
  showAddToCart = true,
  className = "",
}: ProductCardProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const { formatAmount } = useCurrency();

  // Get the expected variantId for single-variant products
  const expectedVariantId = product.variants?.[0]?.id;

  // Normalize IDs for comparison
  const normalizedProductId = String(product.id).toLowerCase().trim();
  const normalizedExpectedVariantId = expectedVariantId ? String(expectedVariantId).toLowerCase().trim() : null;

  // 1. Find specific cart item (for single-variant controls)
  const specificCartItem = items.find((item) => {
    const isProductMatch = String(item.productId).toLowerCase().trim() === normalizedProductId;
    const vId = item.variantId ? String(item.variantId).toLowerCase().trim() : null;
    return isProductMatch && vId === normalizedExpectedVariantId;
  });
  const specificQuantity = specificCartItem?.quantity || 0;

  // 2. Find ALL items for this product (for total count badge/indicator)
  const allProductItems = items.filter((item) =>
    String(item.productId).toLowerCase().trim() === normalizedProductId
  );
  const totalProductQuantity = allProductItems.reduce((acc, item) => acc + item.quantity, 0);

  const calculateDiscount = (mrp: number, price: number) => {
    return Math.round(((mrp - price) / mrp) * 100);
  };

  // Check if product has multiple variants
  const hasMultipleVariants = product.variants && product.variants.length > 1;

  // Get effective stock (uses default variant or product inventory)
  const effectiveStock = product.variants && product.variants.length > 0
    ? product.variants[0].stock_quantity
    : product.inventory;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // For multi-variant products, navigate to PDP for variant selection
    if (hasMultipleVariants) {
      navigate(`/product/${product.id}`);
      return;
    }

    // For single-variant or no-variant products, add directly
    const variantId = product.variants?.[0]?.id;
    addItem(product, 1, variantId);
    toast.success(t("success.cart.added", { product: product.title }));
  };

  const handleIncreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateQuantity(product.id, specificQuantity + 1, expectedVariantId);
  };

  const handleDecreaseQuantity = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (specificQuantity > 1) {
      updateQuantity(product.id, specificQuantity - 1, expectedVariantId);
    } else {
      removeItem(product.id, expectedVariantId);
      toast.success(t("success.cart.removed", { product: product.title }));
    }
  };

  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) {
      onQuickView(product);
    }
  };

  // Use centralized tag localization
  const allLocalizedTags = getLocalizedTags(product, i18n.language);

  return (
    <Link to={`/product/${product.id}`} className="block h-full">
      <Card
        className={`group cursor-pointer hover:shadow-elevated transition-all duration-500 h-full flex flex-col border-none bg-white rounded-[2rem] overflow-hidden ${className}`}
      >
        <div className="relative overflow-hidden aspect-square">
          <img
            src={product.images[0]}
            alt={product.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
          />

          {/* Premium Overlays */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

          {/* Action Buttons Overlay */}
          <div className="absolute top-4 right-4 flex flex-col gap-2 translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-500">
            {onQuickView && (
              <Button
                onClick={handleQuickView}
                size="icon"
                className="h-10 w-10 rounded-full bg-white text-[#2C1810] hover:bg-[#B85C3C] hover:text-white shadow-lg border-none"
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
          </div>

          {product.isNew && (
            <div className="absolute top-4 left-4 z-10">
              <span className="bg-[#B85C3C] text-white text-[10px] font-bold uppercase tracking-[0.2em] px-3 py-1 rounded-full shadow-lg">
                {t("products.new")}
              </span>
            </div>
          )}

          {allLocalizedTags.length > 0 && (
            <div className="absolute bottom-4 left-4 flex flex-wrap gap-1 max-w-[80%] z-10 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
              {allLocalizedTags.slice(0, 2).map((tag) => (
                <span key={tag} className="bg-white/90 backdrop-blur-sm text-[#2C1810] text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md">
                  {AVAILABLE_TAGS.includes(tag.toLowerCase()) ? t(`products.tags.${tag.toLowerCase()}`) : tag}
                </span>
              ))}
            </div>
          )}
        </div>

        <CardContent className="p-4 flex-grow flex flex-col gap-2">
          <div className="space-y-1">
            <h3 className="font-playfair text-lg font-bold text-[#2C1810] line-clamp-1 group-hover:text-[#B85C3C] transition-colors duration-300">
              {getLocalizedContent(product, i18n.language, 'title')}
            </h3>
            <p className="text-[11px] text-muted-foreground line-clamp-2 font-light leading-relaxed">
              {getLocalizedContent(product, i18n.language, 'description')}
            </p>
          </div>

          <div className="mt-auto pt-1">
            <div className="flex items-center justify-between">
              <div className="space-y-0">
                <p className="text-lg font-bold text-[#2C1810]">
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
                    <span className="text-[9px] font-black text-[#B85C3C] uppercase tracking-tighter">
                      {t("products.save")} {calculateDiscount(product.mrp, product.price)}%
                    </span>
                  </div>
                )}
              </div>

              {Number(product.rating) > 0 && Number(product.reviewCount) > 0 && (
                <div className="flex items-center gap-1.5 bg-[#D4AF37]/10 px-2 py-0.5 rounded-lg border border-[#D4AF37]/20">
                  <Star className="h-3.5 w-3.5 fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.2)]" />
                  <span className="text-[11px] font-black text-[#2C1810]">{product.rating}</span>
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
                  {Number(product.rating) > 0 && Number(product.reviewCount) > 0 && (
                    <div className="flex items-center bg-[#D4AF37]/5 px-3 py-1.5 rounded-full border border-[#D4AF37]/20 shadow-sm">
                      <div className="flex items-center gap-1 mr-2.5">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            size={14}
                            strokeWidth={2}
                            className={i < Math.floor(product.rating || 0) ? "fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_3px_rgba(212,175,55,0.2)]" : "text-[#D4AF37]/20"}
                          />
                        ))}
                      </div>
                      <span className="text-sm font-black text-[#2C1810]">{product.rating}</span>
                    </div>
                  )}
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
};
