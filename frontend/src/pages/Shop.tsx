import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { Search, Sparkles, Filter, SlidersHorizontal, ArrowLeft } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { ProductQuickView } from "@/components/ProductQuickView";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
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
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [category, setCategory] = useState("all");
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null
  );

  // PERFORMANCE: Debounce search query
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  // SERVER-SIDE PAGINATION: Use useInfiniteQuery
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ["products", debouncedSearchQuery, category, sortBy],
    queryFn: async ({ pageParam = 1 }) => {
      // Use the new getAll signature which returns { products, total, stats }
      const response = await productService.getAll({
        page: pageParam,
        limit: 12, // Load 12 products per page
        search: debouncedSearchQuery,
        category: category,
        sortBy: sortBy,
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
    queryKey: ["categories", "product"],
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
      <LoadingOverlay isLoading={isLoading} message={t(ShopMessages.CURATING_GOODS)} />

      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
      />

      {/* Compact Premium Hero Section */}
      <section className="bg-[#2C1810] text-white py-12 md:py-16 relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
          <Sparkles className="h-48 w-48 text-[#B85C3C]" />
        </div>
        <div className="container mx-auto px-4 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-2 py-0.5 rounded-full bg-[#B85C3C]/10 text-[#B85C3C] text-[10px] font-bold uppercase tracking-[0.2em]">
                <Sparkles className="h-3 w-3" /> {t(ShopMessages.PURE_VEDIC_BADGE)}
              </div>
              <h1 className="text-3xl md:text-5xl font-bold font-playfair">
                {t(NavMessages.SHOP)} <span className="text-[#B85C3C]">{t(ShopMessages.COLLECTION)}</span>
              </h1>
            </div>
            <p className="text-white/50 text-sm md:text-base max-w-md font-light border-l border-[#B85C3C]/30 pl-6 hidden md:block">
              {t(ShopMessages.SUBTITLE)}
            </p>
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        {/* Sleek Search and Filter Bar */}
        <div className="bg-white rounded-2xl p-4 md:p-6 shadow-elevated border border-border/50 mb-12">
          <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch lg:items-end">
            {/* Search */}
            <div className="w-full lg:flex-1 space-y-2">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">{t("shop.filterSearch")}</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[#B85C3C]" />
                <Input
                  id="shop-search"
                  name="shop-search"
                  aria-label={t("shop.filterSearch")}
                  type="text"
                  placeholder={t(ProductMessages.SEARCH)}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-1 focus-visible:ring-[#B85C3C] transition-all"
                />
              </div>
            </div>

            {/* Filters Group */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full lg:w-auto lg:min-w-[500px]">
              {/* Category Filter */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <Filter className="h-3 w-3" /> {t(ShopMessages.FILTER_CATEGORY)}
                </label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger aria-label={t(ShopMessages.FILTER_CATEGORY)} className="h-14 rounded-2xl bg-muted/30 border-none focus:ring-1 focus:ring-[#B85C3C]">
                    <SelectValue placeholder={t(ShopMessages.ALL_COLLECTIONS)} />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-elevated">
                    {categories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name} className="rounded-xl mt-1 first:mt-0">
                        {cat.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Sort */}
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1 flex items-center gap-2">
                  <SlidersHorizontal className="h-3 w-3" /> {t(ShopMessages.FILTER_SORTING)}
                </label>
                <Select value={sortBy} onValueChange={setSortBy}>
                  <SelectTrigger aria-label={t(ShopMessages.FILTER_SORTING)} className="h-14 rounded-2xl bg-muted/30 border-none focus:ring-1 focus:ring-[#B85C3C]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-2xl border-none shadow-elevated">
                    <SelectItem value="newest" className="rounded-xl">{t(ProductMessages.NEWEST)}</SelectItem>
                    <SelectItem value="priceLowHigh" className="rounded-xl">
                      {t(ProductMessages.PRICE_LOW_HIGH)}
                    </SelectItem>
                    <SelectItem value="priceHighLow" className="rounded-xl">
                      {t(ProductMessages.PRICE_HIGH_LOW)}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="aspect-[3/4] bg-muted/50 rounded-[2rem] animate-pulse" />
            ))}
          </div>
        ) : allProducts.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8 animate-fade-in">
              {allProducts.map((product) => (
                <div key={product.id} className="w-full transition-all duration-500 hover:-translate-y-2">
                  <ProductCard
                    product={product}
                    onQuickView={setQuickViewProduct}
                  />
                </div>
              ))}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
              <div className="mt-20 text-center">
                <Button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  variant="outline"
                  size="lg"
                  className="rounded-full px-12 h-14 text-lg font-bold border-[#B85C3C] text-[#B85C3C] hover:bg-[#B85C3C] hover:text-white transition-all shadow-xl disabled:opacity-50"
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
                setSearchQuery("");
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
