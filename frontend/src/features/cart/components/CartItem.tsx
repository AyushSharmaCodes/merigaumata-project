import { memo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Minus, Plus, Trash2 } from "lucide-react";
import { CartItem as CartItemType } from "@/shared/types";
import { Button } from "@/shared/components/ui/button";
import { cn } from "@/core/utils/utils";
import { getLocalizedContent } from "@/core/utils/localizationUtils";

// Sub-components
import { CartItemImage } from "./item/CartItemImage";
import { CartItemInfo } from "./item/CartItemInfo";
import { CartItemPrice } from "./item/CartItemPrice";

interface CartItemProps {
    item: CartItemType;
    updateQuantity: (productId: string, quantity: number, variantId?: string) => Promise<void>;
    removeItem: (productId: string, variantId?: string) => Promise<void>;
    isLoading?: boolean;
    isCalculating?: boolean;
    isFreeDelivery?: boolean;
}

const CartItemComponent = ({ item, updateQuantity, removeItem, isLoading, isCalculating }: CartItemProps) => {
    const { t, i18n } = useTranslation();
    const { product, quantity, variant, sizeLabel, variantId } = item;

    // Pricing & Inventory
    const itemPrice = variant?.selling_price ?? product.price;
    const itemMRP = variant?.mrp ?? product.mrp ?? product.price;
    const itemStock = variant?.stock_quantity ?? product.inventory ?? 0;
    const displayImage = variant?.variant_image_url || product.images[0];

    const isDiscounted = itemMRP > itemPrice;
    const discountPercentage = isDiscounted ? Math.round(((itemMRP - itemPrice) / itemMRP) * 100) : 0;
    const isOutOfStock = itemStock === 0;

    // Tax Details
    const isTaxApplicable = variant?.tax_applicable ?? product.default_tax_applicable ?? false;
    const priceIncludesTax = variant?.price_includes_tax ?? product.default_price_includes_tax ?? false;
    const gstRate = variant?.gst_rate ?? product.default_gst_rate ?? 0;
    const itemTotal = itemPrice * quantity;
    const itemTaxAmount = priceIncludesTax
        ? (itemTotal - (itemTotal / (1 + (gstRate / 100))))
        : (itemTotal * (gstRate / 100));

    const handleRemove = useCallback(() => {
        removeItem(item.productId, variantId);
    }, [removeItem, item.productId, variantId]);

    const handleDecrease = useCallback(() => {
        if (quantity > 1) {
            updateQuantity(item.productId, quantity - 1, variantId);
        } else {
            removeItem(item.productId, variantId);
        }
    }, [quantity, updateQuantity, removeItem, item.productId, variantId]);

    const handleIncrease = useCallback(() => {
        updateQuantity(item.productId, quantity + 1, variantId);
    }, [quantity, updateQuantity, item.productId, variantId]);

    return (
        <div className={cn(
            "group relative flex flex-col sm:flex-row gap-4 p-4 bg-card/40 backdrop-blur-md hover:bg-card/60 border border-border/40 rounded-3xl transition-all duration-500 shadow-sm hover:shadow-xl hover:-translate-y-1 animate-in fade-in slide-in-from-bottom-4",
            "sm:min-h-[180px]"
        )}>
            {isCalculating && (
                <div className="absolute top-2 right-12 z-20 flex items-center gap-1.5 px-2 py-1 bg-background/80 backdrop-blur-sm rounded-lg border border-primary/20 shadow-sm animate-in fade-in duration-300">
                    <div className="h-2 w-2 border-2 border-primary/20 border-t-primary rounded-full animate-spin" />
                    <span className="text-[8px] font-black uppercase tracking-wider text-primary">
                        {t("products.syncing") || "Syncing..."}
                    </span>
                </div>
            )}

            <CartItemImage
                productId={item.productId}
                image={displayImage}
                title={getLocalizedContent(product, i18n.language, 'title')}
                isDiscounted={isDiscounted}
                discountPercentage={discountPercentage}
            />

            <div className="flex flex-1 flex-col min-w-0">
                <div className="flex justify-between items-start gap-4">
                    <CartItemInfo
                        productId={item.productId}
                        title={getLocalizedContent(product, i18n.language, 'title')}
                        category={getLocalizedContent(product.category_data, i18n.language) || product.category}
                        sizeLabel={variant ? getLocalizedContent(variant, i18n.language, 'size_label') : sizeLabel}
                        isOutOfStock={isOutOfStock}
                        isReturnable={((product as any).is_returnable !== undefined ? (product as any).is_returnable : product.isReturnable)}
                        returnDays={(product as any).return_days ?? product.returnDays ?? 7}
                        deliveryCharge={item.delivery_charge ?? 0}
                        deliveryGst={item.delivery_gst ?? 0}
                        deliveryMeta={item.delivery_meta}
                        couponDiscount={item.coupon_discount ?? 0}
                    />

                    <button
                        onClick={handleRemove}
                        disabled={isLoading}
                        className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 rounded-xl p-2.5 transition-all duration-300"
                    >
                        <Trash2 className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex items-center justify-between gap-4 mt-auto pt-4 border-t border-border/10">
                    <CartItemPrice
                        price={itemPrice}
                        mrp={itemMRP}
                        isDiscounted={isDiscounted}
                        isTaxApplicable={isTaxApplicable}
                        priceIncludesTax={priceIncludesTax}
                        gstRate={gstRate}
                        taxAmount={itemTaxAmount}
                    />

                    <div className="flex items-center gap-1 bg-muted/40 p-1.5 rounded-xl border border-border/10 shadow-sm self-end">
                        <Button
                            variant="ghost"
                            size="icon"
                            className={cn(
                                "h-8 w-8 rounded-lg transition-all duration-300",
                                quantity === 1 ? "hover:bg-destructive/10 hover:text-destructive" : "hover:bg-background hover:shadow-sm"
                            )}
                            onClick={handleDecrease}
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
                            onClick={handleIncrease}
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

export const CartItem = memo(CartItemComponent, (prevProps, nextProps) => {
    return (
        prevProps.item.productId === nextProps.item.productId &&
        prevProps.item.variantId === nextProps.item.variantId &&
        prevProps.item.quantity === nextProps.item.quantity &&
        prevProps.item.product.inventory === nextProps.item.product.inventory &&
        prevProps.item.variant?.stock_quantity === nextProps.item.variant?.stock_quantity &&
        prevProps.item.delivery_charge === nextProps.item.delivery_charge &&
        prevProps.item.delivery_gst === nextProps.item.delivery_gst &&
        prevProps.item.coupon_discount === nextProps.item.coupon_discount &&
        prevProps.isLoading === nextProps.isLoading &&
        prevProps.isCalculating === nextProps.isCalculating &&
        prevProps.isFreeDelivery === nextProps.isFreeDelivery
    );
});

CartItem.displayName = 'CartItem';
