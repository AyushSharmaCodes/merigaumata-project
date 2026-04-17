import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Product, ProductVariant } from "@/types";
import { useCartStore } from "@/store/cartStore";
import { useAuthStore } from "@/store/authStore";
import { useToast } from "@/hooks/use-toast";
import { VariantSelector } from "@/components/VariantSelector";
import { logger } from "@/lib/logger";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { NavMessages } from "@/constants/messages/NavMessages";
import { CartMessages } from "@/constants/messages/CartMessages";
import { useCurrency } from "@/contexts/CurrencyContext";
import { useUIStore } from "@/store/uiStore";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { getLocalizedTags } from "@/utils/tagUtils";

// Modularized components
import { ProductGallery } from "./components/ProductGallery";
import { ProductInfoHeader } from "./components/ProductInfoHeader";
import { ProductPricingInfo } from "./components/ProductPricingInfo";
import { ProductActionsSection } from "./components/ProductActionsSection";
import { ProductDescriptionSection } from "./components/ProductDescriptionSection";

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
  const [isAdding, setIsAdding] = useState(false);
  const { toast } = useToast();
  const setBlocking = useUIStore(state => state.setBlocking);

  const localizedTitle = getLocalizedContent(product, i18n.language, 'title');
  
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

  // Update display image when variant changes
  useEffect(() => {
    if (selectedVariant?.variant_image_url) {
      setDisplayImage(selectedVariant.variant_image_url);
    }
  }, [selectedVariant]);

  // Combine all images
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

  const handleImageClick = useCallback((image: string, index: number) => {
    setSelectedImageIndex(index);
    setDisplayImage(image);
  }, []);

  const cartItem = useMemo(() => items.find((item) => {
    const isProductMatch = String(item.productId) === String(product.id);
    const isVariantMatch = (item.variantId || null) === (selectedVariant?.id || null);
    return isProductMatch && isVariantMatch;
  }), [items, product.id, selectedVariant?.id]);

  const quantity = cartItem?.quantity || 0;

  const handleVariantSelect = useCallback((variant: ProductVariant) => {
    setSelectedVariant(variant);
  }, []);

  useEffect(() => {
    if (!product.variants || product.variants.length === 0) {
      if (selectedVariant !== null) setSelectedVariant(null);
      return;
    }

    setSelectedVariant((currentVariant) => {
      if (!currentVariant) return product.defaultVariant || product.variants![0];
      return product.variants!.find((variant) => variant.id === currentVariant.id)
        || product.defaultVariant
        || product.variants![0];
    });
  }, [product.defaultVariant, product.variants]);

  const handleAddToCart = useCallback(async () => {
    setIsAdding(true);
    try {
      await addItem(product, 1, selectedVariant?.id);
      const localizedSizeLabel = selectedVariant ? ` (${getLocalizedContent(selectedVariant, i18n.language, 'size_label')})` : "";
      toast({
        title: t("common.success"),
        description: t(CartMessages.ADDED, { product: `${localizedTitle}${localizedSizeLabel}` }),
      });
    } catch (error) {
      logger.error("Add to cart failed", { err: error });
    } finally {
      setIsAdding(false);
    }
  }, [addItem, product, selectedVariant, i18n.language, localizedTitle, t, toast]);

  const handleBuyNow = useCallback(async () => {
    setBlocking(true);
    try {
      if (!user) {
        setBlocking(false);
        toast({
          title: t("common.error"),
          description: t(ProductMessages.LOGIN_TO_CONTINUE),
          action: (
            <Button
              size="sm"
              onClick={() => navigate(`/?auth=login&returnUrl=${encodeURIComponent(window.location.pathname)}`)}
            >
              {t(NavMessages.LOGIN)}
            </Button>
          ),
        });
        return;
      }

      if (!user?.email || user.email.trim() === "") {
        setBlocking(false);
        toast({
          title: t("common.error"),
          description: t(ProductMessages.EMAIL_NEEDED_DESC),
          variant: "destructive",
        });
        return;
      }

      setBlocking(false);
      navigate("/checkout", {
        state: {
          buyNowItem: {
            product,
            quantity: 1,
            variantId: selectedVariant?.id
          }
        }
      });
    } catch (error) {
      logger.error("Buy now navigation failed", { err: error });
      setBlocking(false);
    }
  }, [user, t, navigate, product, selectedVariant?.id, toast, setBlocking]);

  const handleIncreaseQuantity = useCallback(async () => {
    try {
      if (cartItem) {
        await updateQuantity(product.id, quantity + 1, selectedVariant?.id);
      } else {
        await addItem(product, 1, selectedVariant?.id);
      }
    } catch (error) {}
  }, [addItem, cartItem, product.id, quantity, selectedVariant?.id, updateQuantity]);

  const handleDecreaseQuantity = useCallback(async () => {
    if (cartItem) {
      try {
        if (quantity > 1) {
          await updateQuantity(product.id, quantity - 1, selectedVariant?.id);
        } else {
          await removeItem(product.id, selectedVariant?.id);
          toast({
            title: t("common.success"),
            description: t(CartMessages.REMOVED, { product: localizedTitle }),
          });
        }
      } catch (error) {}
    }
  }, [cartItem, product.id, quantity, removeItem, selectedVariant?.id, toast, localizedTitle, t, updateQuantity]);

  const calculateDiscount = (mrp: number, price: number) => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

  const getStockStatus = useCallback(() => {
    const inventory = displayStock;
    if (inventory === 0) return { text: t(ProductMessages.OUT_OF_STOCK), color: "text-red-600" };
    if (inventory < 5) return { text: t(ProductMessages.FEW_LEFT, { count: inventory }), color: "text-orange-600" };
    if (inventory < 20) return { text: t(ProductMessages.LOW_STOCK), color: "text-orange-500" };
    return { text: t(ProductMessages.IN_STOCK), color: "text-green-600" };
  }, [displayStock, t]);

  const stockStatus = getStockStatus();
  const hasRating = (product.rating || 0) > 0 && (product.ratingCount || 0) > 0;
  const hasVariants = product.variants && product.variants.length > 0;
  const discount = calculateDiscount(displayMrp || 0, displayPrice);

  const isReturnable = (product as any).is_returnable !== undefined
    ? (product as any).is_returnable
    : product.isReturnable ?? false;

  const returnDays = (product as any).return_days ?? product.returnDays ?? 3;

  const taxApplicable = selectedVariant
    ? (selectedVariant.tax_applicable ?? false)
    : (product.default_tax_applicable ?? false);

  const priceIncludesTax = selectedVariant
    ? (selectedVariant.price_includes_tax ?? false)
    : (product.default_price_includes_tax ?? false);

  const allLocalizedTags = getLocalizedTags(product, i18n.language);
  const localizedBenefits = (getLocalizedContent(product, i18n.language, 'benefits') as unknown as string[]) || [];

  return (
    <div className={`${className} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        {/* Gallery Section */}
        <div className="lg:col-span-5">
          <ProductGallery
            images={allImages}
            displayImage={displayImage}
            onImageClick={handleImageClick}
            title={localizedTitle}
            isNew={product.isNew}
            discount={discount}
          />
        </div>

        {/* Info Section */}
        <div className="lg:col-span-7 space-y-4 lg:space-y-6">
          <ProductInfoHeader
            title={localizedTitle}
            tags={allLocalizedTags}
            rating={product.rating}
            ratingCount={product.ratingCount}
            hasRating={hasRating}
          />

          {/* Variant Selector */}
          {hasVariants && (
            <VariantSelector
              variants={product.variants!}
              selectedVariantId={selectedVariant?.id || ""}
              onSelect={handleVariantSelect}
            />
          )}

          {/* Pricing & Stock */}
          <ProductPricingInfo
            displayPrice={displayPrice}
            displayMrp={displayMrp}
            taxApplicable={taxApplicable}
            priceIncludesTax={priceIncludesTax}
            stockStatus={stockStatus}
            inventory={displayStock}
            isReturnable={isReturnable}
            returnDays={returnDays}
            deliveryRefundPolicy={product.delivery_refund_policy}
            deliveryConfig={selectedVariant?.delivery_config || product.delivery_config}
            formatAmount={formatAmount}
          />

          <Separator className="bg-[#B85C3C]/10" />

          {/* Description & Benefits */}
          <ProductDescriptionSection
            description={getLocalizedContent(product, i18n.language, 'description')}
            variantDescription={selectedVariant ? getLocalizedContent(selectedVariant, i18n.language, 'description') : ""}
            sizeLabel={selectedVariant ? getLocalizedContent(selectedVariant, i18n.language, 'size_label') : ""}
            variantMode={product.variant_mode}
            benefits={localizedBenefits}
          />

          <Separator className="bg-[#B85C3C]/10" />

          {/* Action Section */}
          <ProductActionsSection
            isBuying={isBuying}
            isAdding={isAdding}
            quantity={quantity}
            displayStock={displayStock}
            handleBuyNow={handleBuyNow}
            handleAddToCart={handleAddToCart}
            handleIncreaseQuantity={handleIncreaseQuantity}
            handleDecreaseQuantity={handleDecreaseQuantity}
          />
        </div>
      </div>
    </div>
  );
};
