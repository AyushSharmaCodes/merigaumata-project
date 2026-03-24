import { useState } from "react";
import { useTranslation, Trans } from "react-i18next";
import { Loader2, X, Truck, RotateCcw, ShieldCheck, Sparkles, Tag, CheckCircle2, Gift } from "lucide-react";
import { CartTotals, Coupon } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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
    deliverySettings = { threshold: 1500, charge: 50 },
    isCalculating = false,
    items = []
}: CartSummaryProps & { items?: any[] }) => {
    const { t } = useTranslation();
    const [couponCode, setCouponCode] = useState("");
    const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

    const handleApplyCoupon = async (codeOverride?: string) => {
        const code = codeOverride || couponCode;
        if (!code.trim()) {
            toast.error(t("cart.summary.enterCoupon"));
            return;
        }

        setIsApplyingCoupon(true);
        try {
            await onApplyCoupon(code);
            setCouponCode("");
        } finally {
            setIsApplyingCoupon(false);
        }
    };

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
                {/* Available Offers Section */}
                {availableCoupons.length > 0 && !totals?.coupon && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-700">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/80">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            {t("cart.summary.availableOffers")}
                        </div>
                        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
                            {availableCoupons.map((coupon) => (
                                <button
                                    key={coupon.id}
                                    onClick={() => handleApplyCoupon(coupon.code)}
                                    className="relative p-3.5 bg-gradient-to-br from-white to-primary/5 hover:from-primary/5 hover:to-primary/10 border border-primary/10 hover:border-primary/30 rounded-xl flex-shrink-0 w-44 transition-all hover:shadow-md active:scale-[0.98] text-left group snap-center overflow-hidden"
                                >
                                    {/* Decorative gradient overlay */}
                                    <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-50 group-hover:opacity-70 transition-opacity" />

                                    <div className="relative z-10 space-y-2.5">
                                        <div className="flex items-center justify-between">
                                            <div className="bg-gradient-to-r from-primary to-primary/80 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-md uppercase tracking-tight">
                                                {coupon.code}
                                            </div>
                                            <Gift className="w-4 h-4 text-primary opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
                                        </div>

                                        <div className="space-y-1">
                                            <p className="text-sm font-black text-foreground uppercase tracking-tight leading-tight">
                                                {coupon.type === 'free_delivery'
                                                    ? `🚚 ${t("products.freeShipping")}`
                                                    : `💰 ${t("products.off", { percent: coupon.discount_percentage || 0 })}`}
                                            </p>
                                            <p className="text-[10px] text-muted-foreground font-semibold">
                                                {coupon.min_purchase_amount
                                                    ? t("cart.summary.minPurchase", { amount: coupon.min_purchase_amount })
                                                    : t("cart.summary.noMinPurchase")}
                                            </p>
                                        </div>

                                        <div className="pt-1 border-t border-border/40">
                                            <p className="text-[9px] text-primary font-bold uppercase tracking-wider">
                                                {t("cart.summary.tapToApply")}
                                            </p>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Price Breakdown */}
                <div className="space-y-4 text-sm relative">
                    <div className={cn(
                        "space-y-3",
                        isCalculating && "opacity-50 blur-[1px] pointer-events-none"
                    )}>
                        <div className="flex justify-between text-muted-foreground font-medium">
                            <span>{t("cart.summary.itemsTotal")}</span>
                            <span className="text-foreground">₹{(totals?.totalMrp || 0).toFixed(2)}</span>
                        </div>

                        {totals && totals.discount > 0 && (
                            <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
                                <span className="flex items-center gap-1.5">
                                    <Tag className="w-3.5 h-3.5" />
                                    {t("cart.summary.productDiscounts")}
                                </span>
                                <span>-₹{totals.discount.toFixed(2)}</span>
                            </div>
                        )}

                        <div className="flex justify-between items-center pt-2 border-t border-dashed border-border/40">
                            <span className="text-muted-foreground font-medium">{t("cart.summary.sellingPrice")}</span>
                            <span className="font-bold text-foreground">₹{(totals?.totalPrice || ((totals?.totalMrp || 0) - (totals?.discount || 0))).toFixed(2)}</span>
                        </div>

                        {/* Delivery & Handling Section */}
                        {((totals?.deliveryCharge || 0) + (totals?.deliveryGST || 0)) > 0 && (
                            <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                                    <Truck className="w-3.5 h-3.5" />
                                    {t("cart.summary.deliveryHandling")}
                                </div>

                                {/* Standard Delivery - Always show, mark as FREE if coupon applied */}
                                {(() => {
                                    const globalCharge = totals?.globalDeliveryCharge ?? totals?.global_delivery_charge ?? 0;
                                    const globalGST = totals?.globalDeliveryGST ?? totals?.global_delivery_gst ?? 0;
                                    const globalTotal = globalCharge + globalGST;
                                    const isFreeDelivery = totals?.coupon?.type === 'free_delivery';

                                    // Show if there's a charge OR if free delivery is applied
                                    if (globalTotal > 0 || isFreeDelivery) {
                                        return (
                                            <div className="flex justify-between items-center group/del">
                                                <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                                    {t("cart.summary.standardDelivery")}
                                                    {!isFreeDelivery && (
                                                        <>
                                                            <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef")})</span>
                                                            {globalGST > 0 && (
                                                                <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                                                                    {t("cart.summary.inclTax")}
                                                                </span>
                                                            )}
                                                        </>
                                                    )}
                                                </span>
                                                <span className="font-bold text-xs flex items-center gap-2">
                                                    {isFreeDelivery ? (
                                                        <>
                                                            <span className="text-muted-foreground/40 line-through">
                                                                ₹{globalTotal.toFixed(2)}
                                                            </span>
                                                            <span className="text-emerald-600 font-black">{t("cart.summary.free")}</span>
                                                        </>
                                                    ) : (
                                                        <span className="text-foreground">
                                                            ₹{globalTotal.toFixed(2)}
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                        );
                                    }
                                    return null;
                                })()}

                                {/* Surcharges IIFE */}
                                {(() => {
                                    let refundableBase = 0;
                                    let refundableGst = 0;
                                    let nonRefundableBase = 0;
                                    let nonRefundableGst = 0;

                                    (items || []).forEach(item => {
                                        const meta = item.delivery_meta || {};
                                        const base = item.delivery_charge || 0;
                                        const gst = item.delivery_gst || 0;

                                        if (meta.source !== 'global') {
                                            if (meta.delivery_refund_policy === 'REFUNDABLE') {
                                                refundableBase += base;
                                                refundableGst += gst;
                                            } else if (meta.delivery_refund_policy === 'PARTIAL') {
                                                const nonRefBase = meta.non_refundable_delivery_charge || 0;
                                                const nonRefGst = meta.non_refundable_delivery_gst || 0;
                                                refundableBase += Math.max(0, base - nonRefBase);
                                                refundableGst += Math.max(0, gst - nonRefGst);
                                                nonRefundableBase += nonRefBase;
                                                nonRefundableGst += nonRefGst;
                                            } else {
                                                nonRefundableBase += base;
                                                nonRefundableGst += gst;
                                            }
                                        }
                                    });

                                    const refundableTotal = refundableBase + refundableGst;
                                    const nonRefundableTotal = nonRefundableBase + nonRefundableGst;

                                    return (
                                        <>
                                            {refundableTotal > 0 && (
                                                <div className="flex justify-between items-center pl-1 group/sur">
                                                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
                                                        {t("products.refundableSurcharge")}
                                                        {refundableGst > 0 && (
                                                            <span className="text-[8px] uppercase tracking-wider text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0 rounded-sm font-bold">
                                                                {t("cart.summary.inclTax")}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-bold text-xs text-blue-600/90">
                                                        ₹{refundableTotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                            {nonRefundableTotal > 0 && (
                                                <div className="flex justify-between items-center pl-1 group/sur">
                                                    <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                                                        {t("products.additionalProcessing")}
                                                        <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef")})</span>
                                                        {nonRefundableGst > 0 && (
                                                            <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                                                                {t("cart.summary.inclTax")}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="font-bold text-xs text-orange-600/90">
                                                        ₹{nonRefundableTotal.toFixed(2)}
                                                    </span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                            </div>
                        )}

                        {/* Detailed Tax Breakdown */}
                        {totals && (totals.tax?.totalTax ?? 0) > 0 && totals.tax && (
                            <div className="pt-3 border-t border-dashed border-border/40 space-y-2">
                                <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                                    <Sparkles className="w-3 h-3 text-primary/70" />
                                    {t("cart.summary.taxBreakdown")}
                                </div>

                                <div className="flex justify-between items-center px-1 pt-1 border-t border-border/5">
                                    <span className="text-[10px] text-muted-foreground font-medium italic">
                                        {t("cart.summary.taxDisclaimerInclusive")}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground/80 font-bold">
                                        ₹{totals.tax.totalTax.toFixed(2)}
                                    </span>
                                </div>

                                <details className="group mt-1 px-1">
                                    <summary className="text-[9px] text-primary cursor-pointer hover:opacity-80 transition-opacity mb-1 list-none flex items-center gap-1 font-bold uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/30 group-open:bg-primary transition-colors animate-pulse" />
                                        <span>{t("cart.summary.viewProductTax")}</span>
                                    </summary>
                                    <div className="bg-muted/30 rounded-xl p-3 space-y-2.5 mt-2 max-h-[160px] overflow-y-auto custom-scrollbar border border-border/10 shadow-inner">
                                        {/* Product Tax */}
                                        {(items || []).map((item, idx) => {
                                            const taxBreakdown = item.tax_breakdown;
                                            const taxRate = taxBreakdown?.gst_rate ?? item.variant?.gst_rate ?? item.product?.default_gst_rate ?? 0;
                                            const itemTax = taxBreakdown?.total_tax ?? 0;
                                            const taxableAmount = taxBreakdown?.taxable_amount ?? 0;

                                            if (taxRate <= 0 && itemTax <= 0) return null;

                                            return (
                                                <div key={`tax-${idx}`} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                                                        <span className="truncate max-w-[140px]">{item.product?.title || t("cart.item")}</span>
                                                        <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">{taxRate}% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 opacity-80">
                                                        <span>{t("cart.summary.taxableAmount")}</span>
                                                        <span>₹{taxableAmount.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 font-bold text-foreground/60">
                                                        <span>{t("cart.summary.taxAmount")}</span>
                                                        <span>₹{itemTax.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {/* Delivery Tax */}
                                        {(() => {
                                            const delTaxLines = [];
                                            const globalDeliveryGST = totals?.globalDeliveryGST ?? totals?.global_delivery_gst ?? 0;
                                            if (globalDeliveryGST > 0) {
                                                delTaxLines.push({ label: t("products.standardDeliveryGst"), amount: globalDeliveryGST });
                                            }
                                            let surchargeGST = 0;
                                            (items || []).forEach(it => { if (it.delivery_meta?.source !== 'global') surchargeGST += (it.delivery_gst || 0); });
                                            if (surchargeGST > 0) {
                                                delTaxLines.push({ label: t("products.surchargeGst"), amount: surchargeGST });
                                            }

                                            return delTaxLines.map((line, lidx) => (
                                                <div key={`del-tax-${lidx}`} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                                                        <span>{line.label}</span>
                                                        <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">18% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 font-bold text-foreground/60">
                                                        <span>{t("cart.summary.taxAmount")}</span>
                                                        <span>₹{line.amount.toFixed(2)}</span>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>

                    {/* Loader */}
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

                {totals?.coupon && (totals.couponDiscount > 0 || totals.coupon.type === 'free_delivery') && (
                    <div className="flex justify-between text-[#0D9488] font-bold pt-1 border-t border-dashed border-[#CCFBF1]">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5" />
                            {t("cart.summary.couponApplied")} ({totals.coupon.code})
                        </span>
                        <span>
                            {totals.coupon.type === 'free_delivery' && (totals.couponDiscount || 0) === 0
                                ? t("cart.summary.couponApplied")
                                : `-₹${(totals.couponDiscount || 0).toFixed(2)}`}
                        </span>
                    </div>
                )}

                <Separator className="opacity-50" />

                {/* Apply Promotion Section */}
                <div className="space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
                        <Tag className="w-3.5 h-3.5 text-primary" />
                        {t("cart.summary.applyPromotion")}
                    </div>

                    {totals?.coupon ? (
                        <div className="relative group">
                            <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl animate-in zoom-in-95 duration-300">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="flex-1 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-tight">
                                                {totals.coupon.code}
                                            </div>
                                            <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold">
                                                <CheckCircle2 className="w-3.5 h-3.5" />
                                                {t("cart.summary.couponApplied")}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm font-bold text-emerald-900">
                                                {totals.coupon.type === 'free_delivery'
                                                    ? t("cart.summary.unlockedFreeDelivery")
                                                    : t("cart.summary.discountApplied", { percentage: totals.coupon.discount_percentage })}
                                            </p>
                                            {totals.couponDiscount > 0 && (
                                                <p className="text-xs text-emerald-700 font-semibold">
                                                    {t("cart.summary.youSaved", { amount: totals.couponDiscount.toFixed(2) })}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        onClick={onRemoveCoupon}
                                        disabled={isLoading}
                                        className="p-2 hover:bg-emerald-100 rounded-lg transition-colors group-hover:opacity-100 opacity-60"
                                        title={t("cart.summary.removeCoupon")}
                                    >
                                        <X className="w-4 h-4 text-emerald-700" />
                                    </button>
                                </div>
                            </div>
                            <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl opacity-20 blur-sm -z-10 group-hover:opacity-30 transition-opacity" />
                        </div>
                    ) : (
                        <div className="relative">
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Input
                                        placeholder={t("cart.summary.enterCouponPlaceholder")}
                                        value={couponCode}
                                        onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && couponCode.trim()) {
                                                handleApplyCoupon();
                                            }
                                        }}
                                        disabled={isLoading || isApplyingCoupon}
                                        className="h-12 px-4 pr-10 rounded-xl border-2 border-border/60 focus:border-primary/50 font-mono text-sm font-bold uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-normal transition-all"
                                    />
                                    {couponCode && (
                                        <button
                                            onClick={() => setCouponCode('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
                                        >
                                            <X className="w-4 h-4 text-muted-foreground" />
                                        </button>
                                    )}
                                </div>
                                <Button
                                    onClick={() => handleApplyCoupon()}
                                    disabled={!couponCode || isLoading || isApplyingCoupon}
                                    className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
                                >
                                    {isApplyingCoupon ? (
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            <span className="hidden sm:inline">{t("cart.summary.applying")}</span>
                                        </div>
                                    ) : (
                                        t("cart.summary.apply")
                                    )}
                                </Button>
                            </div>
                            {isApplyingCoupon && (
                                <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] rounded-xl animate-in fade-in duration-200" />
                            )}
                        </div>
                    )}
                </div>

                <Separator className="opacity-50" />

                {/* Final Total */}
                <div className="space-y-4">
                    <div className="flex justify-between items-end">
                        <span className="text-sm font-bold text-muted-foreground/60 tracking-tight">{t("cart.summary.totalPay")}</span>
                        <div className="text-right">
                            <span className="text-3xl font-black text-primary block leading-none tracking-tight font-playfair">
                                ₹{totals?.finalAmount?.toFixed(2) || '0.00'}
                            </span>
                            <span className="text-[10px] text-muted-foreground/40 font-medium tracking-wide mt-1 block">
                                {t("cart.summary.includingGst")}
                            </span>
                        </div>
                    </div>

                    {(() => {
                        const freeDeliverySavings = totals?.coupon?.type === 'free_delivery' ? (totals?.deliverySettings?.charge || 0) : 0;
                        const totalSavings = (totals?.discount || 0) + (totals?.couponDiscount || 0) + freeDeliverySavings;

                        return totals && totalSavings > 0 ? (
                            <div className="bg-[#F0FDFA] border border-[#CCFBF1] text-[#0D9488] text-[11px] p-3 rounded-xl text-center font-bold animate-in zoom-in-95">
                                {t("cart.summary.savingsMessage", { amount: totalSavings.toFixed(2) })}
                            </div>
                        ) : null;
                    })()}

                    <div className="bg-amber-100 border border-amber-200 rounded-lg p-3 mb-4" style={{ display: 'block', visibility: 'visible' }}>
                        <p className="text-amber-900 text-[10px] font-bold flex items-center gap-2 m-0">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {t("checkout.codNotSupported", "Note: Cash on Delivery (COD) is not currently supported.")}
                        </p>
                    </div>

                    <Button
                        size="lg"
                        className="w-full h-14 text-lg font-bold shadow-lg rounded-2xl bg-[#BA5C3C] hover:bg-[#A54B2D] transition-all duration-300"
                        onClick={onCheckout}
                        disabled={isLoading || isCalculating || itemsCount === 0}
                    >
                        {isLoading ? <Loader2 className="animate-spin mr-2" /> : t("cart.summary.checkoutSecurely")}
                    </Button>
                </div>

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
