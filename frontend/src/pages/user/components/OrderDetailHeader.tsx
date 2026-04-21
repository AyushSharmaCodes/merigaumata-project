import React from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Truck, FileText, XCircle } from "lucide-react";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { openInvoiceDocument } from "@/lib/invoice-download";

interface OrderDetailHeaderProps {
    order: any;
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
        return order.invoices.find((i: any) => 
            ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type)
        );
    };

    const handleDownloadReceipt = () => {
        const url = order.invoice_url || order.invoices?.find((i: any) => i.type === 'RAZORPAY')?.public_url;
        if (url) void openInvoiceDocument(url).catch(() => {});
    };

    const handleDownloadInvoice = () => {
        const internalInvoice = getInternalInvoice();
        const url = internalInvoice?.public_url;
        if (url) void openInvoiceDocument(url).catch(() => {});
    };

    const hasReceipt = !!(order.invoice_url || order.invoices?.some((i: any) => i.type === 'RAZORPAY'));
    const internalInvoice = getInternalInvoice();

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
