import { memo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";
import { ProductMessages } from "@/shared/constants/messages/ProductMessages";
import { ShopMessages } from "@/shared/constants/messages/ShopMessages";

interface ShopFiltersProps {
  initialSearch: string;
  category: string;
  sortBy: string;
  categories: { id: string; name: string; displayName: string }[];
  onSearchChange: (value: string) => void;
  onCategoryChange: (value: string) => void;
  onSortChange: (value: string) => void;
}

/**
 * ShopFilters - Isolates input state and filter controls.
 * PERFORMANCE: Prevents the entire Shop grid from re-rendering on every keystroke.
 */
export const ShopFilters = memo(({
  initialSearch,
  category,
  sortBy,
  categories,
  onSearchChange,
  onCategoryChange,
  onSortChange
}: ShopFiltersProps) => {
  const { t } = useTranslation();
  const [localSearch, setLocalSearch] = useState(initialSearch);

  // Sync local state if parent resets filters
  useEffect(() => {
    setLocalSearch(initialSearch);
  }, [initialSearch]);

  // Debounce effect local to this component
  useEffect(() => {
    const handler = setTimeout(() => {
      onSearchChange(localSearch);
    }, 400); // Slightly more aggressive debounce for production feel

    return () => clearTimeout(handler);
  }, [localSearch, onSearchChange]);

  return (
    <div className="bg-white rounded-2xl p-4 md:p-6 shadow-elevated border border-border/50 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
      <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 items-stretch lg:items-end">
        {/* Search */}
        <div className="w-full lg:flex-1 space-y-2">
          <label htmlFor="shop-search" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
            {t("shop.filterSearch")}
          </label>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 h-4 w-4 text-primary" />
            <Input
              id="shop-search"
              name="shop-search"
              type="text"
              placeholder={t(ProductMessages.SEARCH)}
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              className="pl-12 h-14 rounded-2xl bg-muted/30 border-none focus-visible:ring-2 focus-visible:ring-primary/50 transition-all shadow-inner"
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
            <Select value={category} onValueChange={onCategoryChange}>
              <SelectTrigger aria-label={t(ShopMessages.FILTER_CATEGORY)} className="h-14 rounded-2xl bg-muted/30 border-none focus:ring-2 focus:ring-primary/50">
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
            <Select value={sortBy} onValueChange={onSortChange}>
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
  );
});

ShopFilters.displayName = "ShopFilters";
