import { useState, useMemo, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Star,
  ShoppingCart,
  Minus,
  Plus,
  Package,
  Zap,
  RotateCcw,
  X,
  Truck,
} from "lucide-react";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { getLocalizedTags } from '@/utils/tagUtils';
import { Button } from "@/components/ui/button";
import { Badge } from '@/components/ui/badge';
import { Tag } from "@/components/ui/Tag";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Product, ProductVariant } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { toast } from "sonner";
import { VariantSelector } from "@/components/VariantSelector";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { logger } from "@/lib/logger";
import { AVAILABLE_TAGS } from "@/constants/productConstants";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { CartMessages } from "@/constants/messages/CartMessages";
import { NavMessages } from "@/constants/messages/NavMessages";
import { useCurrency } from "@/contexts/CurrencyContext";

interface ProductDetailViewProps {
  product: Product;
  className?: string;
}

export const ProductDetailView = ({
  product,
  className = "",
}: ProductDetailViewProps) => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { addItem, items, updateQuantity, removeItem } = useCartStore();
  const { formatAmount } = useCurrency();
  const { user } = useAuthStore();
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isBuying, setIsBuying] = useState(false);

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(
    () => {
      if (product.variants && product.variants.length > 0) {
        return product.defaultVariant || product.variants[0];
      }
      return null;
    }
  );

  // Computed values based on selected variant
  const displayPrice = useMemo(() => {
    if (selectedVariant) return selectedVariant.selling_price;
    return product.price;
  }, [selectedVariant, product.price]);

  const displayMrp = useMemo(() => {
    if (selectedVariant) return selectedVariant.mrp;
    return product.mrp;
  }, [selectedVariant, product.mrp]);

  const displayStock = useMemo(() => {
    if (selectedVariant) return selectedVariant.stock_quantity;
    return product.inventory || 0;
  }, [selectedVariant, product.inventory]);


  // State for the currently displayed image
  const [displayImage, setDisplayImage] = useState<string>(
    product.images && product.images.length > 0 ? product.images[0] : ""
  );

  // Update display image when variant changes (if variant has specific image)
  // Update display image when variant changes (if variant has specific image)
  useEffect(() => {
    if (selectedVariant?.variant_image_url) {
      setDisplayImage(selectedVariant.variant_image_url);
    }
    // Only auto-update image when the VARIANT changes. 
    // Manual image selection (clicking thumbnails) should stick and not be overwritten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedVariant]);


  // Combine all images (product images + variant images)
  const allImages = useMemo(() => {
    const images = [...(product.images || [])];
    if (product.variants) {
      product.variants.forEach((variant) => {
        if (variant.variant_image_url && !images.includes(variant.variant_image_url)) {
          images.push(variant.variant_image_url);
        }
      });
    }
    return images;
  }, [product.images, product.variants]);

  // Update display image when thumbnail is clicked
  const handleImageClick = (image: string, index: number) => {
    setSelectedImageIndex(index);
    setDisplayImage(image);
  };

  // Ultra-simple reactive lookup - use selected items directly
  const cartItem = items.find((item) => {
    const isProductMatch = String(item.productId) === String(product.id);
    const isVariantMatch = (item.variantId || null) === (selectedVariant?.id || null);
    return isProductMatch && isVariantMatch;
  });

  const quantity = cartItem?.quantity || 0;

  const handleVariantSelect = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    // The useEffect above will handle the image update
  };

  useEffect(() => {
    if (!product.variants || product.variants.length === 0) {
      if (selectedVariant !== null) {
        setSelectedVariant(null);
      }
      return;
    }

    setSelectedVariant((currentVariant) => {
      if (!currentVariant) {
        return product.defaultVariant || product.variants[0];
      }

      return product.variants.find((variant) => variant.id === currentVariant.id)
        || product.defaultVariant
        || product.variants[0];
    });
  }, [product.defaultVariant, product.variants, selectedVariant]);

  const handleAddToCart = async () => {
    try {
      await addItem(product, 1, selectedVariant?.id);

      const sizeLabel = selectedVariant ? ` (${selectedVariant.size_label})` : "";
      toast.success(t(CartMessages.ADDED, { product: `${product.title}${sizeLabel}` }), {
        icon: <ShoppingCart size={16} className="text-primary" />,
      });
    } catch (error) {
      logger.error("Add to cart failed", { err: error });
    }
  };

  const handleBuyNow = async () => {
    // 1. Check Authentication First
    if (!user) {
      toast(t(ProductMessages.AUTH_REQUIRED), {
        description: t(ProductMessages.LOGIN_TO_CONTINUE),
        action: {
          label: t(NavMessages.LOGIN),
          onClick: () => navigate(`/?auth=login&returnUrl=${encodeURIComponent(window.location.pathname)}`)
        }
      });
      return;
    }

    // 2. Check for Email (Required for Razorpay Invoice/Receipts)
    if (!user?.email || user.email.trim() === "") {
      toast.error(t(ProductMessages.EMAIL_NEEDED), {
        description: t(ProductMessages.EMAIL_NEEDED_DESC),
      });
      return;
    }

    // Navigate directly to checkout with buy now item in state
    // This ensures only this item is checked out, not the entire cart
    // No need to add to cart - Buy Now should skip cart entirely
    navigate("/checkout", {
      state: {
        buyNowItem: {
          product,
          quantity: 1,
          variantId: selectedVariant?.id
        }
      }
    });
  };

  const handleIncreaseQuantity = async () => {
    try {
      if (cartItem) {
        await updateQuantity(product.id, quantity + 1, selectedVariant?.id);
      } else {
        await addItem(product, 1, selectedVariant?.id);
      }
    } catch (error) {
      // Handled by store
    }
  };

  const handleDecreaseQuantity = async () => {
    if (cartItem) {
      try {
        if (quantity > 1) {
          await updateQuantity(product.id, quantity - 1, selectedVariant?.id);
        } else {
          await removeItem(product.id, selectedVariant?.id);
          toast.success(t(CartMessages.REMOVED, { product: product.title }));
        }
      } catch (error) {
        // Handled by store
      }
    }
  };

  const calculateDiscount = (mrp: number, price: number) => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const getStockStatus = () => {
    const inventory = displayStock;
    if (inventory === 0) return { text: t(ProductMessages.OUT_OF_STOCK), color: "text-red-600" };
    if (inventory < 5) return { text: t(ProductMessages.FEW_LEFT, { count: inventory }), color: "text-orange-600" };
    if (inventory < 20) return { text: t(ProductMessages.LOW_STOCK), color: "text-orange-500" };
    return { text: t(ProductMessages.IN_STOCK), color: "text-green-600" };
  };

  const stockStatus = getStockStatus();
  const hasRating = (product.rating || 0) > 0 && (product.ratingCount || 0) > 0;
  const hasVariants = product.variants && product.variants.length > 0;
  const discount = calculateDiscount(displayMrp || 0, displayPrice);

  // Normalize Return Policy Data (Handle both camelCase and snake_case)
  const isReturnable = (product as any).is_returnable !== undefined
    ? (product as any).is_returnable
    : product.isReturnable ?? false;

  const returnDays = (product as any).return_days ?? product.returnDays ?? 3;

  // Normalize Tax Data
  const taxApplicable = selectedVariant
    ? (selectedVariant.tax_applicable ?? false)
    : (product.default_tax_applicable ?? false);

  const priceIncludesTax = selectedVariant
    ? (selectedVariant.price_includes_tax ?? false)
    : (product.default_price_includes_tax ?? false);

  // Tag localization with centralized utility
  const allLocalizedTags = getLocalizedTags(product, i18n.language);

  return (
    <div className={`${className} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      <LoadingOverlay isLoading={isBuying} message={t(ProductMessages.PREPARING_PURCHASE)} />
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Left Side: Product Image Gallery */}
        <div className="lg:col-span-5 space-y-4">
          {/* Main Product Image */}
          <Card className="relative overflow-hidden rounded-[2rem] border-none shadow-xl bg-white aspect-square max-w-xl mx-auto lg:mx-0">
            <img
              src={displayImage}
              alt={product.title}
              className="w-full h-full object-cover transition-opacity duration-300"
            />

            {product.isNew && (
              <div className="absolute top-6 left-6">
                <Tag variant="new" size="sm" className="bg-[#B85C3C] text-white border-none px-4 py-1.5 shadow-lg font-bold uppercase tracking-wider text-[9px]">
                  {t(ProductMessages.NEW)}
                </Tag>
              </div>
            )}

            {discount > 0 && (
              <div className="absolute top-6 right-6">
                <Tag variant="discount" size="sm" className="bg-[#D4AF37] text-white border-none px-4 py-1.5 shadow-lg font-black text-[9px]">
                  {t(ProductMessages.OFF, { percent: discount })}
                </Tag>
              </div>
            )}
          </Card>

          {/* Image Thumbnails */}
          {allImages.length > 1 && (
            <div className="flex gap-3 px-1 overflow-x-auto pb-2 no-scrollbar justify-center lg:justify-start">
              {allImages.map((image, index) => (
                <button
                  key={index}
                  onClick={() => handleImageClick(image, index)}
                  className={`relative flex-shrink-0 w-16 h-16 rounded-2xl overflow-hidden transition-all duration-300 border-2 ${displayImage === image
                    ? "border-[#B85C3C] shadow-md scale-105"
                    : "border-transparent opacity-60 hover:opacity-100"
                    }`}
                >
                  <img src={image} alt={product.title} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right Side: Product Info */}
        <div className="lg:col-span-7 space-y-4 lg:space-y-6">
          <div className="space-y-2">
            <h1 className="text-3xl lg:text-4xl font-bold text-[#2C1810] font-playfair leading-tight">
              {getLocalizedContent(product, i18n.language, 'title')}
            </h1>

            {allLocalizedTags.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {allLocalizedTags.map((tag, index) => (
                  <span key={index} className="px-2 py-1 bg-[#FAF7F2] border border-[#B85C3C]/10 rounded-md text-[10px] font-bold text-[#B85C3C] uppercase tracking-wider">
                    {AVAILABLE_TAGS.includes(tag.toLowerCase()) ? t(`products.tags.${tag.toLowerCase()}`) : tag}
                  </span>
                ))}
              </div>
            )}

            {/* Rating Summary - Conditionally shown */}
            {hasRating && (
              <div className="flex items-center gap-3">
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
                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
                  {product.ratingCount} {t(ProductMessages.RATINGS)}
                </span>
              </div>
            )}
          </div>

          {/* Variant Selector */}
          {hasVariants && (
            <VariantSelector
              variants={product.variants!}
              selectedVariantId={selectedVariant?.id || ""}
              onSelect={handleVariantSelect}
            />
          )}

          {/* Price & Taxes */}
          <div className="space-y-1">
            <div className="flex items-center gap-4">
              <span className="text-3xl font-black text-[#B85C3C] transition-all duration-200">{formatAmount(displayPrice)}</span>
              {displayMrp && displayMrp > displayPrice && (
                <span className="text-lg text-muted-foreground line-through font-light opacity-50">{formatAmount(displayMrp)}</span>
              )}
            </div>
            {taxApplicable && (
              <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
                {priceIncludesTax ? t(ProductMessages.INCLUSIVE_TAX) : t(ProductMessages.EXCLUSIVE_TAX)}
              </p>
            )}

          </div>

          {/* Stock status without number */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Package size={16} className="text-muted-foreground" />
              <span className={`text-sm font-bold ${stockStatus.color}`}>
                {stockStatus.text}
                {product.inventory !== undefined && product.inventory > 0 && product.inventory <= 15 && (
                  <span className="ml-2 text-[10px] text-orange-600 font-bold uppercase tracking-wider animate-pulse">
                    ({t('products.fewLeft', { count: product.inventory })})
                  </span>
                )}
              </span>
            </div>

            {/* Return Policy - Immediately below stock */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2">
                {isReturnable ? (
                  <>
                    <RotateCcw className="h-4 w-4 text-green-600" />
                    <span className="text-xs font-medium text-green-600">
                      {t(ProductMessages.DAYS_RETURN_AVAILABLE, { count: returnDays })}
                    </span>
                  </>
                ) : (
                  <>
                    <X className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">
                      {t(ProductMessages.NON_RETURNABLE)}
                    </span>
                  </>
                )}
              </div>

              {/* Delivery Refund Policy Badge */}
              {product.delivery_refund_policy === 'NON_REFUNDABLE' && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500">
                  <div className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center">
                    <Truck className="h-2.5 w-2.5 text-orange-600" />
                  </div>
                  <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">
                    {t(ProductMessages.NON_REFUNDABLE_DELIVERY)}
                  </span>
                </div>
              )}

              {/* Dynamic Delivery Charge Info */}
              {(selectedVariant?.delivery_config || product.delivery_config) && (
                <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500 mt-1">
                  <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                    <Truck className="h-2.5 w-2.5 text-blue-600" />
                  </div>
                  <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                    {(() => {
                      const config = selectedVariant?.delivery_config || product.delivery_config;
                      if (!config) return '';
                      let typeStr = '';
                      if (config.calculation_type === 'PER_ITEM') typeStr = t(ProductMessages.PER_ITEM);
                      else if (config.calculation_type === 'FLAT_PER_ORDER') typeStr = t(ProductMessages.PER_ORDER);
                      else if (config.calculation_type === 'PER_PACKAGE') typeStr = t(ProductMessages.PER_PACKAGE);
                      else typeStr = t(ProductMessages.WEIGHT_BASED);

                      return t(ProductMessages.DELIVERY_CHARGE, { amount: `${formatAmount(config.base_delivery_charge)} / ${typeStr}` });
                    })()}
                  </span>
                </div>
              )}
            </div>
          </div>

          <Separator className="bg-[#B85C3C]/10" />

          {/* Description & Benefits */}
          <div className="space-y-3">
            {product.description && (
              <div className="space-y-1.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">{t(ProductMessages.DESCRIPTION)}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light">
                  {getLocalizedContent(product, i18n.language, 'description')}
                </p>
              </div>
            )}

            {/* Selected Variant Description (Critical for Size-based variants) */}
            {selectedVariant?.description && (
              <div className="space-y-1.5 animate-in fade-in slide-in-from-left-1 duration-300">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">
                  {product.variant_mode === 'SIZE'
                    ? t(ProductMessages.SIZE_DETAILS, { size: selectedVariant.size_label })
                    : t(ProductMessages.VARIANT_DETAILS)}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed font-light whitespace-pre-line">
                  {getLocalizedContent(selectedVariant, i18n.language, 'description')}
                </p>
              </div>
            )}

            {product.benefits && product.benefits.length > 0 && (
              <div className="space-y-2.5">
                <h3 className="text-xs font-black uppercase tracking-widest text-[#2C1810]">{t(ProductMessages.KEY_BENEFITS)}</h3>
                <div className="grid grid-cols-1 gap-1.5">
                  {product.benefits.map((benefit, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#B85C3C]" />
                      <span className="text-xs text-muted-foreground font-medium">{benefit}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          <Separator className="bg-[#B85C3C]/10" />

          {/* Action Column - Moved below details */}
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2.5">

                <Button
                  size="lg"
                  onClick={handleBuyNow}
                  disabled={!displayStock || displayStock === 0}
                  className="w-full rounded-xl h-12 text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/10"
                >
                  <Zap className="h-5 w-5 mr-3 fill-current" />
                  {t(ProductMessages.BUY_NOW)}
                </Button>

                {quantity > 0 ? (
                  <div className="space-y-2.5">
                    {/* Quantity Selector - Integrated with Buy Now context */}
                    <div className="flex items-center justify-between bg-[#FAF7F2] p-2 rounded-xl border border-[#B85C3C]/10 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">{t(ProductMessages.CART_QUANTITY)}</span>
                      <div className="flex items-center gap-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleDecreaseQuantity}
                          className="h-8 w-8 rounded-full hover:bg-white transition-all shadow-sm"
                        >
                          <Minus size={14} />
                        </Button>
                        <span className="text-base font-black text-[#2C1810] w-4 text-center">{quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleIncreaseQuantity}
                          disabled={displayStock !== undefined && displayStock > 0 && quantity >= displayStock}
                          className="h-8 w-8 rounded-full hover:bg-white transition-all shadow-sm"
                        >
                          <Plus size={14} />
                        </Button>
                      </div>
                    </div>
                    <Link to="/cart" className="block">
                      <Button variant="outline" size="lg" className="w-full rounded-xl h-12 text-base font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors">
                        <ShoppingCart className="h-5 w-5 mr-3" />
                        {t(ProductMessages.COMPLETE_ORDER)}
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={handleAddToCart}
                    disabled={!displayStock || displayStock === 0}
                    className="w-full rounded-xl h-12 text-base font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors"
                  >
                    <ShoppingCart className="h-5 w-5 mr-3" />
                    {t(ProductMessages.ADD_TO_CART)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div >
  );
};
