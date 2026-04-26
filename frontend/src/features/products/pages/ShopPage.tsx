import { Search } from "lucide-react";
import { ProductQuickView } from "@/features/products";
import { ShopSkeleton } from "@/shared/components/ui/page-skeletons";
import { Button } from "@/shared/components/ui/button";
import { ShopMessages } from "@/shared/constants/messages/ShopMessages";
import { ShopFilters } from "@/features/products";
import { ShopProductGrid } from "@/features/products";
import { useShopPage } from "../hooks/useShopPage";
import { ShopHero } from "../components/shop/ShopHero";

export function ShopPage() {
  const controller = useShopPage();
  const {
    t,
    sortBy,
    setSortBy,
    category,
    setCategory,
    quickViewProduct,
    setQuickViewProduct,
    handleQuickViewClose,
    setSearchQuery,
    debouncedSearchQuery,
    allProducts,
    categories,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = controller;

  return (
    <div className="min-h-screen bg-background pb-20">
      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={handleQuickViewClose}
      />

      <ShopHero />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-6 relative z-20">
        <ShopFilters
          initialSearch={debouncedSearchQuery}
          category={category}
          sortBy={sortBy}
          categories={categories}
          onSearchChange={setSearchQuery}
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
}
