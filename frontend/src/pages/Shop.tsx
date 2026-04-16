import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Search, Sparkles, Filter, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductQuickView } from "@/components/ProductQuickView";
import { ShopSkeleton } from "@/components/ui/page-skeletons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import { Product } from "@/types";
import { productService } from "@/services/product.service";
import { categoryService } from "@/services/category.service";
import { ShopMessages } from "@/constants/messages/ShopMessages";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { NavMessages } from "@/constants/messages/NavMessages";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { ShopFilters } from "@/components/shop/ShopFilters";
import { ShopProductGrid } from "@/components/shop/ShopProductGrid";
import { useCallback } from "react";

/**
 * Custom hook for debouncing a value
 * PERFORMANCE: Prevents API refetches on every keystroke
 */
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

const Shop = () => {
  const { t, i18n } = useTranslation();
  const [sortBy, setSortBy] = useState("newest");
  const [category, setCategory] = useState("all");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null
  );

  // Parent's state for debounced values (used for Query Key)
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState("");

  const handleQuickViewClose = useCallback((open: boolean) => {
    if (!open) setQuickViewProduct(null);
  }, []);

  // SERVER-SIDE PAGINATION: Use useInfiniteQuery
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["products", debouncedSearchQuery, category, sortBy, i18n.language],
    queryFn: async ({ pageParam = 1 }) => {
      // Use the new getAll signature which returns { products, total, stats }
        const response = await productService.getAll({
          page: pageParam,
          limit: 10, // Load 10 products per page
          search: debouncedSearchQuery,
          category: category,
          sortBy: sortBy,
          lang: i18n.language
        });
      return response;
    },
    getNextPageParam: (lastPage, allPages) => {
      const loadedProducts = allPages.flatMap((p) => p.products).length;
      if (loadedProducts < lastPage.total) {
        return allPages.length + 1;
      }
      return undefined;
    },
    initialPageParam: 1,
  });

  // Flatten pages for rendering
  const allProducts = data?.pages.flatMap((page) => page.products) || [];

  // Fetch categories from backend
  const { data: categoriesData = [] } = useQuery({
    queryKey: ["categories", "product", i18n.language],
    queryFn: () => categoryService.getAll("product"),
  });

  // Build categories array with "all" option
  // Build categories array with "all" option (localized)
  const categories = useMemo(() => {
    return [
      { id: "all", name: "all", displayName: t("shop.allCollections") || "All Collections" },
      ...categoriesData.map(c => ({
        id: c.name, // Keeping name as ID for compatibility with existing filter logic
        name: c.name,
        displayName: getLocalizedContent(c, i18n.language)
      }))
    ];
  }, [categoriesData, i18n.language, t]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={handleQuickViewClose}
      />

      {/* Compact Premium Hero Section */}
      <section className="bg-foreground text-background py-12 md:py-20 relative overflow-hidden shadow-elevated">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Sparkles className="h-64 w-64 text-primary" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div className="space-y-4">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black uppercase tracking-[0.3em] backdrop-blur-md border border-primary/20">
                <Sparkles className="h-3 w-3" /> {t(ShopMessages.PURE_VEDIC_BADGE)}
              </div>
              <h1 className="text-4xl md:text-6xl font-black font-playfair tracking-tight">
                {t(NavMessages.SHOP)} <span className="text-primary">{t(ShopMessages.COLLECTION)}</span>
              </h1>
            </div>
            <p className="text-background/60 text-base md:text-lg max-w-md font-medium border-l-2 border-primary/30 pl-8 hidden md:block leading-relaxed">
              {t(ShopMessages.SUBTITLE)}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <ShopFilters
          initialSearch={debouncedSearchQuery}
          category={category}
          sortBy={sortBy}
          categories={categories}
          onSearchChange={setDebouncedSearchQuery}
          onCategoryChange={setCategory}
          onSortChange={setSortBy}
        />

        {/* Products Grid */}
        {isLoading ? (
          <ShopSkeleton />
        ) : allProducts.length > 0 ? (
          <>
            <ShopProductGrid
              products={allProducts}
              onQuickView={setQuickViewProduct}
            />

            {/* Load More Button */}
            {hasNextPage && (
              <div className="mt-20 text-center">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  size="lg"
                  className="rounded-full px-12 h-14 text-lg font-bold border-primary text-primary hover:bg-primary hover:text-background transition-all shadow-elevated disabled:opacity-50"
                >
                  {isFetchingNextPage ? t(ShopMessages.LOADING_MORE) : t(ShopMessages.LOAD_MORE)}
                </Button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-32 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
            <div className="mb-6 inline-flex p-6 rounded-full bg-muted/50">
              <Search className="h-12 w-12 text-muted-foreground/50" />
            </div>
            <p className="text-2xl font-bold text-[#2C1810] mb-2">{t(ShopMessages.NO_PRODUCTS_TITLE)}</p>
            <p className="text-muted-foreground mb-8">
              {t(ShopMessages.NO_PRODUCTS_DESC)}
            </p>
            <Button
              variant="outline"
              className="rounded-full border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white"
              onClick={() => {
                setDebouncedSearchQuery("");
                setCategory("all");
                setSortBy("newest");
              }}
            >
              {t(ShopMessages.CLEAR_FILTERS)}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};


export default Shop;
