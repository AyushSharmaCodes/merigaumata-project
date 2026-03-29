import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BackButton } from "@/components/ui/BackButton";

import { ProductReviews } from "@/components/ProductReviews";
import { ProductDetailView } from "@/components/ProductDetailView";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { productService } from "@/services/product.service";
import { ProductMessages } from "@/constants/messages/ProductMessages";

const ProductDetail = () => {
  const { t, i18n } = useTranslation();
  const { productId } = useParams<{ productId: string }>();

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", productId, i18n.language],
    queryFn: async () => {
      return productService.getById(productId!, { lang: i18n.language });
    },
    enabled: !!productId,
  });

  if (isLoading) {
    return <LoadingOverlay isLoading={true} message={t(ProductMessages.LOADING)} />;
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-6 font-playfair">{t(ProductMessages.NOT_FOUND)}</h1>
          <BackButton to="/shop" label={t(ProductMessages.VIEW_ALL)} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF7F2]/30 pb-20 pt-8 animate-in fade-in duration-700">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="mb-6">
          <BackButton to="/shop" label={t(ProductMessages.BACK_TO_COLLECTION)} className="w-fit text-[10px] text-[#B85C3C] hover:text-[#2C1810] font-black uppercase tracking-[0.2em] border-none py-2 h-auto bg-transparent hover:bg-transparent transition-all duration-300" />
        </div>

        <ProductDetailView product={product} key={product.id} />

        {/* Reviews Section with Premium Card Styling */}
        <div className="mt-16">
          <ProductReviews productId={product.id} />
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
