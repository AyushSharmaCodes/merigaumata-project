import React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { orderOrchestrator } from "@/application/order";
import { Button } from "@/shared/components/ui/button";
import { Truck, FileText, XCircle } from "lucide-react";
import { OrderMessages } from "@/shared/constants/messages/OrderMessages";
import type { UserOrderDetailOrder } from "@/domains/order/model/user-order-detail.types";

interface OrderDetailHeaderProps {
    order: UserOrderDetailOrder;
    onCancelOrder: () => void;
    canCancel: boolean;
}

export const OrderDetailHeader: React.FC<OrderDetailHeaderProps> = ({ 
    order, 
    onCancelOrder, 
    canCancel 
}) => {
    const { t } = useTranslation();
    const orderNumber = order.order_number || order.id.substring(0, 8).toUpperCase();

    const getInternalInvoice = () => {
        if (!order.invoices || !order.invoices.length) return null;
        return order.invoices.find((invoice) =>
            ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(invoice.type)
        );
    };

    const getReceiptInvoice = () => {
        if (!order.invoices || !order.invoices.length) return null;
        return order.invoices.find((invoice) => invoice.type === 'RAZORPAY' && invoice.public_url);
    };

    const handleDownloadReceipt = () => {
        const url = order.view_state?.documents?.receipt_url || getReceiptInvoice()?.public_url;
        if (url) void orderOrchestrator.openInvoiceDocument(url).catch(() => {});
    };

    const handleDownloadInvoice = () => {
        const internalInvoice = getInternalInvoice();
        const url = order.view_state?.documents?.invoice_url || internalInvoice?.public_url;
        if (url) void orderOrchestrator.openInvoiceDocument(url).catch(() => {});
    };

    const hasReceipt = order.view_state?.documents?.can_download_receipt ?? !!getReceiptInvoice();
    const internalInvoice = order.view_state?.documents?.can_download_invoice
        ? (getInternalInvoice() || { public_url: order.view_state?.documents?.invoice_url })
        : getInternalInvoice();

    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
                <nav className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400">
                    <Link to="/profile" className="hover:text-slate-600 transition-colors">ACCOUNT</Link>
                    <span>›</span>
                    <Link to="/my-orders" className="hover:text-slate-600 transition-colors">ORDERS</Link>
                    <span>›</span>
                    <span className="text-[#2B8441]">#{orderNumber}</span>
                </nav>
                <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
                    Order #{orderNumber}
                </h1>
                <p className="text-sm text-slate-400 font-medium">
                    Placed on {order.created_at ? format(new Date(order.created_at), "MMMM d, yyyy • hh:mm aa") : t(OrderMessages.NA)}
                </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
                {hasReceipt && (
                    <Button
                        variant="outline"
                        className="rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 px-5 h-11 font-semibold text-sm flex items-center gap-2 shadow-sm"
                        onClick={handleDownloadReceipt}
                    >
                        <FileText className="h-4 w-4" />
                        Receipt
                    </Button>
                )}

                {internalInvoice && (
                    <Button
                        className="rounded-xl bg-[#2B8441] hover:bg-[#236934] text-white px-5 h-11 font-semibold text-sm flex items-center gap-2 shadow-sm"
                        onClick={handleDownloadInvoice}
                    >
                        <FileText className="h-4 w-4" />
                        Download Invoice
                    </Button>
                )}

                {canCancel && (
                    <Button
                        variant="ghost"
                        className="rounded-xl h-11 px-4 font-semibold text-sm text-rose-500 hover:text-rose-600 hover:bg-rose-50"
                        onClick={onCancelOrder}
                    >
                        Cancel Order
                    </Button>
                )}
            </div>
        </div>
    );
};
