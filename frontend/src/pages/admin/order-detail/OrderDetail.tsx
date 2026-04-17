import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
    ArrowLeft,
    Mail,
    AlertCircle,
    CheckCircle2,
    RefreshCcw,
    XCircle,
    ArrowRight,
} from "lucide-react";
import { orderService } from "@/services/order.service";
import { adminAlertService } from "@/services/admin-alert.service";
import type { Order } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { logger } from "@/lib/logger";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { OrderDetailSkeleton } from "@/components/ui/page-skeletons";
import { openInvoiceDocument } from "@/lib/invoice-download";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Megaphone, ShieldAlert, Printer, Trash2 } from "lucide-react";

// Modularized components
import { OrderTimelineSection } from "./components/OrderTimelineSection";
import { OrderItemsSection } from "./components/OrderItemsSection";
import { OrderPaymentSection } from "./components/OrderPaymentSection";
import { OrderCustomerSection } from "./components/OrderCustomerSection";
import { OrderEmailLogsSection } from "./components/OrderEmailLogsSection";
import { TaxAuditSection } from "./components/TaxAuditSection";
import { ReturnAuditView } from "./components/ReturnAuditView";

const getActiveInternalInvoice = (order: { invoice_id?: string; invoices?: any[] }) => {
    if (!order.invoices || !order.invoices.length) return null;
    return order.invoices.find(i => i.type === 'INTERNAL' && (i.id === order.invoice_id || !order.invoice_id));
};

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [statusToUpdate, setStatusToUpdate] = useState<string | null>(null);
    const [updateNotes, setUpdateNotes] = useState<string | undefined>(undefined);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [isAuditingReturn, setIsAuditingReturn] = useState(false);
    const [activeReturnFromApi, setActiveReturnFromApi] = useState<any>(null);
    const [loadingReturn, setLoadingReturn] = useState(false);

    const fetchOrderDetail = useCallback(async () => {
        if (!id) return;
        try {
            setLoading(true);
            const data = await orderService.getOrderById(id);
            setOrder(data);
            
            // Explicitly fetch active return request if the order has one
            if (data.status?.toLowerCase() === 'return_requested' || (data.return_requests && data.return_requests.length > 0)) {
                try {
                    setLoadingReturn(true);
                    const returnData = await orderService.getActiveReturnRequest(id);
                    setActiveReturnFromApi(returnData);
                } catch (err) {
                    logger.warn("Failed to fetch explicit return request, will fallback to order data", { id, err });
                } finally {
                    setLoadingReturn(false);
                }
            }

            // Mark alerts for this order as read
            void adminAlertService.markAsReadByReferenceId('order', id);
        } catch (error) {
            logger.error("Fetch order detail failed", { id, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.fetchDetail"),
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    }, [id, t, toast]);

    useEffect(() => {
        fetchOrderDetail();
    }, [fetchOrderDetail]);

    const handleStatusUpdate = useCallback(async (newStatus: string, notes?: string) => {
        setStatusToUpdate(newStatus);
        setUpdateNotes(notes);
        setConfirmDialogOpen(true);
    }, []);

    const handleConfirmStatusUpdate = useCallback(async () => {
        if (!id || !statusToUpdate) return;
        try {
            setUpdating(true);
            await orderService.updateStatus(id, statusToUpdate, updateNotes);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.statusUpdated"),
            });
            // Small delay to ensure DB propagation before refetch
            await new Promise(r => setTimeout(r, 200));
            await fetchOrderDetail();
        } catch (error) {
            logger.error("Status update failed", { id, statusToUpdate, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.statusUpdate"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
            setConfirmDialogOpen(false);
            setStatusToUpdate(null);
            setUpdateNotes(undefined);
        }
    }, [id, statusToUpdate, updateNotes, t, toast, fetchOrderDetail]);

    const handleReturnAction = useCallback(async (returnId: string, action: 'picked_up' | 'approve' | 'reject' | 'item_returned', notes?: string) => {
        try {
            setUpdating(true);
            await orderService.updateReturnRequestStatus(returnId, action, notes);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.returnUpdated"),
            });
            // Small delay to ensure DB propagation before refetch
            await new Promise(r => setTimeout(r, 200));
            await fetchOrderDetail();
        } catch (error) {
            logger.error("Return action failed", { returnId, action, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.returnAction"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
        }
    }, [t, toast, fetchOrderDetail]);

    const handleReturnItemStatus = useCallback(async (item: any, status: string) => {
        try {
            setUpdating(true);
            await orderService.updateReturnItemStatus(item.id, status);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.returnItemUpdated"),
            });
            fetchOrderDetail();
        } catch (error) {
            logger.error("Return item status update failed", { itemId: item.id, status, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.returnItemUpdate"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
        }
    }, [t, toast, fetchOrderDetail]);

    const handleCancelOrder = useCallback(async () => {
        if (!id) return;
        setCancelDialogOpen(false);
        await handleStatusUpdate('cancelled');
    }, [id, handleStatusUpdate]);

    const handleRegenerateInvoice = useCallback(async () => {
        if (!id) return;
        try {
            setRegenerating(true);
            toast({
                title: t("common.processing", "Processing"),
                description: t("admin.orders.detail.invoice.generating", "Generating platform invoice, please wait..."),
            });
            await orderService.regenerateInvoice(id);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.invoiceRegenerated", "Invoice has been regenerated successfully"),
            });
            await fetchOrderDetail();
        } catch (error) {
            logger.error("Invoice regeneration failed", { id, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.invoiceRegeneration", "Failed to regenerate invoice"),
                variant: "destructive",
            });
        } finally {
            setRegenerating(false);
        }
    }, [id, t, toast, fetchOrderDetail]);

    const handleConfirmDelivery = useCallback(async () => {
        await handleStatusUpdate('delivered');
    }, [handleStatusUpdate]);

    const handleInitiateReturn = useCallback(async () => {
        // This will activate the return management section or redirect as needed
        // For now, we scroll to it or just provide feedback
        const returnSection = document.getElementById('return-management-section');
        if (returnSection) {
            returnSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            toast({
                title: t("common.info"),
                description: t("admin.orders.detail.info.initiateReturnManual", "Please use the Return Management section below."),
            });
        }
    }, [t, toast]);

    const renderNote = useCallback((note: string | null | undefined) => {
        if (!note) return null;
        return <TranslatedText text={note} />;
    }, []);

    const sortedHistory = useMemo(() => {
        // Corrected property name from status_history to order_status_history (backend standard)
        const history = order?.order_status_history || [];
        return [...history].sort((a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
    }, [order?.order_status_history]);

    const returnRequests = useMemo(() => order?.return_requests || [], [order]);
    const activeReturnRequest = useMemo(() => {
        if (activeReturnFromApi) return activeReturnFromApi;
        return returnRequests.find(r => r.status.toLowerCase() === 'requested') || returnRequests[0];
    }, [returnRequests, activeReturnFromApi]);

    const hasReturnHistory = useMemo(() => 
        returnRequests.length > 0 || 
        order?.status?.toLowerCase() === 'return_requested' ||
        order?.status?.toLowerCase().includes('return')
    , [returnRequests, order?.status]);

    const activeReturnStatus = activeReturnRequest?.status?.toLowerCase() || 'requested';

    if (loading && !order) return <OrderDetailSkeleton />;
    if (!order) return <OrderDetailSkeleton />;

    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

    return (
        <div className="space-y-6 font-sans">
            {/* 1. STICKY PREMIUM RETURN AUDIT NOTIFICATION */}
            {hasReturnHistory && (
                <div className="sticky top-16 z-40 -mx-4 lg:-mx-8 px-4 lg:px-8 pb-4 bg-slate-50/80 backdrop-blur-md border-b border-orange-100">
                    <div className={`relative overflow-hidden rounded-2xl p-[1px] shadow-xl group animate-in fade-in slide-in-from-top-4 duration-700
                        ${activeReturnStatus === 'approved' ? 'bg-gradient-to-r from-emerald-600 via-green-600 to-emerald-500 shadow-emerald-200/40' : 
                          activeReturnStatus === 'rejected' ? 'bg-gradient-to-r from-red-600 via-rose-600 to-red-500 shadow-red-200/40' :
                          'bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 shadow-amber-200/40'}
                    `}>
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-white/20 via-transparent to-transparent pointer-events-none" />
                        <div className="bg-white/95 backdrop-blur-sm rounded-[15px] px-6 py-4 flex flex-col md:flex-row items-center justify-between gap-4 relative z-10">
                            <div className="flex items-center gap-5">
                                <div className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 shadow-inner group-hover:scale-105 transition-transform duration-500
                                    ${activeReturnStatus === 'approved' ? 'bg-emerald-100 text-emerald-600' : 
                                      activeReturnStatus === 'rejected' ? 'bg-red-100 text-red-600' :
                                      'bg-amber-100 text-amber-600'}
                                `}>
                                    <span className="relative flex h-5 w-5">
                                        {activeReturnStatus === 'requested' && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>}
                                        {activeReturnStatus === 'approved' ? <CheckCircle2 className="relative inline-flex h-5 w-5" /> : 
                                         activeReturnStatus === 'rejected' ? <XCircle className="relative inline-flex h-5 w-5" /> : 
                                         <AlertCircle className="relative inline-flex h-5 w-5" />}
                                    </span>
                                </div>
                                <div className="flex-1">
                                    <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2 leading-tight">
                                        {isAuditingReturn 
                                            ? t("admin.orders.detail.audit.titleInProgress", "Return Audit in Progress")
                                            : activeReturnStatus === 'approved' ? "Return Request Approved" :
                                              activeReturnStatus === 'rejected' ? "Return Request Rejected" :
                                              t("admin.orders.detail.audit.title", "Action Required: Return Audit Pending")
                                        }
                                        {activeReturnStatus === 'requested' && !isAuditingReturn && <Badge className="bg-orange-500 text-white border-none text-[8px] h-4 font-black px-1.5 uppercase tracking-tighter shadow-sm">Urgent</Badge>}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide opacity-80 mt-0.5">
                                        {activeReturnStatus === 'rejected' 
                                            ? "This return request has been denied. The customer can re-submit with updated details."
                                            : activeReturnStatus === 'approved'
                                            ? "Audit complete. The item is now eligible for pickup or refund processing."
                                            : t("admin.orders.detail.audit.description")}
                                    </p>
                                </div>
                            </div>
                            <Button 
                                variant={isAuditingReturn ? "outline" : "default"}
                                onClick={() => {
                                    setIsAuditingReturn(true);
                                    setTimeout(() => {
                                        document.getElementById('return-audit-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                                    }, 100);
                                }}
                                className={`font-black text-[10px] uppercase tracking-[0.15em] px-8 h-12 rounded-xl shadow-lg transition-all duration-300 hover:scale-[1.02] active:scale-95 group flex items-center gap-2 shrink-0
                                    ${isAuditingReturn ? "border-slate-200 text-slate-700 bg-slate-50" : 
                                      activeReturnStatus === 'approved' ? "bg-emerald-600 hover:bg-emerald-700 text-white" :
                                      activeReturnStatus === 'rejected' ? "bg-red-600 hover:bg-red-700 text-white" :
                                      "bg-amber-600 hover:bg-amber-700 text-white"}
                                `}
                            >
                                <span>
                                    {isAuditingReturn ? "Viewing Audit Details" : 
                                     activeReturnStatus === 'approved' || activeReturnStatus === 'rejected' ? "View Audit Summary" :
                                     t("admin.orders.detail.audit.cta", "Start Return Audit")}
                                </span>
                                <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* 2. RETURN AUDIT WORKFLOW (Integrated Section) */}
            {isAuditingReturn && (
                <div id="return-audit-section" className="animate-in zoom-in-95 fill-mode-both duration-500">
                    {loadingReturn ? (
                        <Card className="border-none shadow-xl bg-white p-20 flex flex-col items-center justify-center gap-4 rounded-3xl">
                            <RefreshCcw className="h-10 w-10 text-indigo-500 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Retrieving Detailed Claim Data...</p>
                        </Card>
                    ) : (
                        <ReturnAuditView 
                            order={order}
                            returnRequest={activeReturnFromApi || returnRequests.find(r => ['requested','approved','pickup_scheduled','picked_up','item_returned'].includes(r.status.toLowerCase())) || returnRequests[0] || {
                                id: 'PENDING',
                                order_id: order.id,
                                status: 'requested',
                                reason: 'Processing return details...',
                                created_at: new Date().toISOString(),
                                refund_amount: 0,
                                refund_breakdown: { totalRefund: 0, totalTaxRefund: 0 },
                                return_items: []
                            } as any}
                            updating={updating}
                            onBack={() => setIsAuditingReturn(false)}
                            onApprove={async (rid, notes) => { await handleReturnAction(rid, 'approve', notes); }}
                            onReject={async (rid, notes) => { await handleReturnAction(rid, 'reject', notes); setIsAuditingReturn(false); }}
                            onMarkPickedUp={async (rid) => { await handleReturnAction(rid, 'picked_up'); }}
                            onMarkReturned={async (rid) => { await handleReturnAction(rid, 'item_returned'); }}
                            history={sortedHistory}
                        />
                    )}
                </div>
            )}

            {/* 3. ORDER HEADER & MAIN DETAILS (Hidden during active audit) */}
            {!isAuditingReturn && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <Link
                                to="/admin/orders"
                                className="text-sm text-muted-foreground hover:text-primary flex items-center gap-1 mb-2 w-fit"
                            >
                                <ArrowLeft className="h-4 w-4" />
                                {t("admin.orders.detail.header.backToOrders")}
                            </Link>
                            <div className="flex flex-wrap items-center gap-3">
                                <h1 className="text-2xl font-bold">
                                    {t("admin.orders.detail.header.title", { number: order.order_number })}
                                </h1>
                                <Badge
                                    variant={
                                        order.status === 'delivered' ? 'default' :
                                            order.status === 'cancelled' ? 'destructive' : 'secondary'
                                    }
                                    className={`uppercase ${order.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                            order.status === 'delivered' ? 'bg-green-600 text-white hover:bg-green-600' :
                                                order.status === 'processing' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : ''
                                        }`}
                                >
                                    {t(`orderStatus.${order.status}`)}
                                </Badge>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setCancelDialogOpen(true)}
                                disabled={order.status === 'cancelled' || order.status === 'delivered'}
                                className="h-9 text-red-600 hover:text-red-700 hover:bg-red-50 font-bold text-xs flex items-center gap-2"
                            >
                                <XCircle className="h-4 w-4" />
                                {t("admin.orders.detail.header.cancelOrder", "Cancel Order")}
                            </Button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Side (2/3) */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Order Items */}
                            <OrderItemsSection items={order.items || []} />

                            {/* Detailed Tax Summary & Audit */}
                            <TaxAuditSection 
                                items={order.items || []}
                                subtotal={order.subtotal}
                                coupon_discount={order.coupon_discount}
                                delivery_charge={order.delivery_charge}
                                delivery_gst={order.delivery_gst}
                                total_amount={order.total_amount}
                                isInterState={(order.items?.[0]?.igst || 0) > 0}
                            />

                            {/* Order Email Logs */}
                            <OrderEmailLogsSection emailLogs={order.email_logs || []} />
                        </div>

                        {/* Right Side (1/3) */}
                        <div className="space-y-6">
                            {/* Customer & Address Sections */}
                            <OrderCustomerSection order={order} />

                            {/* Payment Info */}
                            <OrderPaymentSection
                                order={order}
                                renderNote={renderNote}
                                getActiveInternalInvoice={getActiveInternalInvoice}
                                openInvoiceDocument={openInvoiceDocument}
                                handleRegenerateInvoice={handleRegenerateInvoice}
                                regenerating={regenerating}
                            />
                        </div>
                    </div>

                    {/* Bottom Section (Full Width) */}
                    <OrderTimelineSection
                        orderId={order.id}
                        sortedHistory={sortedHistory}
                        currentStatus={order.status}
                        refunds={order.refunds || []}
                        returnRequests={order.return_requests || []}
                        onStatusUpdate={handleStatusUpdate}
                        onReturnAction={handleReturnAction}
                        onReturnItemStatus={handleReturnItemStatus}
                        isUpdating={updating}
                    />
                </div>
            )}

            {/* Dialogs */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.orders.detail.dialogs.confirmStatus.title")}</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-4">
                            <p>{t("admin.orders.detail.dialogs.confirmStatus.description", { status: t(`admin.orders.status.${statusToUpdate}`, statusToUpdate || '') })}</p>
                            
                            {statusToUpdate === 'delivery_unsuccessful' && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reason for Failure (Mandatory)</label>
                                    <Input 
                                        placeholder="e.g. Customer unavailable, Incorrect address..." 
                                        className="text-xs font-bold border-red-100 bg-red-50/10"
                                        value={updateNotes?.replace("Delivery unsuccessful: ", "") || ""}
                                        onChange={(e) => setUpdateNotes(`Delivery unsuccessful: ${e.target.value}`)}
                                        autoFocus
                                    />
                                </div>
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={updating} onClick={() => setUpdateNotes(undefined)}>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmStatusUpdate();
                            }}
                            disabled={updating || (statusToUpdate === 'delivery_unsuccessful' && (!updateNotes || updateNotes.replace("Delivery unsuccessful: ", "").trim() === ""))}
                        >
                            {updating ? t("common.updating") : t("common.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-red-600 font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                            <XCircle className="h-5 w-5" />
                            {t("admin.orders.detail.dialogs.confirmCancel.title", "Confirm Order Cancellation")}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-xs font-semibold text-slate-500 leading-relaxed pt-2">
                            {t("admin.orders.detail.dialogs.confirmCancel.description", "Are you sure you want to cancel this order? This action will stop the fulfillment process and notify the customer. This action cannot be easily undone.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="pt-4">
                        <AlertDialogCancel disabled={updating} className="text-xs font-bold border-slate-200">{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleCancelOrder();
                            }}
                            disabled={updating}
                            className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                        >
                            {updating ? t("common.updating") : t("admin.orders.detail.dialogs.confirmCancel.confirm", "Yes, Cancel Order")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
