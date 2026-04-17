import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Package, RotateCcw, Truck, X } from "lucide-react";
import { ProductMessages } from "@/constants/messages/ProductMessages";

interface ProductPricingInfoProps {
    displayPrice: number;
    displayMrp?: number;
    taxApplicable: boolean;
    priceIncludesTax: boolean;
    stockStatus: { text: string; color: string };
    inventory?: number;
    isReturnable: boolean;
    returnDays: number;
    deliveryRefundPolicy?: string;
    deliveryConfig?: any;
    formatAmount: (amount: number) => string;
}

export const ProductPricingInfo = memo(({
    displayPrice,
    displayMrp,
    taxApplicable,
    priceIncludesTax,
    stockStatus,
    inventory,
    isReturnable,
    returnDays,
    deliveryRefundPolicy,
    deliveryConfig,
    formatAmount
}: ProductPricingInfoProps) => {
    const { t } = useTranslation();

    return (
        <div className="space-y-4 lg:space-y-6">
            {/* Price & Taxes */}
            <div className="space-y-1">
                <div className="flex items-center gap-4">
                    <span className="text-3xl font-black text-[#B85C3C] transition-all duration-200">{formatAmount(displayPrice)}</span>
                    {displayMrp && displayMrp > displayPrice && (
                        <span className="text-lg text-muted-foreground line-through font-light opacity-50">{formatAmount(displayMrp)}</span>
                    )}
                </div>
                {taxApplicable && (
                    <p className="text-[10px] text-muted-foreground font-medium tracking-wide">
                        {priceIncludesTax ? t(ProductMessages.INCLUSIVE_TAX) : t(ProductMessages.EXCLUSIVE_TAX)}
                    </p>
                )}
            </div>

            {/* Stock status without number */}
            <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                    <Package size={16} className="text-muted-foreground" />
                    <span className={`text-sm font-bold ${stockStatus.color}`}>
                        {stockStatus.text}
                        {inventory !== undefined && inventory > 0 && inventory <= 15 && (
                            <span className="ml-2 text-[10px] text-orange-600 font-bold uppercase tracking-wider animate-pulse">
                                ({t('products.fewLeft', { count: inventory })})
                            </span>
                        )}
                    </span>
                </div>

                {/* Return Policy - Immediately below stock */}
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        {isReturnable ? (
                            <>
                                <RotateCcw className="h-4 w-4 text-green-600" />
                                <span className="text-xs font-medium text-green-600">
                                    {t(ProductMessages.DAYS_RETURN_AVAILABLE, { count: returnDays })}
                                </span>
                            </>
                        ) : (
                            <>
                                <X className="h-4 w-4 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">
                                    {t(ProductMessages.NON_RETURNABLE)}
                                </span>
                            </>
                        )}
                    </div>

                    {/* Delivery Refund Policy Badge */}
                    {deliveryRefundPolicy === 'NON_REFUNDABLE' && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500">
                            <div className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center">
                                <Truck className="h-2.5 w-2.5 text-orange-600" />
                            </div>
                            <span className="text-[10px] font-bold text-orange-700 uppercase tracking-wide">
                                {t(ProductMessages.NON_REFUNDABLE_DELIVERY)}
                            </span>
                        </div>
                    )}

                    {/* Dynamic Delivery Charge Info */}
                    {deliveryConfig && (
                        <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2 duration-500 mt-1">
                            <div className="w-4 h-4 rounded-full bg-blue-100 flex items-center justify-center">
                                <Truck className="h-2.5 w-2.5 text-blue-600" />
                            </div>
                            <span className="text-[10px] font-bold text-blue-700 uppercase tracking-wide">
                                {(() => {
                                    const config = deliveryConfig;
                                    let typeStr = '';
                                    if (config.calculation_type === 'PER_ITEM') typeStr = t(ProductMessages.PER_ITEM);
                                    else if (config.calculation_type === 'FLAT_PER_ORDER') typeStr = t(ProductMessages.PER_ORDER);
                                    else if (config.calculation_type === 'PER_PACKAGE') typeStr = t(ProductMessages.PER_PACKAGE);
                                    else typeStr = t(ProductMessages.WEIGHT_BASED);

                                    return t(ProductMessages.DELIVERY_CHARGE, { amount: `${formatAmount(config.base_delivery_charge)} / ${typeStr}` });
                                })()}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
});

ProductPricingInfo.displayName = "ProductPricingInfo";
