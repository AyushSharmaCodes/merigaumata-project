import { memo } from "react";
import type { Product } from "@/types";
import { ProductCard } from "@/components/ProductCard";

interface ShopProductGridProps {
  products: Product[];
  onQuickView: (product: Product) => void;
}

/**
 * ShopProductGrid - Isolates the expensive mapping and grid rendering logic.
 * Ensures that changes to search text don't force a re-reconcilation of every card wrapper.
 */
export const ShopProductGrid = memo(({ products, onQuickView }: ShopProductGridProps) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
      {products.map((product, index) => (
        <div
          key={product.id}
          className="w-full transition-all duration-500 hover:-translate-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out fill-mode-both"
          style={{ animationDelay: `${index * 50}ms` }}
        >
          <ProductCard
            product={product}
            onQuickView={onQuickView}
          />
        </div>
      ))}
    </div>
  );
});

ShopProductGrid.displayName = "ShopProductGrid";
