import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { FileText, Info } from "lucide-react";
import { useTranslation } from "react-i18next";
import { orderOrchestrator } from "@/application/order";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/shared/components/ui/tooltip";
import { useCurrency } from "@/app/providers/currency-provider";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useTaxBreakdown } from "../hooks/useTaxBreakdown";

// Sub-components
import { TaxSummarySection } from "./tax/TaxSummarySection";
import { TaxItemizedList } from "./tax/TaxItemizedList";
import { TaxTotalSection } from "./tax/TaxTotalSection";

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
    const { toast } = useToast();
    const { formatAmount: formatCurrencyAmount } = useCurrency();

    const {
        productTaxableFromItems,
        isInterState,
        effectiveTaxable,
        displayCgst,
        displaySgst,
        displayIgst,
        displayTotalTax,
    } = useTaxBreakdown({
        totalTaxableAmount,
        totalCgst,
        totalSgst,
        totalIgst,
        totalAmount,
        items,
        deliveryCharge,
        deliveryGST,
    });

    const formatAmount = (amount: number | undefined) => {
        const normalizedAmount = Math.max(0, amount || 0);

        if (role === 'admin') {
            return new Intl.NumberFormat(undefined, {
                style: "currency",
                currency: "INR",
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
            }).format(normalizedAmount);
        }

        return formatCurrencyAmount(normalizedAmount);
    };

    const handleDownloadInvoice = async () => {
        if (!invoiceUrl) return;
        try {
            await orderOrchestrator.openInvoiceDocument(invoiceUrl);
        } catch (error) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "tax.downloadInvoice"),
                variant: "destructive",
            });
        }
    };

    if (compact) {
        return (
            <div className="text-sm text-muted-foreground">
                <TooltipProvider>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <div className="flex items-center gap-1 cursor-help">
                                <Info size={14} />
                                <span>{t("tax.gst")}: {formatAmount(displayTotalTax)}</span>
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
                <TaxSummarySection
                    role={role}
                    effectiveTaxable={effectiveTaxable}
                    displayTotalTax={displayTotalTax}
                    productTaxableFromItems={productTaxableFromItems}
                    deliveryCharge={deliveryCharge}
                    isInterState={isInterState}
                    displayIgst={displayIgst}
                    displayCgst={displayCgst}
                    displaySgst={displaySgst}
                    formatAmount={formatAmount}
                />

                <TaxItemizedList
                    role={role}
                    items={items}
                    deliveryCharge={deliveryCharge}
                    deliveryGST={deliveryGST}
                    formatAmount={formatAmount}
                />

                <TaxTotalSection
                    role={role}
                    totalAmount={totalAmount}
                    showInvoiceLink={showInvoiceLink}
                    invoiceUrl={invoiceUrl}
                    onDownloadInvoice={handleDownloadInvoice}
                />
            </CardContent>
        </Card>
    );
}

export default TaxBreakdown;
