import React, { useState } from "react";
import { Button } from "@/shared/components/ui/button";
import { FileText, Loader2, RotateCcw } from "lucide-react";
import { apiClient } from "@/core/api/api-client";
import { useToast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useTranslation } from "react-i18next";

interface RegenerateInvoiceButtonProps {
    orderId: string;
    onSuccess?: () => void;
    className?: string;
    variant?: "outline" | "default" | "secondary" | "ghost" | "link" | "destructive";
    size?: "default" | "sm" | "lg" | "icon";
    showIconOnly?: boolean;
}

export const RegenerateInvoiceButton: React.FC<RegenerateInvoiceButtonProps> = ({
    orderId,
    onSuccess,
    className,
    variant = "outline",
    size = "sm",
    showIconOnly = false
}) => {
    const { t } = useTranslation();
    const { toast } = useToast();
    const [isGenerating, setIsGenerating] = useState(false);


    const handleRegenerate = async () => {
        try {
            setIsGenerating(true);
            toast({
                title: t("common.info"),
                description: t("admin.orders.regenerating"),
            });

            const response = await apiClient.post(`/invoices/orders/${orderId}/retry`, {});

            if (response.data.success) {
                toast({
                    title: t("common.success"),
                    description: t("admin.orders.invoiceRegenerated"),
                });
                if (onSuccess) onSuccess();
            } else {
                toast({
                    title: t("common.error"),
                    description: response.data.error || t("admin.orders.regenerateError"),
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.orders.regenerateError"),
                variant: "destructive",
            });
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <Button
            variant={variant}
            size={size}
            className={className}
            onClick={handleRegenerate}
            disabled={isGenerating}
        >
            {isGenerating ? (
                <Loader2 className={`${showIconOnly ? "" : "mr-2"} h-4 w-4 animate-spin`} />
            ) : (
                <RotateCcw className={`${showIconOnly ? "" : "mr-2"} h-4 w-4`} />
            )}
            {!showIconOnly && t("admin.orders.regenerateInvoice")}
        </Button>
    );
};
