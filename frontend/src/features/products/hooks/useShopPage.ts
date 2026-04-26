import { useState, useMemo, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { useProductDetailQuery, useInfiniteProductsQuery } from "@/domains/product";
import type { Product } from "@/domains/product";
import { categoryService } from "@/domains/settings";
import { getLocalizedContent } from "@/core/utils/localizationUtils";

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);
  return debouncedValue;
}

export function useShopPage() {
  const { t, i18n } = useTranslation();
  const [sortBy, setSortBy] = useState("newest");
  const [category, setCategory] = useState("all");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  const handleQuickViewClose = useCallback((open: boolean) => {
    if (!open) setQuickViewProduct(null);
  }, []);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteProductsQuery({
    limit: 10,
    search: debouncedSearchQuery,
    category: category,
    sortBy: sortBy,
    lang: i18n.language
  });

  const allProducts = data?.pages.flatMap((page) => page.products) || [];

  const { data: categoriesData = [] } = useQuery({
    queryKey: ["categories", "product", i18n.language],
    queryFn: () => categoryService.getAll("product"),
  });

  const categories = useMemo(() => {
    return [
      { id: "all", name: "all", displayName: t("shop.allCollections") || "All Collections" },
      ...categoriesData.map(c => ({
        id: c.name,
        name: c.name,
        displayName: getLocalizedContent(c, i18n.language)
      }))
    ];
  }, [categoriesData, i18n.language, t]);

  return {
    t,
    i18n,
    sortBy,
    setSortBy,
    category,
    setCategory,
    quickViewProduct,
    setQuickViewProduct,
    handleQuickViewClose,
    searchQuery,
    setSearchQuery,
    debouncedSearchQuery,
    allProducts,
    categories,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  };
}
