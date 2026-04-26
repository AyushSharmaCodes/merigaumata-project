import React from "react";
import { useTranslation } from "react-i18next";
import { CreditCard, Wallet, Landmark, QrCode } from "lucide-react";
import { Card, CardContent } from "@/shared/components/ui/card";
import { OrderMessages } from "@/shared/constants/messages/OrderMessages";
import type { UserOrderDetailOrder } from "@/domains/order/model/user-order-detail.types";

interface OrderDetailPaymentProps {
    order: UserOrderDetailOrder;
}

export const OrderDetailPayment: React.FC<OrderDetailPaymentProps> = ({ order }) => {
    const { t } = useTranslation();

    const isPaid = order.payment_status === 'paid' || order.payment_status === 'captured';
    const method = order.payment_method?.toLowerCase() || 'netbanking';
    const paymentId = order.payment_id || '';

    // Dynamic payment method display logic
    const getPaymentMethodDisplay = () => {
        switch (method) {
            case 'upi':
                return {
                    label: 'UPI',
                    icon: <QrCode className="h-4 w-4 text-emerald-600" />,
                    bg: 'bg-emerald-50',
                    border: 'border-emerald-100',
                    text: 'Unified Payments Interface'
                };
            case 'wallet':
                return {
                    label: 'Wallet',
                    icon: <Wallet className="h-4 w-4 text-blue-600" />,
                    bg: 'bg-blue-50',
                    border: 'border-blue-100',
                    text: 'Digital Wallet'
                };
            case 'netbanking':
                return {
                    label: 'Net Banking',
                    icon: <Landmark className="h-4 w-4 text-amber-600" />,
                    bg: 'bg-amber-50',
                    border: 'border-amber-100',
                    text: 'Direct Bank Transfer'
                };
            case 'card':
                // Check if we have actual card details in the order (some backends provide this)
                // For now, if it's 'card', we use CreditCard icon
                return {
                    label: 'Credit/Debit Card',
                    icon: <CreditCard className="h-4 w-4 text-purple-600" />,
                    bg: 'bg-purple-50',
                    border: 'border-purple-100',
                    text: 'Secured Card Payment'
                };
            default:
                return {
                    label: (method || 'online_payment').replace(/_/g, ' ').toUpperCase(),
                    icon: <CreditCard className="h-4 w-4 text-slate-600" />,
                    bg: 'bg-slate-50',
                    border: 'border-slate-100',
                    text: 'Online Payment'
                };
        }
    };

    const display = getPaymentMethodDisplay();

    // Friendly status labels
    const getStatusDisplay = () => {
        if (isPaid) return { label: 'Captured & Verified', color: 'text-[#2B8441]' };
        if (order.payment_status === 'failed') return { label: 'Payment Failed', color: 'text-rose-600' };
        if (order.payment_status === 'refunded') return { label: 'Refunded', color: 'text-blue-600' };
        return { label: 'Pending Verification', color: 'text-amber-500' };
    };

    const statusDisplay = getStatusDisplay();

    return (
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-5">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#2B8441] flex items-center justify-center">
                        <CreditCard className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </div>
                    {t(OrderMessages.PAYMENT_INFO, "Payment Details")}
                </h4>

                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl ${display.bg} ${display.border} border flex items-center justify-center shrink-0 shadow-sm`}>
                        {display.icon}
                    </div>
                    <div className="space-y-0.5">
                        <p className="text-sm font-bold text-slate-900">
                            {display.label}
                        </p>
                        <p className="text-[11px] font-medium text-slate-500">
                            {display.text}
                        </p>
                    </div>
                </div>

                <div className="pt-4 border-t border-slate-50 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Transaction ID:</span>
                        <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tight bg-slate-50 px-2 py-1 rounded-md border border-slate-100">
                            {paymentId || '—'}
                        </span>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Status:</span>
                        <span className={`text-[11px] font-black uppercase tracking-wide ${statusDisplay.color}`}>
                            {statusDisplay.label}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
