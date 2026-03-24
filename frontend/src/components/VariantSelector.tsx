import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";
import type { ProductVariant } from "@/types";

interface VariantSelectorProps {
    variants: ProductVariant[];
    selectedVariantId: string;
    onSelect: (variant: ProductVariant) => void;
    className?: string;
}

/**
 * User-facing variant selector component
 * Displays pill-style buttons for size selection with price comparison and stock indicators
 */
export function VariantSelector({
    variants,
    selectedVariantId,
    onSelect,
    className,
}: VariantSelectorProps) {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
    if (!variants || variants.length === 0) {
        return null;
    }

    // Sort by size_value for consistent display
    const sortedVariants = [...variants].sort((a, b) => a.size_value - b.size_value);

    // Calculate best value (highest discount %)
    const bestValueVariant = sortedVariants.reduce<ProductVariant | null>(
        (best, current) => {
            const currentDiscount = getDiscountPercent(current.mrp, current.selling_price);
            const bestDiscount = best
                ? getDiscountPercent(best.mrp, best.selling_price)
                : 0;
            return currentDiscount > bestDiscount ? current : best;
        },
        null
    );

    function getDiscountPercent(mrp: number, sellingPrice: number): number {
        if (mrp <= 0 || sellingPrice >= mrp) return 0;
        return Math.round(((mrp - sellingPrice) / mrp) * 100);
    }

    function getStockStatus(
        stockQuantity: number
    ): { label: string; className: string } | null {
        if (stockQuantity === 0) {
            return { label: t("variants.outOfStock", "Out of Stock"), className: "bg-red-100 text-red-700" };
        }
        if (stockQuantity < 10) {
            return {
                label: t("variants.unitsLeft", { count: stockQuantity, defaultValue: `Only ${stockQuantity} left` }),
                className: "bg-amber-100 text-amber-700",
            };
        }
        return null;
    }

    return (
        <div className={cn("space-y-3", className)}>
            <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    {t("variants.selectSize", "Select Size")}
                </span>
            </div>

            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("variants.selectSize", "Select product size")}>
                {sortedVariants.map((variant) => {
                    const isSelected = variant.id === selectedVariantId;
                    const isOutOfStock = variant.stock_quantity === 0;
                    const discount = getDiscountPercent(variant.mrp, variant.selling_price);
                    const isBestValue =
                        bestValueVariant?.id === variant.id && discount > 0;
                    const stockStatus = getStockStatus(variant.stock_quantity);

                    return (
                        <button
                            key={variant.id}
                            type="button"
                            role="radio"
                            aria-checked={isSelected}
                            aria-disabled={isOutOfStock}
                            disabled={isOutOfStock}
                            onClick={() => !isOutOfStock && onSelect(variant)}
                            className={cn(
                                "relative flex flex-col items-center justify-center",
                                "min-w-[80px] px-4 py-3 rounded-xl border-2 transition-all duration-200",
                                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#B85C3C]",
                                isSelected
                                    ? "border-[#B85C3C] bg-[#B85C3C]/5 shadow-md"
                                    : "border-[#B85C3C]/20 hover:border-[#B85C3C]/50 bg-white",
                                isOutOfStock &&
                                "opacity-50 cursor-not-allowed border-gray-200 bg-gray-50"
                            )}
                        >
                            {/* Best Value Badge */}
                            {isBestValue && !isOutOfStock && (
                                <Badge
                                    className="absolute -top-2 -right-2 text-[8px] px-1.5 py-0.5 bg-[#D4AF37] text-white border-none"
                                >
                                    {t("variants.bestValue", "Best Value")}
                                </Badge>
                            )}

                            {/* Size Label */}
                            <span
                                className={cn(
                                    "font-bold text-sm",
                                    isSelected ? "text-[#B85C3C]" : "text-[#2C1810]",
                                    isOutOfStock && "text-gray-400"
                                )}
                            >
                                {variant.size_label}
                            </span>



                            {/* Price */}
                            <span
                                className={cn(
                                    "text-xs font-medium mt-1",
                                    isSelected ? "text-[#B85C3C]" : "text-muted-foreground",
                                    isOutOfStock && "text-gray-400"
                                )}
                            >
                                {formatAmount(variant.selling_price)}
                                {variant.price_includes_tax === false && <span className="text-[9px] ml-0.5 opacity-80">{t("variants.taxPlus", "+ Tax")}</span>}
                            </span>

                            {/* Discount Indicator */}
                            {discount > 0 && !isOutOfStock && (
                                <span className="text-[10px] text-green-600 font-medium">
                                    {discount}{t("variants.off", "% off")}
                                </span>
                            )}

                            {/* Stock Warning */}
                            {stockStatus && !isOutOfStock && (
                                <span
                                    className={cn(
                                        "absolute -bottom-2 text-[8px] px-1.5 py-0.5 rounded",
                                        stockStatus.className
                                    )}
                                >
                                    {stockStatus.label}
                                </span>
                            )}

                            {/* Out of Stock Overlay */}
                            {isOutOfStock && (
                                <span className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-xl">
                                    <span className="text-[10px] text-red-600 font-medium">
                                        {t("variants.soldOut", "Sold Out")}
                                    </span>
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Selected Variant Summary */}
            {selectedVariantId && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    {(() => {
                        const selected = variants.find((v) => v.id === selectedVariantId);
                        if (!selected) return null;
                        const discount = getDiscountPercent(
                            selected.mrp,
                            selected.selling_price
                        );
                        return (
                            <>
                                <span>
                                    {selected.size_label}
                                    {" - "}{formatAmount(selected.selling_price)}
                                </span>
                                {discount > 0 && (
                                    <span className="text-green-600 font-medium">
                                        ({t("variants.save", "Save")} {formatAmount(selected.mrp - selected.selling_price)})
                                    </span>
                                )}
                            </>
                        );
                    })()}
                </div>
            )}
        </div>
    );
}
