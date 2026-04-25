import { memo } from "react";
import { useTranslation } from "react-i18next";
import { FileSearch, Truck, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TranslatedText } from "@/components/ui/TranslatedText";
import type { OrderItem } from "@/types";

interface TaxAuditSectionProps {
    items: OrderItem[];
    subtotal: number;
    coupon_discount: number;
    delivery_charge: number;
    delivery_gst?: number;
    total_amount: number;
    isInterState?: boolean;
}

export const TaxAuditSection = memo(({
    items,
    subtotal,
    coupon_discount,
    delivery_charge,
    delivery_gst = 0,
    total_amount,
    isInterState = false
}: TaxAuditSectionProps) => {
    const { t } = useTranslation();

    // Calculations similar to TaxBreakdown.tsx
    // Robust Taxable Baseline Calculation
    const productTaxable = items.reduce((sum, item) => {
        const qty = item.quantity || 1;
        const taxRate = item.gst_rate ?? 0;
        // Use backend provided taxable_amount if available, else derive from inclusive price
        const itemTaxable = item.taxable_amount ?? ((item.price_per_unit * qty) / (1 + (taxRate / 100)));
        return sum + itemTaxable;
    }, 0);

    // Determine if delivery is inclusive or exclusive based on total amount
    const productTotalInclusive = items.reduce((sum, item) => sum + (item.price_per_unit * (item.quantity || 1)), 0);
    // If product total + delivery charge + delivery gst equals total_amount, then delivery was exclusive
    const isCalculatedExclusive = Math.abs((productTotalInclusive - coupon_discount + delivery_charge + delivery_gst) - total_amount) < 0.1;
    const deliveryIsInclusive = !isCalculatedExclusive; // If not exclusive, assume inclusive
    
    // If inclusive, delivery_charge is the final amount including tax. If exclusive, delivery_charge is the base amount without tax.
    const deliveryTaxable = deliveryIsInclusive ? (delivery_charge - delivery_gst) : delivery_charge;
    const globalTaxableValue = productTaxable + deliveryTaxable;

    const totalCgst = items.reduce((sum, item) => sum + (item.cgst || 0), 0);
    const totalSgst = items.reduce((sum, item) => sum + (item.sgst || 0), 0);
    const totalIgst = items.reduce((sum, item) => sum + (item.igst || 0), 0);
    
    // Determine if we should show IGST based on whether it exists in any item
    const hasIgst = totalIgst > 0 || (items.length > 0 && items.some(i => (i.igst || 0) > 0));
    const totalGst = (totalCgst + totalSgst + totalIgst) + delivery_gst;

    // Split Calculations for Summary Cards
    const refundableTaxableValue = items.reduce((sum, item) => {
        // Products are generally refundable unless explicitly marked as non-returnable
        // Logistics refund policy should NOT affect item base price refundability
        const isReturnable = (item as any).is_returnable !== false;
        if (!isReturnable) return sum;
        
        const qty = item.quantity || 1;
        const taxRate = item.gst_rate ?? 0;
        return sum + (item.taxable_amount ?? ((item.price_per_unit * qty) / (1 + (taxRate / 100))));
    }, 0);

    const nonRefundableTaxableValue = globalTaxableValue - refundableTaxableValue;

    const refundableGstValue = items.reduce((sum, item) => {
        const isReturnable = (item as any).is_returnable !== false;
        if (!isReturnable) return sum;
        return sum + (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
    }, 0);

    const nonRefundableGstValue = totalGst - refundableGstValue;

    // Aggregate Refundability Totals
    const refundableAmount = (refundableTaxableValue ?? 0) + (refundableGstValue ?? 0);
    const nonRefundableAmount = total_amount - refundableAmount;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    return (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-4">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
                        <FileSearch className="h-4 w-4 text-primary" />
                        {t("admin.orders.detail.taxAudit.title", "Detailed Tax Summary & Audit")}
                    </CardTitle>
                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] font-bold tracking-wider uppercase">
                        {t("admin.orders.detail.taxAudit.active", "Audit Active")}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                {/* Summary Box Highlights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Card 1: Total Taxable */}
                    <div className="bg-amber-50/40 border border-amber-100 rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden group">
                        <div className="absolute right-[-10px] top-[-10px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <ShieldCheck size={80} />
                        </div>
                        <div className="flex items-center justify-between">
                             <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700/70">
                                {t("tax.totalTaxable", "Total Taxable Value")}
                             </span>
                             <div className="flex items-center gap-1.5 translate-y-[-1px]">
                                {refundableTaxableValue > 0 && (
                                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1 rounded uppercase tracking-tighter">{t("admin.orders.detail.tax.refundable")}</span>
                                )}
                                {nonRefundableTaxableValue > 0 && (
                                    <span className="text-[8px] font-black bg-amber-200/50 text-amber-800 px-1 rounded uppercase tracking-tighter">{t("admin.orders.detail.taxAudit.nonRefundable", "Non-Refundable")}</span>
                                )}
                             </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-slate-800">
                                {formatCurrency(globalTaxableValue)}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                {refundableTaxableValue > 0 && (
                                    <span className="text-[9px] font-bold text-emerald-600/70">{formatCurrency(refundableTaxableValue)}</span>
                                )}
                                {refundableTaxableValue > 0 && nonRefundableTaxableValue > 0 && (
                                    <span className="text-[9px] text-slate-300">•</span>
                                )}
                                {nonRefundableTaxableValue > 0 && (
                                    <span className="text-[9px] font-bold text-amber-700/60">{formatCurrency(nonRefundableTaxableValue)}</span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Card 2: Total GST */}
                    <div className="bg-emerald-50/40 border border-emerald-100 rounded-xl p-4 flex flex-col gap-1 relative overflow-hidden group">
                        <div className="absolute right-[-10px] top-[-10px] opacity-[0.03] group-hover:opacity-[0.07] transition-opacity">
                            <ShieldCheck size={80} />
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-700/70">
                                {t("tax.totalGST", "Total GST Cost")}
                            </span>
                             <div className="flex items-center gap-1.5 translate-y-[-1px]">
                                {refundableGstValue > 0 && (
                                    <span className="text-[8px] font-black bg-emerald-100 text-emerald-700 px-1 rounded uppercase tracking-tighter">{t("admin.orders.detail.tax.refundable")}</span>
                                )}
                                {nonRefundableGstValue > 0 && (
                                    <span className="text-[8px] font-black bg-slate-200 text-slate-600 px-1 rounded uppercase tracking-tighter">{t("admin.orders.detail.taxAudit.nonRefundable", "Non-Refundable")}</span>
                                )}
                             </div>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-2xl font-black text-slate-800">
                                {formatCurrency(totalGst)}
                            </span>
                            <div className="flex items-center gap-2 mt-0.5">
                                {refundableGstValue > 0 && (
                                    <span className="text-[9px] font-bold text-emerald-600/70">{formatCurrency(refundableGstValue)}</span>
                                )}
                                {refundableGstValue > 0 && nonRefundableGstValue > 0 && (
                                    <span className="text-[9px] text-slate-300">•</span>
                                )}
                                {nonRefundableGstValue > 0 && (
                                    <span className="text-[9px] font-bold text-slate-500/60">{formatCurrency(nonRefundableGstValue)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Refundability Audit Summary */}
                <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-xl">
                    <div className="absolute right-[-20px] bottom-[-20px] opacity-10 rotate-12">
                        <ShieldCheck size={160} />
                    </div>
                    <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-2">
                             <div className="h-1 w-8 bg-emerald-500 rounded-full" />
                             <h3 className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
                                {t("tax.refundabilityAudit", "Refundability Audit")}
                             </h3>
                        </div>
                        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("tax.refundableValue", "Potential Refundable Total")}</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-emerald-400">{formatCurrency(refundableAmount)}</span>
                                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[9px] h-4">
                                        {total_amount > 0 ? Math.round((refundableAmount / total_amount) * 100) : 0}%
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
                                    {t("tax.refundableDesc", "Includes base price and GST for returnable items.")}
                                </p>
                            </div>

                            <div className="space-y-1">
                                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t("tax.nonRefundableValue", "Non-Refundable Baseline")}</span>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-black text-slate-300">{formatCurrency(nonRefundableAmount)}</span>
                                    <Badge className="bg-slate-700 text-slate-400 border-slate-600 text-[9px] h-4">
                                        {total_amount > 0 ? Math.round((nonRefundableAmount / total_amount) * 100) : 0}%
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-slate-500 leading-relaxed max-w-[200px]">
                                    {t("tax.nonRefundableDesc", "Includes delivery charges and non-returnable items.")}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Itemized Audit List */}
                <div className="space-y-4">
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                        {t("tax.financialComposition", "Financial Composition & Itemized Audit")}
                    </h3>

                    <div className="space-y-3">
                        {items.map((item, idx) => {
                            const qty = item.quantity || 1;
                            const taxRate = item.gst_rate ?? 0;
                            const itemTaxable = item.taxable_amount ?? ((item.price_per_unit * qty) / (1 + (taxRate / 100)));
                            const itemGst = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
                            
                            // Check item-level returnability
                            const isReturnable = (item as any).is_returnable !== false;

                            return (
                                <div key={idx} className="bg-slate-50/30 border border-slate-100/80 rounded-xl p-4 space-y-3">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-slate-400">0{idx + 1}.</span>
                                            <h4 className="text-sm font-bold text-slate-700 capitalize">
                                                <TranslatedText text={item.title || "Product"} />
                                            </h4>
                                        </div>
                                        <Badge variant="outline" className={`${isReturnable ? "bg-blue-50 text-blue-600 border-blue-100" : "bg-orange-50 text-orange-600 border-orange-100"} text-[9px] px-1.5 py-0 font-bold uppercase`}>
                                            {isReturnable ? t("admin.orders.detail.tax.refundable") : t("admin.orders.detail.taxAudit.nonRefundable", "Non-Refundable")}
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex justify-between items-center group hover:border-amber-200 transition-colors">
                                            <span className="text-[10px] text-slate-400 font-medium">{t("tax.basePrice", "Base Price")} <span className="text-[9px] opacity-60">({t("tax.taxable", "Taxable")})</span></span>
                                            <span className="text-xs font-bold text-slate-700">{formatCurrency(itemTaxable)}</span>
                                        </div>
                                        <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex flex-col gap-1 group hover:border-emerald-200 transition-colors">
                                            <div className="flex justify-between items-center w-full">
                                                <span className="text-[10px] text-slate-400 font-medium">GST <span className="text-[9px] opacity-60">({taxRate}% Incl.)</span></span>
                                                <span className="text-xs font-bold text-slate-700">{formatCurrency(itemGst)}</span>
                                            </div>
                                            {(item.igst ?? 0) > 0 ? (
                                                <div className="flex justify-between items-center w-full border-t border-slate-50 pt-1 mt-0.5">
                                                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{t("admin.orders.detail.tax.igst")}</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{formatCurrency(item.igst || 0)}</span>
                                                </div>
                                            ) : (
                                                <div className="flex flex-col gap-0.5 border-t border-slate-50 pt-1 mt-0.5">
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{t("admin.orders.detail.tax.cgst")}</span>
                                                        <span className="text-[10px] font-bold text-slate-500">{formatCurrency(item.cgst || 0)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center w-full">
                                                        <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">{t("admin.orders.detail.tax.sgst")}</span>
                                                        <span className="text-[10px] font-bold text-slate-500">{formatCurrency(item.sgst || 0)}</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}

                        {/* Delivery Charges Row */}
                        <div className="bg-slate-50/30 border border-slate-100/80 rounded-xl p-4 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Truck size={14} className="text-slate-400" />
                                    <h4 className="text-sm font-bold text-slate-700">{t("tax.deliveryCharges", "Delivery Charges")}</h4>
                                </div>
                                <Badge variant="outline" className="bg-orange-50 text-orange-600 border-orange-100 text-[9px] px-1.5 py-0 font-bold uppercase">
                                    {t("products.nonRef", "Non-Refundable")}
                                </Badge>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex justify-between items-center group">
                                    <span className="text-[10px] text-slate-400 font-medium">{t("tax.baseLogistics", "Base Logistics Fee")}</span>
                                    <span className="text-xs font-bold text-slate-700">{formatCurrency(deliveryTaxable)}</span>
                                </div>
                                <div className="bg-white border border-slate-200/60 rounded-lg p-2.5 flex flex-col gap-1 group">
                                    <div className="flex justify-between items-center w-full">
                                        <span className="text-[10px] text-slate-400 font-medium">GST <span className="text-[9px] opacity-60">(18% {deliveryIsInclusive ? 'Incl.' : 'Excl.'})</span></span>
                                        <span className="text-xs font-bold text-slate-700">{formatCurrency(delivery_gst)}</span>
                                    </div>
                                    {delivery_gst > 0 && (
                                        hasIgst ? (
                                            <div className="flex justify-between items-center w-full border-t border-slate-50 pt-1 mt-0.5">
                                                <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">IGST</span>
                                                <span className="text-[10px] font-bold text-slate-500">{formatCurrency(delivery_gst)}</span>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col gap-0.5 border-t border-slate-50 pt-1 mt-0.5">
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">CGST</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{formatCurrency(delivery_gst / 2)}</span>
                                                </div>
                                                <div className="flex justify-between items-center w-full">
                                                    <span className="text-[9px] text-slate-400 font-medium uppercase tracking-tighter">SGST</span>
                                                    <span className="text-[10px] font-bold text-slate-500">{formatCurrency(delivery_gst / 2)}</span>
                                                </div>
                                            </div>
                                        )
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Final Total Bottom Bar */}
                <div className="pt-4 border-t border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-base font-bold text-emerald-600">
                            {t("tax.totalAmountPayable", "Total Amount Payable")}
                        </span>
                        <div className="flex items-center gap-2">
                           <div className="h-1 w-1 rounded-full bg-slate-300" />
                           <p className="text-[9px] text-slate-400 font-medium leading-none">
                                {t("tax.calculationCompliance", "Show calculations ensure compliant with GST Rule 2017. Detailed breaking for HSN-SAC provided on invoice below.")}
                           </p>
                        </div>
                    </div>
                    <div className="text-2xl font-black text-slate-800 tracking-tight">
                        {formatCurrency(total_amount)}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

TaxAuditSection.displayName = "TaxAuditSection";
