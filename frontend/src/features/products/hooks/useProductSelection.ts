import { useCallback, useEffect, useMemo, useState } from "react";
import { productService, type Product, type ProductVariant } from "@/domains/product";

interface UseProductSelectionParams {
  product: Product;
  t: (key: string, options?: Record<string, unknown>) => string;
}

export function useProductSelection({ product, t }: UseProductSelectionParams) {
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [displayImage, setDisplayImage] = useState<string>(
    product.images && product.images.length > 0 ? product.images[0] : ""
  );

  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(() => {
    if (product.variants && product.variants.length > 0) {
      return product.defaultVariant || product.variants[0];
    }
    return null;
  });

  const displayPrice = useMemo(
    () => productService.getDisplayPrice(product, selectedVariant),
    [product, selectedVariant]
  );

  const displayMrp = useMemo(
    () => productService.getDisplayMrp(product, selectedVariant),
    [product, selectedVariant]
  );

  const displayStock = useMemo(
    () => productService.getDisplayStock(product, selectedVariant),
    [product, selectedVariant]
  );

  const allImages = useMemo(() => productService.getAllImages(product), [product]);

  const stockStatus = useMemo(
    () => productService.getStockStatus(displayStock, t),
    [displayStock, t]
  );

  useEffect(() => {
    if (selectedVariant?.variant_image_url) {
      setDisplayImage(selectedVariant.variant_image_url);
    }
  }, [selectedVariant]);

  useEffect(() => {
    if (!product.variants || product.variants.length === 0) {
      if (selectedVariant !== null) setSelectedVariant(null);
      return;
    }

    setSelectedVariant((currentVariant) => {
      if (!currentVariant) return product.defaultVariant || product.variants![0];
      return (
        product.variants!.find((variant) => variant.id === currentVariant.id) ||
        product.defaultVariant ||
        product.variants![0]
      );
    });
  }, [product.defaultVariant, product.variants]);

  const handleImageClick = useCallback((image: string, index: number) => {
    setSelectedImageIndex(index);
    setDisplayImage(image);
  }, []);

  const handleVariantSelect = useCallback((variant: ProductVariant) => {
    setSelectedVariant(variant);
  }, []);

  return {
    selectedImageIndex,
    selectedVariant,
    displayPrice,
    displayMrp,
    displayStock,
    displayImage,
    allImages,
    stockStatus,
    handleImageClick,
    handleVariantSelect,
  };
}
