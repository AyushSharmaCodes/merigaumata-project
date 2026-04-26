import { useTranslation, Trans } from "react-i18next";
import { Truck, RotateCcw, ShieldCheck } from "lucide-react";
import { CartTotals, Coupon } from "@/shared/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Separator } from "@/shared/components/ui/separator";
import { cn } from "@/core/utils/utils";
import { useCurrency } from "@/app/providers/currency-provider";

// Sub-components
import { AvailableOffers } from "./summary/AvailableOffers";
import { PriceBreakdown } from "./summary/PriceBreakdown";
import { DeliveryHandlingSection } from "./summary/DeliveryHandlingSection";
import { TaxBreakdownSection } from "./summary/TaxBreakdownSection";
import { CouponSection } from "./summary/CouponSection";
import { FinalTotalSection } from "./summary/FinalTotalSection";

interface CartSummaryProps {
    totals: CartTotals | null;
    itemsCount: number;
    isLoading: boolean;
    onApplyCoupon: (code: string) => Promise<boolean>;
    onRemoveCoupon: () => Promise<void>;
    onCheckout: () => void;
    availableCoupons?: Coupon[];
    deliverySettings?: { threshold: number; charge: number };
    isCalculating?: boolean;
}

export const CartSummary = ({
    totals,
    itemsCount,
    isLoading,
    onApplyCoupon,
    onRemoveCoupon,
    onCheckout,
    availableCoupons = [],
    deliverySettings = { threshold: 2000, charge: 100 },
    isCalculating = false,
    items = []
}: CartSummaryProps & { items?: any[] }) => {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();

    const effectiveThreshold = totals?.deliverySettings?.threshold ?? deliverySettings.threshold;
    const deliveryProgress = totals
        ? Math.min((totals.totalPrice / effectiveThreshold) * 100, 100)
        : 0;

    const remainingForFreeDelivery = totals
        ? Math.max(effectiveThreshold - totals.totalPrice, 0)
        : 0;

    return (
        <Card className="sticky top-24 shadow-xl border-border/40 bg-card/40 backdrop-blur-md animate-in slide-in-from-right-4 duration-500 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary/50 via-primary to-primary/50" />

            <CardHeader className="pb-4">
                <CardTitle className="text-2xl font-black tracking-tight font-playfair flex items-center justify-between">
                    {t("checkout.orderSummary")}
                    <div className="bg-primary/10 text-primary text-[10px] px-2 py-1 rounded-full uppercase tracking-widest font-bold">
                        {itemsCount} {itemsCount === 1 ? t("cart.item") : t("cart.items")}
                    </div>
                </CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
                <AvailableOffers 
                    coupons={availableCoupons} 
                    onApplyCoupon={onApplyCoupon} 
                />

                <div className="space-y-4 text-sm relative">
                    <div className={cn(
                        "space-y-3",
                        isCalculating && "opacity-50 blur-[1px] pointer-events-none"
                    )}>
                        <PriceBreakdown totals={totals} />
                        
                        <DeliveryHandlingSection 
                            totals={totals} 
                            items={items} 
                        />

                        <TaxBreakdownSection 
                            totals={totals} 
                            items={items} 
                        />
                    </div>

                    {isCalculating && (
                        <div className="absolute inset-0 flex items-center justify-center z-10 bg-background/20 backdrop-blur-[1px]">
                            <span className="flex items-center gap-2 px-3 py-1 bg-background/80 rounded-full border shadow-sm text-[10px] font-bold uppercase tracking-widest animate-pulse">
                                {t("cart.summary.applying")}
                            </span>
                        </div>
                    )}
                </div>

                {/* Delivery Progress */}
                {totals && (totals.globalDeliveryCharge || 0) > 0 && (
                    <div className="space-y-2">
                        <div className="h-1.5 w-full bg-muted/60 rounded-full overflow-hidden border border-border/10">
                            <div
                                className="h-full bg-primary transition-all duration-700 ease-out"
                                style={{ width: `${deliveryProgress}%` }}
                            />
                        </div>
                        <p className="text-[11px] text-muted-foreground text-center italic">
                            <Trans
                                i18nKey="cart.summary.addMoreForFreeDelivery"
                                values={{ amount: remainingForFreeDelivery.toFixed(2) }}
                                components={{
                                    bold: <span className="font-bold text-foreground" />,
                                    green: <span className="text-emerald-600 font-bold uppercase tracking-tighter" />
                                }}
                            />
                        </p>
                    </div>
                )}

                <CouponSection
                    totals={totals}
                    isLoading={isLoading}
                    onApplyCoupon={onApplyCoupon}
                    onRemoveCoupon={onRemoveCoupon}
                />

                <Separator className="opacity-50" />

                <FinalTotalSection
                    totals={totals}
                    itemsCount={itemsCount}
                    isLoading={isLoading}
                    isCalculating={isCalculating}
                    onCheckout={onCheckout}
                />

                <Separator className="opacity-30" />
                
                {/* Trust Badges */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="flex flex-col items-center gap-1 opacity-60">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">{t("cart.summary.trust.secure")}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-60">
                        <Truck className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">{t("cart.summary.trust.fast")}</span>
                    </div>
                    <div className="flex flex-col items-center gap-1 opacity-60">
                        <RotateCcw className="w-4 h-4 text-primary" />
                        <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-tighter">{t("cart.summary.trust.returns")}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
