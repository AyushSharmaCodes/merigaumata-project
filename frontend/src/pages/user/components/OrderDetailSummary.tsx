import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { useCurrency } from "@/contexts/CurrencyContext";

interface OrderDetailSummaryProps {
    order: any;
    canReturn: boolean;
    onReturnClick: () => void;
}

export const OrderDetailSummary: React.FC<OrderDetailSummaryProps> = ({ 
    order, 
    canReturn, 
    onReturnClick 
}) => {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();

    return (
        <div className="space-y-4">
            <Card className="rounded-2xl border border-[#E8E0D5] shadow-sm bg-[#F5F0E8] overflow-hidden">
                <CardHeader className="px-6 pt-6 pb-4">
                    <CardTitle className="text-lg font-black text-slate-900 tracking-tight">Order Summary</CardTitle>
                </CardHeader>
                <CardContent className="px-6 pb-6 space-y-4">
                    {/* Line items */}
                    <div className="space-y-3">
                        <div className="flex justify-between text-sm text-slate-500 font-medium">
                            <span>Subtotal</span>
                            <span className="text-slate-800 font-bold">{formatAmount(order.subtotal || 0)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500 font-medium">
                            <span>Tax (GST 12%)</span>
                            <span className="text-slate-800 font-bold">
                                {formatAmount(order.total_taxable_amount
                                    ? (order.total_amount - order.total_taxable_amount)
                                    : (order.total_amount * 0.12))}
                            </span>
                        </div>
                        <div className="flex justify-between text-sm text-slate-500 font-medium">
                            <span>Shipping &amp; Handling</span>
                            <span className={`font-bold ${(order.delivery_charge || 0) === 0 ? 'text-[#2B8441]' : 'text-slate-800'}`}>
                                {(order.delivery_charge || 0) === 0 ? "FREE" : formatAmount(order.delivery_charge)}
                            </span>
                        </div>
                    </div>

                    {/* Total */}
                    <div className="pt-4 border-t border-[#D9D0C4]">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">TOTAL PAID</p>
                        <div className="flex items-center justify-between">
                            <span className="text-4xl font-black text-slate-900 tracking-tight">
                                {formatAmount(order.total_amount)}
                            </span>
                            <div className="w-8 h-8 rounded-full bg-[#2B8441] flex items-center justify-center">
                                <CheckCircle2 className="h-5 w-5 text-white" strokeWidth={2.5} />
                            </div>
                        </div>
                    </div>

                    {/* Need Help */}
                    <div className="pt-2 space-y-3">
                        <Button
                            variant="outline"
                            className="w-full rounded-xl h-12 border border-[#C8C0B4] bg-transparent text-slate-700 font-semibold text-sm hover:bg-white/60 transition-all flex items-center justify-center gap-2"
                        >
                            <div className="w-5 h-5 rounded-full bg-[#2B8441] flex items-center justify-center text-white text-[10px] font-black">?</div>
                            {t("common.needHelp", "Need Help?")}
                        </Button>
                        <p className="text-[10px] text-center text-slate-400 leading-relaxed">
                            By placing this order, you agree to our sustainability pledge and ethical sourcing terms.
                        </p>
                    </div>
                </CardContent>
            </Card>

            {canReturn && (
                <Button
                    className="w-full rounded-xl h-12 bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm flex items-center justify-center gap-2"
                    onClick={onReturnClick}
                >
                    <RotateCcw className="h-4 w-4" />
                    {t(OrderMessages.REQUEST_RETURN, "Request Return")}
                </Button>
            )}
        </div>
    );
};
