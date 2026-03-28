import { memo } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Minus, Plus, Trash2, RotateCcw, Package, Star, Heart, Truck, Tag } from "lucide-react";
import { CartItem as CartItemType } from "@/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";
import { getLocalizedContent } from "@/utils/localizationUtils";

interface CartItemProps {
    item: CartItemType;
    updateQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
    removeItem: (productId: string, variantId?: string) => Promise<void>;
    isLoading?: boolean;
    isCalculating?: boolean;
    isFreeDelivery?: boolean;
}

const CartItemComponent = ({ item, updateQuantity, removeItem, isLoading, isCalculating, isFreeDelivery }: CartItemProps) => {
    const { t, i18n } = useTranslation();
    const { formatAmount } = useCurrency();
    const { product, quantity, variant, sizeLabel, variantId } = item;

    // Use variant pricing if available, otherwise fall back to product pricing
    const itemPrice = variant?.selling_price ?? product.price;
    const itemMRP = variant?.mrp ?? product.mrp ?? product.price;
    const itemStock = variant?.stock_quantity ?? product.inventory ?? 0;
    const displayImage = variant?.variant_image_url || product.images[0];

    const isDiscounted = itemMRP > itemPrice;
    const discountPercentage = isDiscounted
        ? Math.round(((itemMRP - itemPrice) / itemMRP) * 100)
        : 0;

    const isLowStock = itemStock > 0 && itemStock <= 5;
    const isOutOfStock = itemStock === 0;

    const isTaxApplicable = variant?.tax_applicable ?? product.default_tax_applicable ?? false;
    const priceIncludesTax = variant?.price_includes_tax ?? product.default_price_includes_tax ?? false;

    // Calculate item-level tax for transparency
    const gstRate = variant?.gst_rate ?? product.default_gst_rate ?? 0;
    const itemTotal = itemPrice * quantity;
    const itemTaxAmount = priceIncludesTax
        ? (itemTotal - (itemTotal / (1 + (gstRate / 100))))
        : (itemTotal * (gstRate / 100));

    return (
        <div className={cn(
            "group relative flex flex-col sm:flex-row gap-4 p-4 bg-card/40 backdrop-blur-md hover:bg-card/60 border border-border/40 rounded-3xl transition-all duration-500 shadow-sm hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4",
            "sm:min-h-[180px]"
        )}>
            {/* Subtle Syncing Indicator (Non-blocking) */}
            {isCalculating && (
                <div className="absolute top-2 right-12 z-20 flex items-center gap-1.5 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-lg border border-primary/20 shadow-sm animate-in fade-in duration-300">
                    <div className="h-2 w-2 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-primary">
                        {t("products.syncing") || "Syncing..."}
                    </span>
                </div>
            )}

            {/* Product Image Section */}
            <div className="relative shrink-0 w-full sm:w-44 aspect-square">
                        <Link to={`/product/${item.productId}`} className="block h-full w-full overflow-hidden rounded-2xl shadow-inner border border-border/20 group/img">
                    <img
                        src={displayImage}
                        alt={getLocalizedContent(product, i18n.language, 'title')}
                        className="h-full w-full object-cover transition-transform duration-1000 ease-out group-hover/img:scale-110"
                        loading="lazy"
                    />
                </Link>

                {isDiscounted && (
                    <div className="absolute top-2.5 left-2.5 z-10">
                        <div className="bg-destructive/90 text-white text-[10px] font-black px-2 py-1 rounded-lg backdrop-blur-md shadow-lg border border-white/20">
                            -{discountPercentage}%
                        </div>
                    </div>
                )}
            </div>

            {/* Content Section */}
            <div className="flex flex-1 flex-col min-w-0">
                <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1.5 flex-1 min-w-0 pt-1">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <span className="text-[10px] uppercase tracking-widest font-black text-[#A16207] bg-[#FEF9C3] px-2.5 py-1 rounded-md">
                                {getLocalizedContent(product.category_data, i18n.language) || product.category}
                            </span>
                            {(sizeLabel || variant?.size_label) && (
                                <span className="text-[10px] uppercase tracking-widest font-black text-[#A16207] bg-[#FFEDD5] px-2.5 py-1 rounded-md">
                                    {variant ? getLocalizedContent(variant, i18n.language, 'size_label') : sizeLabel}
                                </span>
                            )}
                            {isOutOfStock ? (
                                <span className="text-[9px] font-black uppercase text-destructive flex items-center gap-1.5 ml-1">
                                    <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
                                    {t("products.outOfStock")}
                                </span>
                            ) : (
                                <span className="text-[9px] font-black uppercase text-[#059669] flex items-center gap-1.5 ml-1 bg-[#ECFDF5] px-2 py-1 rounded-md">
                                    <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
                                    {t("products.inStock")}
                                </span>
                            )}
                        </div>

                        <Link
                            to={`/product/${item.productId}`}
                            className="block font-bold text-lg sm:text-xl hover:text-primary transition-all duration-300 line-clamp-1 leading-tight tracking-tight mb-2"
                        >
                            {getLocalizedContent(product, i18n.language, 'title')}
                        </Link>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                            {((product as any).is_returnable !== undefined ? (product as any).is_returnable : product.isReturnable) ? (
                                <div className="flex items-center gap-1.5 text-muted-foreground/80">
                                    <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
                                    <span className="text-[10px] font-medium">{t("products.daysReturnShort", { count: (product as any).return_days ?? product.returnDays ?? 7 })}</span>
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 text-muted-foreground/60">
                                    <Package className="w-3.5 h-3.5" />
                                    <span className="text-[10px] font-medium">{t("products.noReturns")}</span>
                                </div>
                            )}

                            {(item.delivery_charge ?? 0) > 0 && item.delivery_meta?.source !== 'global' ? (
                                <div className="flex flex-col items-start gap-1 w-full">
                                    <div className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider text-[#9A3412] bg-[#FFF7ED] px-2.5 py-1 rounded-full border border-[#FDBA74]">
                                        <Truck className="w-3 h-3" />
                                        <span>
                                            +{formatAmount((item.delivery_charge ?? 0) + (item.delivery_gst ?? 0))} {t("products.surcharge")}
                                        </span>
                                    </div>
                                    {item.delivery_meta && (
                                        <div className="flex flex-col pl-1 space-y-0.5">
                                            <span className="text-[10px] text-muted-foreground/70 font-bold italic leading-tight">
                                                {item.delivery_meta.calculation_type === 'PER_ITEM' && `(${formatAmount(item.delivery_meta.base_charge)} / ${t("products.perItem")})`}
                                                {item.delivery_meta.calculation_type === 'PER_PACKAGE' && `(${formatAmount(item.delivery_meta.base_charge)} / ${t("products.perPackage")})`}
                                                {item.delivery_meta.calculation_type === 'WEIGHT_BASED' && `(${t("products.heavyItemSurcharge")})`}
                                                {item.delivery_meta.calculation_type === 'FLAT_PER_ORDER' && `(${t("products.flatProductCharge")})`}
                                            </span>
                                            {(item.delivery_gst ?? 0) > 0 && (
                                                <span className="text-[9px] text-muted-foreground/50 font-medium">
                                                    ({t("products.includes")} {formatAmount(item.delivery_gst ?? 0)} GST)
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ) : null}

                            {(item.coupon_discount ?? 0) > 0 && (
                                <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-md text-[10px] font-black text-primary border border-primary/20">
                                    <Tag className="w-3 h-3" />
                                    <span>-{formatAmount(item.coupon_discount || 0)} {t("products.saved")}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    <button
                        onClick={() => removeItem(item.productId, variantId)}
                        disabled={isLoading}
                        className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl p-2.5 transition-all duration-300"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                {/* Price and Quantity Footer */}
                <div className="flex items-center justify-between gap-4 mt-auto pt-4 border-t border-border/10">
                    <div className="flex flex-col">
                        <div className="flex items-baseline gap-2.5">
                            <span className="text-2xl font-black text-foreground tracking-tighter">
                                {formatAmount(itemPrice)}
                            </span>
                            {isDiscounted && (
                                <span className="text-sm text-muted-foreground/60 line-through font-medium">
                                    {formatAmount(itemMRP)}
                                </span>
                            )}
                        </div>
                        {isTaxApplicable && (
                            <div className="flex flex-col">
                                <span className="text-[10px] text-muted-foreground/60 font-medium">
                                    {priceIncludesTax ? t("products.inclusiveTax") : t("products.exclusiveTaxShort")}
                                </span>
                                {gstRate > 0 && (
                                    <span className="text-[9px] text-muted-foreground/40 font-bold italic">
                                        ({priceIncludesTax ? t("products.includes") : "+"} {formatAmount(itemTaxAmount)} {gstRate}% GST)
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-xl border border-border/10 shadow-sm self-end">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 rounded-lg transition-all duration-300",
                                quantity === 1 ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-background hover:shadow-sm"
                            )}
                            onClick={() => {
                                if (quantity > 1) updateQuantity(item.productId, quantity - 1, variantId);
                                else removeItem(item.productId, variantId);
                            }}
                            disabled={isLoading}
                        >
                            {quantity === 1 ? <Trash2 className="w-3.5 h-3.5" /> : <Minus className="w-3.5 h-3.5" />}
                        </Button>
                        <div className="w-8 text-center font-bold text-sm tabular-nums text-foreground/80">
                            {quantity}
                        </div>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-lg hover:bg-background hover:shadow-sm transition-all duration-300"
                            onClick={() => updateQuantity(item.productId, quantity + 1, variantId)}
                            disabled={isLoading || quantity >= itemStock}
                        >
                            <Plus className="w-3.5 h-3.5" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Memoize CartItem to prevent re-renders when other items in the cart change
// Only re-render when this specific item's data or loading state changes
export const CartItem = memo(CartItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.item.productId === nextProps.item.productId &&
        prevProps.item.variantId === nextProps.item.variantId &&
        prevProps.item.quantity === nextProps.item.quantity &&
        prevProps.item.delivery_charge === nextProps.item.delivery_charge &&
        prevProps.item.delivery_gst === nextProps.item.delivery_gst &&
        prevProps.item.coupon_discount === nextProps.item.coupon_discount &&
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.isCalculating === nextProps.isCalculating &&
        prevProps.isFreeDelivery === nextProps.isFreeDelivery
    );
});

CartItem.displayName = 'CartItem';
