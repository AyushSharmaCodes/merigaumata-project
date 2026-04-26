import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useProductDetailQuery } from "@/domains/product/queries/useProductDetailQuery";

export function useProductDetailPage() {
  const { t, i18n } = useTranslation();
  const { productId } = useParams<{ productId: string }>();

  const { data: product, isLoading, refetch } = useProductDetailQuery(productId!, {
    lang: i18n.language,
    _ts: Date.now()
  }, {
    staleTime: 0,
    refetchOnMount: "always",
  });

  return {
    t,
    productId,
    product,
    isLoading,
    refetch,
  };
}
