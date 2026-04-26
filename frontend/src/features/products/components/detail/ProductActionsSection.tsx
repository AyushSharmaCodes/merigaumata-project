import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Zap, Loader2, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import { ProductMessages } from "@/shared/constants/messages/ProductMessages";

interface ProductActionsSectionProps {
    isBuying: boolean;
    isAdding: boolean;
    quantity: number;
    displayStock: number;
    handleBuyNow: () => Promise<void>;
    handleAddToCart: () => Promise<void>;
    handleIncreaseQuantity: () => Promise<void>;
    handleDecreaseQuantity: () => Promise<void>;
}

export const ProductActionsSection = memo(({
    isBuying,
    isAdding,
    quantity,
    displayStock,
    handleBuyNow,
    handleAddToCart,
    handleIncreaseQuantity,
    handleDecreaseQuantity
}: ProductActionsSectionProps) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4">
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2.5">
                    <Button
                        size="lg"
                        onClick={handleBuyNow}
                        disabled={!displayStock || displayStock === 0 || isBuying}
                        className="w-full rounded-xl h-12 text-base font-bold bg-[#B85C3C] hover:bg-[#2C1810] transition-all duration-300 shadow-lg shadow-[#B85C3C]/10"
                    >
                        {isBuying ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                            <>
                                <Zap className="h-5 w-5 mr-3 fill-current" />
                                {t(ProductMessages.BUY_NOW)}
                            </>
                        )}
                    </Button>

                    {quantity > 0 ? (
                        <div className="space-y-2.5">
                            <div className="flex items-center justify-between bg-[#FAF7F2] p-2 rounded-xl border border-[#B85C3C]/10 mb-1">
                                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-2">{t(ProductMessages.CART_QUANTITY)}</span>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleDecreaseQuantity}
                                        className="h-8 w-8 rounded-full hover:bg-white transition-all shadow-sm"
                                    >
                                        <Minus size={14} />
                                    </Button>
                                    <span className="text-base font-black text-[#2C1810] w-4 text-center">{quantity}</span>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={handleIncreaseQuantity}
                                        disabled={displayStock !== undefined && displayStock > 0 && quantity >= displayStock}
                                        className="h-8 w-8 rounded-full hover:bg-white transition-all shadow-sm"
                                    >
                                        <Plus size={14} />
                                    </Button>
                                </div>
                            </div>
                            <Link to="/cart" className="block">
                                <Button variant="outline" size="lg" className="w-full rounded-xl h-12 text-base font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors">
                                    <ShoppingCart className="h-5 w-5 mr-3" />
                                    {t(ProductMessages.COMPLETE_ORDER)}
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <Button
                            variant="outline"
                            size="lg"
                            onClick={handleAddToCart}
                            disabled={!displayStock || displayStock === 0 || isAdding}
                            className="w-full rounded-xl h-12 text-base font-bold border-2 border-[#B85C3C]/20 text-[#B85C3C] hover:text-[#2C1810] hover:bg-[#FAF7F2] transition-colors"
                        >
                            {isAdding ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                                <>
                                    <ShoppingCart className="h-5 w-5 mr-3" />
                                    {t(ProductMessages.ADD_TO_CART)}
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
});

ProductActionsSection.displayName = "ProductActionsSection";
