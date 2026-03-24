/**
 * Tax Breakdown Component
 * Displays GST tax details in orders with detailed item-wise and delivery breakdowns.
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IndianRupee, FileText, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCurrency } from "@/contexts/CurrencyContext";

interface TaxBreakdownProps {
    totalTaxableAmount?: number;
    totalCgst?: number;
    totalSgst?: number;
    totalIgst?: number;
    totalAmount: number;
    compact?: boolean;
    showInvoiceLink?: boolean;
    invoiceUrl?: string;
    role?: 'admin' | 'customer';
    items?: any[];
    deliveryCharge?: number;
    deliveryGST?: number;
}

export function TaxBreakdown({
    totalTaxableAmount = 0,
    totalCgst = 0,
    totalSgst = 0,
    totalIgst = 0,
    totalAmount,
    compact = false,
    showInvoiceLink = false,
    invoiceUrl,
    items = [],
    deliveryCharge = 0,
    deliveryGST = 0,
    role = 'customer'
}: TaxBreakdownProps) {
    const { t } = useTranslation();
    const { formatAmount: formatCurrencyAmount } = useCurrency();
    // 1. Calculate Product-only tax from items
    const productTaxableFromItems = items.reduce((sum, item) => {
        const qty = item.quantity || 1;
        const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
        const itemTaxable = item.taxable_amount ?? ((item.total_amount || ((item.price_per_unit || item.product?.price || 0) * qty)) / (1 + (taxRate / 100)));
        return sum + itemTaxable;
    }, 0);

    const productTaxFromItems = items.reduce((sum, item) => {
        const qty = item.quantity || 1;
        const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
        const itemTaxable = item.taxable_amount ?? ((item.total_amount || ((item.price_per_unit || item.product?.price || 0) * qty)) / (1 + (taxRate / 100)));
        const totalItemTaxSnapshot = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
        const itemTax = totalItemTaxSnapshot > 0 ? totalItemTaxSnapshot : ((item.total_amount || (item.price_per_unit * qty)) - itemTaxable);
        return sum + Math.max(0, itemTax);
    }, 0);

    // 2. Identification Logic
    const isInterState = (totalIgst || 0) > 0;

    // Reconciliation logic: ensure summary components sum up correctly
    const derivedTotalTaxable = productTaxableFromItems + deliveryCharge;

    // Use derived values if passed-in ones are zero or significantly mismatched
    const effectiveTaxable = totalTaxableAmount > 0 ? totalTaxableAmount : derivedTotalTaxable;

    // Fix Double Counting: 
    // If totalCgst/Igst already include delivery (which they often do in new orders), 
    // we don't add deliveryGST again.
    // Check if totalTax + TotalTaxable matches TotalAmount
    const rawTotalTax = (totalCgst || 0) + (totalSgst || 0) + (totalIgst || 0);
    const taxMismatched = Math.abs(totalAmount - (effectiveTaxable + rawTotalTax)) > 1.0;

    // If mismatched, it means the passed-in buckets don't include delivery GST. 
    // In that case, we add it explicitly.
    const effectiveDeliveryGstInBuckets = taxMismatched ? deliveryGST : 0;

    const displayCgst = isInterState ? 0 : (totalCgst + (effectiveDeliveryGstInBuckets / 2));
    const displaySgst = isInterState ? 0 : (totalSgst + (effectiveDeliveryGstInBuckets / 2));
    const displayIgst = isInterState ? (totalIgst + effectiveDeliveryGstInBuckets) : 0;

    const displayTotalTax = isInterState ? displayIgst : (displayCgst + displaySgst);

    const formatAmount = (amount: number | undefined) => formatCurrencyAmount(Math.max(0, amount || 0));

    if (compact) {
        return (
            <div className="text-sm text-muted-foreground">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                                <Info size={14} />
                                <span>GST: {formatAmount(displayTotalTax)}</span>
                            </div>
                        </TooltipTrigger>
                        <TooltipContent>
                            <div className="text-xs space-y-1">
                                <p>{t("tax.totalTaxable")}: {formatAmount(effectiveTaxable)}</p>
                                {isInterState ? (
                                    <p>IGST: {formatAmount(displayIgst)}</p>
                                ) : (
                                    <>
                                        <p>CGST: {formatAmount(displayCgst)}</p>
                                        <p>SGST: {formatAmount(displaySgst)}</p>
                                    </>
                                )}
                            </div>
                        </TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            </div>
        );
    }

    return (
        <Card className={role === 'admin' ? "border-primary/20 shadow-md ring-1 ring-primary/10" : ""}>
            <CardHeader className="pb-3 bg-muted/20">
                <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                        <FileText size={18} className={role === 'admin' ? "text-primary" : ""} />
                        <span>{role === 'admin' ? t("tax.summary") : t("tax.priceBreakdown")}</span>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4 text-xs md:text-sm">
                <div className="space-y-4">
                    {/* Primary Taxable & Tax Split */}
                    <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border border-muted">
                        <div className="space-y-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">{role === 'admin' ? t("tax.totalTaxable") : t("tax.subtotalBeforeTax")}</span>
                            <span className="text-sm font-semibold">{formatAmount(effectiveTaxable)}</span>
                        </div>
                        <div className="space-y-1 text-right">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">{role === 'admin' ? t("tax.totalGST") : t("tax.taxesGST")}</span>
                            <span className="text-sm font-semibold text-primary">{formatAmount(displayTotalTax)}</span>
                        </div>
                    </div>

                    {/* Detailed Breakdown */}
                    <div className="space-y-2 px-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{role === 'admin' ? t("tax.netTaxable") : t("tax.itemsTotal")}</span>
                            <span>{formatAmount(productTaxableFromItems)}</span>
                        </div>
                        {deliveryCharge > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-muted-foreground italic">{role === 'admin' ? t("tax.shippingCharges") : t("orderDetail.delivery")}</span>
                                <span>{formatAmount(deliveryCharge)}</span>
                            </div>
                        )}
                        <div className="h-[1px] bg-muted my-1" />

                        {isInterState ? (
                            <div className="flex justify-between text-sm font-medium">
                                <span className="text-muted-foreground">{role === 'admin' ? t("tax.igstLabel") : t("tax.igstLabelShort")}</span>
                                <span className="text-primary">{formatAmount(displayIgst)}</span>
                            </div>
                        ) : (
                            <>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{role === 'admin' ? t("tax.cgstLabel") : t("tax.cgstLabelShort")}</span>
                                    <span>{formatAmount(displayCgst)}</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted-foreground">{role === 'admin' ? t("tax.sgstLabel") : t("tax.sgstLabelShort")}</span>
                                    <span>{formatAmount(displaySgst)}</span>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Product-wise Accordion */}
                    {items && items.length > 0 && (
                        <div className="border rounded-md overflow-hidden text-xs shadow-sm">
                            <div className="bg-muted/50 px-3 py-2 font-medium flex justify-between items-center border-b">
                                <span>{role === 'admin' ? t("tax.itemizedBreakdown") : t("tax.productDetails")}</span>
                                {role === 'admin' && <span className="text-[9px] text-muted-foreground uppercase bg-white px-1 rounded border">{t("tax.auditLog")}</span>}
                            </div>
                            <div className="divide-y max-h-[250px] overflow-y-auto bg-white">
                                {items.map((item, idx) => {
                                    const qty = item.quantity || 1;
                                    const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
                                    const hsn = item.variant?.hsn_code ?? item.variant_snapshot?.hsn_code ?? item.product?.hsn_code ?? item.hsn_code ?? 'N/A';

                                    const itemTaxable = item.taxable_amount ?? ((item.total_amount || ((item.price_per_unit || item.product?.price || 0) * qty)) / (1 + (taxRate / 100)));
                                    const totalItemTaxSnapshot = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
                                    const itemTax = totalItemTaxSnapshot > 0 ? totalItemTaxSnapshot : ((item.total_amount || (item.price_per_unit * qty)) - itemTaxable);

                                    return (
                                        <div key={idx} className="px-3 py-2.5 hover:bg-muted/5 transition-colors">
                                            <div className="flex justify-between items-start mb-1">
                                                <div className="space-y-0.5">
                                                    <div className="font-medium truncate max-w-[200px]" title={item.title || item.product?.title}>{item.title || item.product?.title || t("products.defaultTitle") || 'Product'}</div>
                                                    <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                                                        <span>HSN: {hsn}</span>
                                                        <span>•</span>
                                                        <span>{t("products.qty") || "Qty"}: {qty}</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-semibold text-primary">{taxRate}% GST</div>
                                                    <div className="text-[9px] text-muted-foreground">{formatAmount(itemTax)} {t("tax.taxesGST").split(' ')[0]}</div>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center text-[10px] bg-muted/20 px-2 py-1 rounded mt-1">
                                                <span className="text-muted-foreground">{t("tax.netValue")}</span>
                                                <span className="font-mono">{formatAmount(itemTaxable)}</span>
                                            </div>
                                        </div>
                                    );
                                })}

                                {((deliveryCharge ?? 0) > 0 || (deliveryGST ?? 0) > 0) && (
                                    <div className="px-3 py-2.5 bg-amber-50/30 border-t border-dashed transition-all">
                                        <div className="flex justify-between items-start mb-1">
                                            <div className="space-y-0.5">
                                                <div className="font-medium text-amber-900">{t("tax.shippingCharges")}</div>
                                                <div className="text-[9px] text-amber-700 font-mono">HSN: 996812</div>
                                            </div>
                                            <div className="text-right">
                                                <div className="font-semibold text-amber-600">18% GST</div>
                                                <div className="text-[9px] text-amber-700">{formatAmount(deliveryGST)} {t("tax.taxesGST").split(' ')[0]}</div>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-[10px] bg-white/50 px-2 py-1 rounded mt-1 border border-amber-200">
                                            <span className="text-muted-foreground">{t("tax.taxableValue")}</span>
                                            <span className="font-mono">{formatAmount(deliveryCharge)}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="border-t-2 border-primary/20 pt-4 mt-2">
                    <div className="flex justify-between items-end">
                        <div className="space-y-0.5">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground block">{role === 'admin' ? t("tax.finalAmount") : t("tax.grandTotal")}</span>
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                <Info size={10} />
                                {role === 'admin' ? t("tax.taxableValueGST") : t("tax.includesTaxes")}
                            </span>
                        </div>
                        <div className="text-right">
                            <div className="text-2xl font-black text-primary flex items-center justify-end leading-none">
                                <IndianRupee size={22} className="mr-0.5" />
                                {totalAmount.toFixed(2)}
                            </div>
                        </div>
                    </div>
                </div>

                {showInvoiceLink && invoiceUrl && (
                    <div className="pt-2">
                        <a
                            href={invoiceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all flex items-center gap-2 justify-center w-full py-3 rounded-lg shadow-sm"
                        >
                            <FileText size={16} />
                            {t("tax.downloadInvoice")}
                        </a>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

export default TaxBreakdown;
