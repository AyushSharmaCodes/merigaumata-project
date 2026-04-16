import { memo } from "react";
import { CartTotals } from "@/types";
import { Separator } from "@/components/ui/separator";
import { Tag, Truck, Wallet, Sparkles, ShieldCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { CartMessages } from "@/constants/messages/CartMessages";
import { useCurrency } from "@/contexts/CurrencyContext";

interface PriceBreakdownProps {
    totals: CartTotals;
}

export const PriceBreakdown = memo(({ totals, items = [] }: PriceBreakdownProps & { items?: any[] }) => {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const totalSavings = (totals.discount || 0) + (totals.couponDiscount || 0);

    return (
        <div className="space-y-3 pt-1">
            <h3 className="font-black text-[10px] uppercase tracking-[0.2em] flex items-center gap-2 text-muted-foreground/60 mb-1">
                <Wallet className="w-3.5 h-3.5" />
                {t(CheckoutMessages.PAYMENT_DETAILS)}
            </h3>

            <div className="space-y-2 text-sm">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">{t(CheckoutMessages.SUBTOTAL_MRP)}</span>
                    <span className="font-medium">{formatAmount(totals.totalMrp ?? totals.totalPrice ?? 0)}</span>
                </div>

                {totals.discount > 0 && (
                    <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400">
                        <span className="flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5" />
                            {t(CheckoutMessages.PRODUCT_DISCOUNT)}
                        </span>
                        <span className="font-medium">-{formatAmount(totals.discount || 0)}</span>
                    </div>
                )}

                <div className="flex justify-between items-center pt-1 border-t border-dashed border-border/40">
                    <span className="text-muted-foreground font-medium">{t(CheckoutMessages.SELLING_PRICE)}</span>
                    <span className="font-bold">{formatAmount(totals.totalPrice || (totals.totalMrp - totals.discount))}</span>
                </div>

                {totals.coupon && (totals.couponDiscount > 0 || totals.coupon.type === 'free_delivery') && (
                    <div className="flex justify-between items-center text-[#0D9488] font-bold">
                        <span className="flex items-center gap-1.5">
                            <Sparkles className="h-3.5 w-3.5" />
                            {t(CheckoutMessages.COUPON)} ({totals.coupon?.code})
                        </span>
                        <span>
                            {totals.coupon.type === 'free_delivery' && (totals.couponDiscount || 0) === 0
                                ? t(CheckoutMessages.APPLIED)
                                : `-${formatAmount(totals.couponDiscount || 0)}`}
                        </span>
                    </div>
                )}

                {/* Delivery & Handling Section */}
                {((totals.deliveryCharge || 0) + (totals.deliveryGST || 0)) > 0 && (
                    <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Truck className="w-3 h-3 text-primary/70" />
                            {t(CartMessages.DELIVERY_HANDLING)}
                        </div>

                        {/* Standard Delivery row */}
                        {(totals.globalDeliveryCharge ?? 0) > 0 && (
                            <div className="flex justify-between items-center pl-1 group/del">
                                <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                    {t(CartMessages.STANDARD_DELIVERY)}
                                    <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t(CheckoutMessages.NON_REFUNDABLE)})</span>
                                    {(totals.globalDeliveryGST ?? 0) > 0 && (
                                        <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                                            {t(CheckoutMessages.INCL_TAX)}
                                        </span>
                                    )}
                                </span>
                                <span className="font-bold text-xs">
                                    {formatAmount((totals.globalDeliveryCharge ?? 0) + (totals.globalDeliveryGST ?? 0))}
                                </span>
                            </div>
                        )}

                        {/* Item Surcharges (Split by Refundability) */}
                        {(() => {
                            let refundableBase = 0;
                            let refundableGst = 0;
                            let nonRefundableBase = 0;
                            let nonRefundableGst = 0;

                            items.forEach(item => {
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
                                                {t(CheckoutMessages.REFUNDABLE_SURCHARGE)}
                                                {refundableGst > 0 && (
                                                    <span className="text-[8px] uppercase tracking-wider text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0 rounded-sm font-bold">
                                                        {t(CheckoutMessages.INCL_TAX)}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="font-bold text-xs text-blue-600/90">
                                                {formatAmount(refundableTotal)}
                                            </span>
                                        </div>
                                    )}
                                    {nonRefundableTotal > 0 && (
                                        <div className="flex justify-between items-center pl-1 group/sur">
                                            <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
                                                <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
                                                {t(CheckoutMessages.ADDITIONAL_PROCESSING)}
                                                <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t(CheckoutMessages.NON_REF)})</span>
                                                {nonRefundableGst > 0 && (
                                                    <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                                                        {t(CheckoutMessages.INCL_TAX)}
                                                    </span>
                                                )}
                                            </span>
                                            <span className="font-bold text-xs text-orange-600/90">
                                                {formatAmount(nonRefundableTotal)}
                                            </span>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </div>
                )}

                {/* Detailed Tax Breakdown */}
                {totals.tax && totals.tax.totalTax > 0 && (
                    <div className="pt-3 border-t border-dashed border-border/40 space-y-2">
                        <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
                            <Sparkles className="w-3 h-3 text-primary/70" />
                            {t(CheckoutMessages.TAX_BREAKDOWN_GST)}
                        </div>

                        <div className="flex justify-between items-center px-1 pt-1 border-t border-border/5">
                            <span className="text-[10px] text-muted-foreground font-medium italic">{t(CheckoutMessages.INCL_TAX)}</span>
                            <span className="text-[10px] text-muted-foreground/80 font-bold">{formatAmount(totals.tax.totalTax)}</span>
                        </div>

                        {/* Product-wise Tax Breakdown (Collapsible/Inline) */}
                        {items && items.length > 0 && (
                            <div className="mt-1">
                                <details className="group px-1">
                                    <summary className="text-[9px] text-primary cursor-pointer hover:opacity-80 transition-opacity mb-1 list-none flex items-center gap-1 font-bold uppercase tracking-wider">
                                        <div className="w-1.5 h-1.5 rounded-full bg-primary/30 group-open:bg-primary transition-colors animate-pulse" />
                                        <span>{t(CheckoutMessages.VIEW_PRODUCT_WISE_TAX)}</span>
                                    </summary>
                                    <div className="bg-muted/30 rounded-xl p-3 space-y-2.5 mt-2 max-h-[160px] overflow-y-auto custom-scrollbar border border-border/10 shadow-inner">
                                        {items.map((item, idx) => {
                                            const taxBreakdown = item.tax_breakdown;
                                            const taxRate = taxBreakdown?.gst_rate ?? item.variant?.gst_rate ?? item.product?.default_gst_rate ?? item.gst_rate ?? 0;
                                            const title = item.product?.title || item.title || t(CartMessages.ITEM);
                                            const taxableAmount = taxBreakdown?.taxable_amount ?? 0;
                                            const itemTax = taxBreakdown?.total_tax ?? 0;

                                            if (taxRate <= 0 && itemTax <= 0) return null;

                                            return (
                                                <div key={idx} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                                                        <span className="truncate max-w-[140px]">{title}</span>
                                                        <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">{taxRate}% GST</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 opacity-80">
                                                        <span>{t(CheckoutMessages.TAXABLE_AMOUNT)}</span>
                                                        <span>{formatAmount(taxableAmount)}</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 font-bold text-foreground/60">
                                                        <span>{t(CheckoutMessages.TAX_AMOUNT)}</span>
                                                        <span>{formatAmount(itemTax)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        {/* Delivery Tax Line Items */}
                                        {(() => {
                                            const deliveryTaxItems = [];

                                            // Global GST
                                            if ((totals.globalDeliveryGST ?? 0) > 0) {
                                                deliveryTaxItems.push({
                                                    label: t(CheckoutMessages.STANDARD_DELIVERY_GST),
                                                    amount: totals.globalDeliveryGST || 0
                                                });
                                            }

                                            // Product SPECIFIC GST
                                            let productDeliveryGSTTotal = 0;
                                            items.forEach(item => {
                                                if (item.delivery_meta?.source !== 'global') {
                                                    productDeliveryGSTTotal += (item.delivery_gst || 0);
                                                }
                                            });

                                            if (productDeliveryGSTTotal > 0) {
                                                deliveryTaxItems.push({
                                                    label: t(CheckoutMessages.SURCHARGE_GST),
                                                    amount: productDeliveryGSTTotal
                                                });
                                            }

                                            return deliveryTaxItems.map((tax, idx) => (
                                                <div key={`del-tax-${idx}`} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                                                    <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                                                        <span>{tax.label}</span>
                                                        <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">{t("common.tax.gstLabel", { rate: "18%" })}</span>
                                                    </div>
                                                    <div className="flex justify-between pl-1 font-bold text-foreground/60">
                                                        <span>{t(CheckoutMessages.TAX_AMOUNT)}</span>
                                                        <span>{formatAmount(tax.amount || 0)}</span>
                                                    </div>
                                                </div>
                                            ));
                                        })()}
                                    </div>
                                </details>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <Separator className="bg-border/60" />

            <div className="flex justify-between items-baseline pt-1">
                <span className="text-sm font-bold text-foreground/60 lowercase tracking-wide">{t(CheckoutMessages.TOTAL_PAYABLE)}</span>
                <span className="text-2xl font-black text-primary font-playfair leading-none tracking-tight">
                    {formatAmount(totals.finalAmount || 0)}
                </span>
            </div>

            {totalSavings > 0 && (
                <div className="bg-[#F0FDFA] text-[#0D9488] text-[10px] px-2.5 py-2 rounded-lg text-center font-bold border border-[#CCFBF1] shadow-sm animate-in zoom-in-95">
                    {t(CheckoutMessages.SAVINGS_SHORT, { amount: formatAmount(totalSavings) })}
                </div>
            )}

            <div className="bg-amber-100 border border-amber-200 rounded-lg p-2.5 mt-2" style={{ display: 'block', visibility: 'visible' }}>
                <p className="text-amber-900 text-[10px] font-bold flex items-center gap-2 m-0">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t(CheckoutMessages.COD_NOT_SUPPORTED, "Note: Cash on Delivery (COD) is not currently supported.")}
                </p>
            </div>
        </div>
    );
});

PriceBreakdown.displayName = "PriceBreakdown";
