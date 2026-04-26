import React, { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FileText, Loader2 } from "lucide-react";
import { apiClient } from "@/core/api/api-client";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useTranslation } from "react-i18next";

interface InvoiceActionsProps {
    order: any; // Using any to support both Order and OrderResponse from different pages
    onSuccess?: () => void;
    className?: string;
}

export const InvoiceActions: React.FC<InvoiceActionsProps> = ({ order, onSuccess, className }) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [generating, setGenerating] = useState<string | null>(null);


    // Determine if GST is applicable (any GST amount > 0 or any GST item)
    // We check total tax fields which are common on the order object
    const isGstApplicable = (
        (order as any).total_igst > 0 ||
        (order as any).total_cgst > 0 ||
        (order as any).total_sgst > 0 ||
        (order as any).delivery_gst > 0 ||
        order.items?.some((item: any) => (item.gst_rate > 0 || item.variant?.gst_rate > 0 || item.product?.gstRate > 0))
    );

    const invoiceType = isGstApplicable ? 'TAX_INVOICE' : 'BILL_OF_SUPPLY';
    const buttonLabel = isGstApplicable ? 'GST Bill' : 'Non-GST Bill';

    const handleGenerate = async () => {
        try {
            setGenerating(invoiceType);
            const response = await apiClient.post(`/custom-invoices/${order.id}/generate`, { type: invoiceType });

            if (response.data.success) {
                toast({
                    title: t("common.success"),
                    description: t("orders.invoice.generatedSuccess", {
                        defaultValue: "{{invoiceType}} generated successfully!",
                        invoiceType: isGstApplicable ? t("orders.invoice.gstInvoice", { defaultValue: "GST invoice" }) : t("orders.invoice.billOfSupply", { defaultValue: "Bill of supply" })
                    }),
                });
                if (onSuccess) onSuccess();
            } else {
                toast({
                    title: t("common.error"),
                    description: response.data.error || t("orders.invoice.generateError", { defaultValue: "Failed to generate invoice" }),
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "orders.invoice.generateError"),
                variant: "destructive",
            });
        } finally {
            setGenerating(null);
        }
    };

    return (
        <div className={`flex flex-wrap gap-2 ${className}`}>
            <Button
                variant="outline"
                size="sm"
                className="h-9 text-xs border-orange-200 hover:border-orange-300 hover:bg-orange-50 text-orange-700"
                onClick={handleGenerate}
                disabled={!!generating}
            >
                {generating ? (
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                ) : (
                    <FileText className="mr-2 h-4 w-4" />
                )}
                {buttonLabel}
            </Button>
        </div>
    );
};
