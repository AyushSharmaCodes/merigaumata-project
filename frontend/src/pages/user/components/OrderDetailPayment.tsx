import React from "react";
import { useTranslation } from "react-i18next";
import { CreditCard } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OrderMessages } from "@/constants/messages/OrderMessages";

interface OrderDetailPaymentProps {
    order: any;
}

export const OrderDetailPayment: React.FC<OrderDetailPaymentProps> = ({ order }) => {
    const { t } = useTranslation();

    const isPaid = order.payment_status === 'paid';
    const methodLabel = order.payment_method?.replace(/_/g, ' ') || 'netbanking';
    const last4 = order.payment_id?.slice(-4) || 'BWQu';

    return (
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#2B8441] flex items-center justify-center">
                        <CreditCard className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </div>
                    {t(OrderMessages.PAYMENT_INFO, "Payment Details")}
                </h4>

                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-10 h-7 rounded bg-slate-100 border border-slate-200 flex items-center justify-center text-[9px] font-black text-slate-500 shrink-0">
                            {order.payment_method?.includes('card') ? 'VISA' : 'UPI'}
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">
                                {methodLabel} ending in {last4}
                            </p>
                            <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide mt-0.5">
                                TRANSACTION ID: {order.payment_id || '—'}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-400 uppercase tracking-widest">Status:</span>
                        <span className={`text-xs font-black uppercase tracking-wide ${isPaid ? 'text-[#2B8441]' : 'text-amber-500'}`}>
                            {isPaid ? 'Captured & Verified' : 'Pending Verification'}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};
