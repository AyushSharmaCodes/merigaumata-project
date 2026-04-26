import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Separator } from "@/shared/components/ui/separator";
import { Product } from "@/shared/types";
import { VariantSelector } from "@/features/products";
import { useCurrency } from "@/app/providers/currency-provider";
import { useProductSelection } from "../../hooks/useProductSelection";
import { useProductActions } from "@/application/checkout/useProductActions";
import { getLocalizedContent } from "@/core/utils/localizationUtils";
import { getLocalizedTags } from "@/domains/product/services/tag.service";

// Modularized components
import { ProductGallery } from "./ProductGallery";
import { ProductInfoHeader } from "./ProductInfoHeader";
import { ProductPricingInfo } from "./ProductPricingInfo";
import { ProductActionsSection } from "./ProductActionsSection";
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
  const { formatAmount } = useCurrency();

  const localizedTitle = getLocalizedContent(product, i18n.language, "title");

  const {
    selectedVariant,
    displayPrice,
    displayMrp,
    displayStock,
    displayImage,
    allImages,
    stockStatus,
    handleImageClick,
    handleVariantSelect,
  } = useProductSelection({ product, t });

  const {
    quantity,
    isBuying,
    isAdding,
    handleAddToCart,
    handleBuyNow,
    handleIncreaseQuantity,
    handleDecreaseQuantity,
  } = useProductActions({
    product,
    selectedVariant,
    localizedTitle,
  });

  const calculateDiscount = (mrp: number, price: number) => {
    if (!mrp || mrp <= price) return 0;
    return Math.round(((mrp - price) / mrp) * 100);
  };

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

  const allLocalizedTags = useMemo(() => getLocalizedTags(product, i18n.language), [product, i18n.language]);
  const localizedBenefits = useMemo(() => (getLocalizedContent(product, i18n.language, 'benefits') as unknown as string[]) || [], [product, i18n.language]);

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
            isNew={product.isNew || product.is_new}
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
