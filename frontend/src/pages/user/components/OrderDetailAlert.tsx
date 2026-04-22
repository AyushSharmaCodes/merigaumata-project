import React from "react";
import { useTranslation } from "react-i18next";
import { AlertCircle } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { TranslatedText } from "@/components/ui/TranslatedText";

interface OrderDetailAlertProps {
    status: string;
    statusHistory: any[];
}

export const OrderDetailAlert: React.FC<OrderDetailAlertProps> = ({ status, statusHistory }) => {
    const { t } = useTranslation();

    if (!['cancelled_by_customer', 'delivery_unsuccessful', 'refund_initiated'].includes(status)) {
        return null;
    }

    const isCancelled = status.includes('cancelled');
    const adminReasonEntry = statusHistory?.find(h => h.status === 'cancelled_by_admin');
    const adminReason = adminReasonEntry?.notes;

    const renderReason = (reason: string) => {
        if (!reason) return null;
        if (reason.startsWith("Order cancelled by administrator: ")) {
            const dynamicReason = reason.replace("Order cancelled by administrator: ", "");
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {t("historyNotes.cancelledByAdmin", "Order cancelled by administrator")}: <TranslatedText text={dynamicReason} />
                </span>
            );
        }
        return <TranslatedText text={reason} />;
    };

    return (
        <Alert className={`rounded-2xl border-none shadow-xl flex items-start gap-4 p-6 relative overflow-hidden
            ${isCancelled ? 'bg-rose-50' : 'bg-amber-50'}
        `}>
            <div className={`absolute top-0 left-0 w-1.5 h-full ${isCancelled ? 'bg-rose-500' : 'bg-amber-500'}`} />
            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 shadow-inner
                ${isCancelled ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}
            `}>
                <AlertCircle className="h-6 w-6" />
            </div>
            <div className="space-y-1">
                <AlertTitle className="text-base font-black text-slate-900 tracking-tight">
                    {status === 'cancelled_by_admin' ? t("orderStatus.cancelled_by_admin_title", "Admin Cancellation Reason") : 
                     status === 'refund_initiated' ? t("orderStatus.refund_initiated_title", "Refund Processed") : 
                     t(`orderStatus.${status}`)}
                </AlertTitle>
                <AlertDescription className="text-sm font-medium text-slate-600 max-w-2xl leading-relaxed">
                    {status === 'cancelled_by_admin' 
                        ? (adminReason ? renderReason(adminReason) : t("orderStatus.cancelled_by_admin_desc")) 
                        : status === 'refund_initiated'
                        ? t("orderStatus.refund_initiated_desc", "Your refund has been initiated and will reflect in your account soon.")
                        : t(`orderStatus.${status}_desc`)}
                </AlertDescription>
            </div>
        </Alert>
    );
};
