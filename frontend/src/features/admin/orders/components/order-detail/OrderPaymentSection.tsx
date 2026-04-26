import { memo } from "react";
import { useTranslation } from "react-i18next";
import { 
    CreditCard, 
    ShieldCheck, 
    ReceiptText, 
    FileText, 
    History,
    ExternalLink,
    Banknote,
    RefreshCcw,
    Plus
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";

interface OrderPaymentSectionProps {
    order: any;
    openInvoiceDocument: (url: string) => Promise<void>;
    handleRegenerateInvoice: () => Promise<void>;
    regenerating: boolean;
}

export const OrderPaymentSection = memo(({
    order,
    openInvoiceDocument,
    handleRegenerateInvoice,
    regenerating
}: OrderPaymentSectionProps) => {
    const { t } = useTranslation();

    const isPaid = (order.payment_status || '').toLowerCase() === 'paid';
    const isRefunded = (order.payment_status || '').toLowerCase() === 'refunded';
    const isRefundInitiated = (order.payment_status || '').toLowerCase() === 'refund_initiated';
    const isPartiallyRefunded = (order.payment_status || '').toLowerCase() === 'partially_refunded';
    const adminActions = order.view_state?.actions?.admin;
    const canManageInvoice = adminActions?.can_manage_invoice ?? false;
    const hasPlatformInvoice = order.view_state?.documents?.can_download_invoice ?? false;
    const platformInvoiceUrl = order.view_state?.documents?.invoice_url ?? null;
    const receiptUrl = order.view_state?.documents?.receipt_url ?? null;

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            minimumFractionDigits: 2
        }).format(amount);
    };

    return (
        <div className="space-y-6">
            {/* Amount to Settle Card */}
            <Card className={`border-none shadow-sm overflow-hidden ${isPaid ? "bg-emerald-600 text-white" : "bg-slate-800 text-white"}`}>
               <CardContent className="p-6 relative">
                    <div className="absolute right-[-20px] top-[-20px] opacity-10">
                        <Banknote size={120} />
                    </div>
                    <div className="flex flex-col gap-1 relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-70">
                            {t("admin.orders.detail.paymentInfo.amountToSettle", "Amount to Settle")}
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black tracking-tighter">
                                {formatCurrency(order.total_amount)}
                            </span>
                            <Badge variant="outline" className="bg-white/10 border-white/20 text-white text-[10px] uppercase font-bold px-2 py-0 border">
                                {t(`admin.orders.status.${order.payment_status?.toLowerCase().replace(/ /g, '_')}`, order.payment_status) as string}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 mt-4 opacity-80">
                            <ShieldCheck size={14} />
                            <span className="text-[11px] font-bold tracking-wide italic">
                                {isPaid 
                                    ? t("admin.orders.detail.paymentInfo.fullySettled", "Fully Settled via Razorpay Gateway") 
                                    : t("admin.orders.detail.paymentInfo.pendingSettlement", "Pending Settlement")}
                            </span>
                        </div>
                    </div>
               </CardContent>
            </Card>

            {/* Payment Details Card */}
            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xs font-bold flex items-center gap-2 text-slate-800 uppercase tracking-tight">
                            <CreditCard className="h-3.5 w-3.5 text-primary" />
                            {t("admin.orders.detail.paymentInfo.detailsTitle", "Payment Details")}
                        </CardTitle>
                        {isPaid && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-600 border-emerald-100 text-[8px] font-black uppercase tracking-widest h-4 px-1.5">
                                {t("admin.orders.detail.paymentInfo.received", "Received")}
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-5 space-y-5">
                    <div className="grid grid-cols-2 gap-y-5 gap-x-4">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t("admin.orders.detail.paymentInfo.method", "Method")}</span>
                            <p className="text-[11px] font-black text-slate-700 uppercase flex items-center gap-1.5">
                                {order.payment_method?.toLowerCase() === 'upi' ? (
                                    <div className="w-4 h-4 rounded-sm bg-slate-100 flex items-center justify-center text-[8px] font-black text-slate-500">BHIM</div>
                                ) : (
                                    <Banknote size={12} className="text-slate-400" />
                                )}
                                {t(`admin.orders.detail.paymentInfo.methods.${order.payment_method?.toLowerCase()}`, order.payment_method || "Online") as string}
                            </p>
                        </div>
                        <div className="flex flex-col gap-0.5 text-right">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t("admin.orders.detail.paymentInfo.gateway", "Gateway")}</span>
                            <p className="text-[11px] font-bold text-slate-700">RAZORPAY_INDIA</p>
                        </div>
                        
                        <div className="flex flex-col gap-0.5 col-span-2 pt-3 border-t border-slate-50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t("admin.orders.detail.paymentInfo.paymentId", "Transaction ID")}</span>
                            <code className="text-[9px] font-bold text-slate-500 break-all bg-slate-50/50 p-1.5 rounded border border-slate-100/80 mt-1">
                                {order.payment_id || "N/A"}
                            </code>
                        </div>

                        {order.invoice_id && (
                            <div className="flex flex-col gap-0.5 col-span-2 pt-1">
                                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{t("admin.orders.detail.paymentInfo.invoiceId", "Invoice ID")}</span>
                                <code className="text-[9px] font-bold text-slate-400/80 mt-0.5">
                                    {order.invoice_id}
                                </code>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Refund Summary Card (Mockup Style) */}
            {(isRefunded || isRefundInitiated || isPartiallyRefunded || (order.refunds && order.refunds.length > 0)) && (
                <Card className="border-none shadow-sm overflow-hidden bg-white ring-1 ring-slate-100">
                    <CardHeader className="bg-emerald-50/50 border-b border-emerald-100/50 py-4 flex flex-row items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-lg shadow-emerald-200">
                            <RefreshCcw size={20} />
                        </div>
                        <div className="flex flex-col">
                            <CardTitle className="text-sm font-black text-slate-800 leading-none">{t("admin.orders.detail.payment.refundDetails")}</CardTitle>
                            <span className="text-[10px] font-bold text-emerald-600 mt-1 uppercase tracking-tight">
                                {t(`admin.orders.status.${order.payment_status?.toLowerCase().replace(/ /g, '_')}`, order.payment_status) as string}
                            </span>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {(() => {
                            const latestRefund = order.refunds?.[0];
                            return (
                                <div className="space-y-2 pb-4 border-b border-slate-50">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold text-slate-500">{t("admin.orders.detail.payment.refundType")}</span>
                                        <span className="text-xs font-black text-slate-700">
                                            {order.refunds?.length > 1 ? t("admin.orders.detail.payment.refundTypePartial", { count: order.refunds.length }) : t("admin.orders.detail.payment.refundTypeFull")}
                                        </span>
                                    </div>
                                    {latestRefund?.razorpay_refund_id && (
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs font-bold text-slate-400">{t("admin.orders.detail.payment.refundId")}</span>
                                            <code className="text-[9px] font-black text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                                                {latestRefund.razorpay_refund_id}
                                            </code>
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">{t("admin.orders.detail.payment.totalRefundAmount")}</span>
                            <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                                {formatCurrency(order.refunds?.reduce((sum: number, r: any) => sum + (r.amount || 0), 0) || 0)}
                            </span>
                        </div>

                        <div className="bg-emerald-50 rounded-xl p-3 flex items-start gap-2 border border-emerald-100/50">
                            <ShieldCheck size={14} className="text-emerald-600 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-emerald-800 font-bold leading-normal italic">
                                {t("admin.orders.detail.payment.gatewayRefundDesc")}
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Refund History Details (Optional, collapsed or simpler) */}
            {(order.refunds && order.refunds.length > 1) && (
                <Card className="border-none shadow-sm overflow-hidden bg-white border-l-4 border-l-red-500">
                    <CardHeader className="bg-red-50/30 border-b border-red-50 py-3">
                        <CardTitle className="text-[10px] font-black flex items-center gap-2 text-red-800 uppercase tracking-widest">
                            <History className="h-3 w-3" />
                            {t("admin.orders.detail.payment.cumulativeHistory")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        {order.refunds.map((ref: any, idx: number) => (
                            <div key={idx} className="flex flex-col gap-1.5 border-b border-slate-50 last:border-0 pb-2">
                                <div className="flex justify-between items-center text-[10px]">
                                    <span className="text-slate-400 font-bold uppercase tracking-tighter">{t("admin.orders.detail.payment.itemRefundCount", { count: idx + 1 })}</span>
                                    <span className="text-slate-700 font-black">{formatCurrency(ref.amount || 0)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <code className="text-[9px] text-slate-400 font-mono bg-slate-50 px-1 rounded">{ref.razorpay_refund_id || ref.id}</code>
                                    <Badge className={`text-[8px] h-3.5 px-1 font-black uppercase tracking-tighter ${
                                        ref.status === 'processed' 
                                            ? 'bg-green-100 text-green-700 border-green-200' 
                                            : 'bg-orange-100 text-orange-700 border-orange-200'
                                    }`}>
                                        {ref.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            )}

            {/* Linked Documents Card */}
            <Card className="border-none shadow-sm overflow-hidden bg-white">
                <CardHeader className="bg-slate-50/50 border-b border-slate-100 py-3">
                        <CardTitle className="text-[10px] font-black flex items-center justify-between w-full text-slate-400 uppercase tracking-[0.1em]">
                        <div className="flex items-center gap-2">
                            {t("admin.orders.detail.paymentInfo.documentsTitle", "Associated Documents")}
                        </div>
                        {canManageInvoice && (
                            <Button 
                                variant="ghost" 
                                size="sm" 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    void handleRegenerateInvoice();
                                }} 
                                disabled={regenerating}
                                className="h-6 px-2 text-[9px] font-bold text-primary hover:bg-primary/5 uppercase tracking-tighter gap-1"
                            >
                                {regenerating ? <RefreshCcw size={10} className="animate-spin" /> : (hasPlatformInvoice ? <RefreshCcw size={10} /> : <Plus size={10} />)}
                                {hasPlatformInvoice ? t("common.regenerate", "Regenerate") : t("common.generate", "Generate")}
                            </Button>
                        )}
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-3 space-y-1">
                    {/* Razorpay Receipt */}
                    {receiptUrl && (
                        <div 
                            className="group flex items-center justify-between p-2 rounded-lg border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all cursor-pointer"
                            onClick={() => window.open(receiptUrl, '_blank')}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100">
                                    <FileText size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-700">{t("admin.orders.detail.paymentInfo.razorpayReceipt", "Razorpay Receipt")}</span>
                                    <span className="text-[9px] text-slate-400 mt-[-2px]">txn_upi_3241...</span>
                                </div>
                            </div>
                            <ExternalLink size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                    )}

                    {/* Platform Tax Invoice */}
                    {hasPlatformInvoice && platformInvoiceUrl && (
                        <div 
                            className="group flex items-center justify-between p-2 rounded-lg border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-all cursor-pointer"
                            onClick={() => {
                                void openInvoiceDocument(platformInvoiceUrl);
                            }}
                        >
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded bg-emerald-50 flex items-center justify-center text-emerald-600 border border-emerald-100">
                                    <FileText size={14} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-bold text-slate-700">{t("admin.orders.detail.paymentInfo.invoice", "Platform Invoice")}</span>
                                    <span className="text-[9px] text-slate-400 mt-[-2px]">INV_BL_4592_ORG...</span>
                                </div>
                            </div>
                            <ExternalLink size={12} className="text-slate-300 group-hover:text-primary transition-colors" />
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
});

OrderPaymentSection.displayName = "OrderPaymentSection";
