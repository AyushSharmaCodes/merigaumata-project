import { lazy, Suspense, useEffect, useState, useCallback, useMemo } from "react";
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
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

import { OrderItemsSection } from "./components/OrderItemsSection";
import { OrderPaymentSection } from "./components/OrderPaymentSection";
import { OrderCustomerSection } from "./components/OrderCustomerSection";
import { OrderEmailLogsSection } from "./components/OrderEmailLogsSection";
import { Textarea } from "@/components/ui/textarea";
import { OrderCancellationDialog } from "./components/OrderCancellationDialog";
import { DeliveryUnsuccessfulDialog } from "./components/DeliveryUnsuccessfulDialog";

const OrderTimelineSection = lazy(() =>
    import("./components/OrderTimelineSection").then((module) => ({ default: module.OrderTimelineSection }))
);
const TaxAuditSection = lazy(() =>
    import("./components/TaxAuditSection").then((module) => ({ default: module.TaxAuditSection }))
);
const ReturnAuditView = lazy(() =>
    import("./components/ReturnAuditView").then((module) => ({ default: module.ReturnAuditView }))
);

const getActiveInternalInvoice = (order: { invoice_id?: string; invoices?: any[] }) => {
    if (!order.invoices || !order.invoices.length) return null;
    return order.invoices.find(i =>
        ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type) &&
        (i.id === order.invoice_id || !order.invoice_id)
    );
};

const HIGH_FREQUENCY_ORDER_STATUSES = new Set([
    'pending',
    'confirmed',
    'processing',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivery_unsuccessful',
    'delivery_reattempt_scheduled',
    'rto_in_transit',
    'returned_to_origin',
    'return_requested',
    'return_approved',
    'pickup_scheduled',
    'pickup_attempted',
    'pickup_completed',
    'picked_up',
    'in_transit_to_warehouse',
    'partially_returned',
    'qc_initiated',
    'refund_initiated'
]);

function SectionLoadingCard({ label }: { label: string }) {
    return (
        <Card className="border-none shadow-sm bg-white">
            <CardContent className="p-10 flex flex-col items-center justify-center gap-3">
                <RefreshCcw className="h-6 w-6 animate-spin text-slate-400" />
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    {label}
                </p>
            </CardContent>
        </Card>
    );
}

const formatOrderStatusLabel = (t: any, status: string) =>
    t(`orderStatus.${status}`, {
        defaultValue: status
            .split("_")
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(" ")
    });

export default function OrderDetail() {
    const { id } = useParams<{ id: string }>();
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [updating, setUpdating] = useState(false);
    const [statusToUpdate, setStatusToUpdate] = useState<string | null>(null);
    const [updateNotes, setUpdateNotes] = useState<string | undefined>(undefined);
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [unsuccessfulDialogOpen, setUnsuccessfulDialogOpen] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [isAuditingReturn, setIsAuditingReturn] = useState(false);

    // 1. Fetch Main Order Data
    const { 
        data: order, 
        isLoading: orderLoading, 
        isFetching: orderFetching
    } = useQuery({
        queryKey: ["admin-order", id],
        queryFn: () => orderService.getOrderById(id!),
        enabled: !!id,
        staleTime: 5000,
        refetchInterval: (query) => {
            const orderData = query.state.data as Order | undefined;
            const status = orderData?.status?.toLowerCase?.() || '';
            const paymentStatus = (orderData?.payment_status || (orderData as any)?.paymentStatus || '').toLowerCase?.() || '';
            const needsHighFrequencySync = HIGH_FREQUENCY_ORDER_STATUSES.has(status) || (
                status === 'returned' && !['refunded', 'partially_refunded'].includes(paymentStatus)
            );

            return needsHighFrequencySync ? 8000 : 30000;
        },
        refetchIntervalInBackground: false,
    });

    // 2. Conditional Fetch for Active Return Request
    // [OPTIMIZATION]: Now joined in getOrderById payload. This secondary fetch is 
    // kept as a fallback or for independent polling if needed, but disabled by default 
    // to reduce DB round trips as per user request.
    const { 
        data: activeReturnFromApi, 
        isLoading: returnLoading
    } = useQuery({
        queryKey: ["admin-order-return", id],
        queryFn: () => orderService.getActiveReturnRequest(id!),
        enabled: false, // Disabled: using joined data in useQuery(["admin-order", id])
        refetchIntervalInBackground: false,
    });

    // Helper to refresh all data manually
    const refreshData = useCallback(async () => {
        await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["admin-order", id] }),
            queryClient.invalidateQueries({ queryKey: ["admin-order-return", id] }),
            adminAlertService.markAsReadByReferenceId('order', id!)
        ]);
    }, [id, queryClient]);

    // Initial effect for mark as read (admin alert sync)
    useEffect(() => {
        if (id) {
            void adminAlertService.markAsReadByReferenceId('order', id);
        }
    }, [id]);

    const handleStatusUpdate = useCallback(async (newStatus: string, notes?: string) => {
        if (newStatus === 'delivery_unsuccessful') {
            setUnsuccessfulDialogOpen(true);
            return;
        }
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
                description: t("admin.orders.detail.success.statusUpdated", {
                    status: formatOrderStatusLabel(t, statusToUpdate)
                }),
            });
            // Small delay to ensure DB propagation before cache invalidation
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
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
    }, [id, statusToUpdate, updateNotes, t, toast, refreshData]);

    const handleReturnAction = useCallback(async (returnId: string, action: 'picked_up' | 'approve' | 'reject' | 'item_returned', notes?: string) => {
        try {
            setUpdating(true);
            await orderService.updateReturnRequestStatus(returnId, action, notes);
            
            // Handled via backend aggregateOrderState

            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.returnUpdated"),
            });
            // Small delay to ensure DB propagation before cache invalidation
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
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
    }, [id, order, t, toast, refreshData]);

    const handleReturnItemStatus = useCallback(async (item: any, status: string) => {
        try {
            setUpdating(true);
            await orderService.updateReturnItemStatus(item.id, status);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.returnItemUpdated"),
            });
            refreshData();
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
    }, [t, toast, refreshData]);

    const handleQCComplete = useCallback(async (returnItemId: string, qcData: any) => {
        try {
            setUpdating(true);
            await orderService.submitQCResult(returnItemId, qcData);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.qcFinalized", "Quality Check finalized and outcome initiated."),
            });
            // Small delay to ensure DB propagation before cache invalidation
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
        } catch (error) {
            logger.error("QC submission failed", { returnItemId, qcData, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.qcUpdate", "Failed to submit QC results"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
        }
    }, [t, toast, refreshData]);

    const handleCancelOrder = useCallback(async (reason: string) => {
        if (!id) return;
        await handleStatusUpdate('cancelled_by_admin', reason);
        setCancelDialogOpen(false);
    }, [id, handleStatusUpdate]);

    const handleUnsuccessfulDelivery = useCallback(async (reason: string) => {
        if (!id) return;
        try {
            setUpdating(true);
            await orderService.updateStatus(id, 'delivery_unsuccessful', reason);
            toast({
                title: t("common.success"),
                description: t("admin.orders.detail.success.deliveryLogged", "Delivery failure record updated successfully."),
            });
            await new Promise(r => setTimeout(r, 200));
            await refreshData();
        } catch (error) {
            logger.error("Delivery failure log failed", { id, error });
            toast({
                title: t("common.error"),
                description: t("admin.orders.detail.errors.deliveryLog"),
                variant: "destructive",
            });
        } finally {
            setUpdating(false);
            setUnsuccessfulDialogOpen(false);
        }
    }, [id, t, toast, refreshData]);

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
            await refreshData();
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
    }, [id, t, toast, refreshData]);

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
        // [OPTIMIZATION]: Use returned_requests from the main order payload (Single Round Trip)
        const joinedReturn = (order as any)?.return_requests?.find((r: any) => 
            ['requested', 'approved', 'pickup_scheduled', 'picked_up'].includes(r.status.toLowerCase())
        );
        
        if (joinedReturn) return joinedReturn;
        
        // Fallback to secondary API fetch (if manually enabled/triggered)
        if (activeReturnFromApi) return activeReturnFromApi;
        
        // Final fallback to any return request available
        if (returnRequests.length === 0) return null;
        return returnRequests[0];
    }, [returnRequests, activeReturnFromApi, order]);

    const wasDeliveryFailed = useMemo(() => 
        (order?.order_status_history || []).some(h => h.status === 'delivery_unsuccessful')
    , [order?.order_status_history]);

    const hasReturnHistory = useMemo(() => 
        // Only show return history UI if it was a customer-requested return,
        // not an administrative RTO following a delivery failure.
        !wasDeliveryFailed && (
            returnRequests.length > 0 || 
            order?.status?.toLowerCase() === 'return_requested' ||
            order?.status?.toLowerCase().includes('return')
        )
    , [returnRequests, order?.status, wasDeliveryFailed]);

    const activeReturnStatus = activeReturnRequest?.status?.toLowerCase() || 'requested';
    const orderPlacedAt = order?.created_at
        ? new Intl.DateTimeFormat(i18n.language === 'hi' ? 'hi-IN' : i18n.language === 'ta' ? 'ta-IN' : 'en-IN', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(new Date(order.created_at))
        : null;

    if (orderLoading && !order) return <OrderDetailSkeleton />;
    if (!order) return <OrderDetailSkeleton />;

    const statuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled_by_admin', 'cancelled_by_customer'];

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
                                            ? t("admin.orders.detail.audit.titleInProgress")
                                            : activeReturnStatus === 'approved' ? t("admin.orders.detail.returnApproved") :
                                              activeReturnStatus === 'rejected' ? t("admin.orders.detail.returnRejected") :
                                              t("admin.orders.detail.audit.title")
                                        }
                                        {activeReturnStatus === 'requested' && !isAuditingReturn && <Badge className="bg-orange-500 text-white border-none text-[8px] h-4 font-black px-1.5 uppercase tracking-tighter shadow-sm">{t("admin.orders.detail.urgent")}</Badge>}
                                    </h3>
                                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-wide opacity-80 mt-0.5">
                                        {activeReturnStatus === 'rejected' 
                                            ? t("admin.orders.detail.audit.rejectedDesc", "This return request has been denied. The customer can re-submit with updated details.")
                                            : activeReturnStatus === 'approved'
                                            ? t("admin.orders.detail.audit.approvedDesc", "Audit complete. The item is now eligible for pickup or refund processing.")
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
                                    {isAuditingReturn ? t("admin.orders.detail.viewingAudit") : 
                                     activeReturnStatus === 'approved' || activeReturnStatus === 'rejected' ? t("admin.orders.detail.viewAuditSummary") :
                                     t("admin.orders.detail.audit.cta")}
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
                    {returnLoading && !activeReturnFromApi ? (
                        <Card className="border-none shadow-xl bg-white p-20 flex flex-col items-center justify-center gap-4 rounded-3xl">
                            <RefreshCcw className="h-10 w-10 text-indigo-500 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                                {t("admin.orders.detail.audit.loadingData", "Retrieving Detailed Claim Data...")}
                            </p>
                        </Card>
                    ) : (
                        <Suspense fallback={<SectionLoadingCard label={t("admin.orders.detail.audit.loadingData", "Retrieving Detailed Claim Data...")} />}>
                            <ReturnAuditView 
                                order={order}
                                returnRequest={activeReturnRequest!}
                                updating={updating}
                                onBack={() => setIsAuditingReturn(false)}
                                onApprove={async (rid, notes) => { await handleReturnAction(rid, 'approve', notes); }}
                                onReject={async (rid, notes) => { await handleReturnAction(rid, 'reject', notes); setIsAuditingReturn(false); }}
                                onMarkPickedUp={async (rid) => { await handleReturnAction(rid, 'picked_up'); }}
                                onMarkReturned={async (rid) => { await handleReturnAction(rid, 'item_returned'); }}
                                onUpdateStatus={async (rid, ns) => { await handleReturnAction(rid, ns as any); }}
                                onQCComplete={handleQCComplete}
                                history={sortedHistory}
                            />
                        </Suspense>
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
                                            ['cancelled', 'cancelled_by_admin', 'cancelled_by_customer'].includes(order.status) ? 'destructive' : 'secondary'
                                    }
                                    className={`uppercase ${order.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                        order.status === 'shipped' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                            order.status === 'delivered' ? 'bg-green-600 text-white hover:bg-green-600' :
                                                order.status === 'processing' ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : ''
                                        }`}
                                >
                                    {formatOrderStatusLabel(t, order.status)}
                                </Badge>
                            </div>
                            {orderPlacedAt ? (
                                <p className="text-sm text-muted-foreground">
                                    {t("admin.orders.detail.header.placedOn", { defaultValue: "Placed on {{date}}", date: orderPlacedAt })}
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                            {/* Header actions can be added here if needed in future */}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Side (2/3) */}
                        <div className="lg:col-span-2 space-y-6">
                            {/* Order Items */}
                            <OrderItemsSection items={order.items || []} />

                            {/* Detailed Tax Summary & Audit */}
                            <Suspense fallback={<SectionLoadingCard label={t("admin.orders.detail.taxAudit.title", "Detailed Tax Summary & Audit")} />}>
                                <TaxAuditSection 
                                    items={order.items || []}
                                    subtotal={order.subtotal}
                                    coupon_discount={order.coupon_discount}
                                    delivery_charge={order.delivery_charge}
                                    delivery_gst={order.delivery_gst}
                                    total_amount={order.total_amount}
                                    isInterState={(order.items?.[0]?.igst || 0) > 0}
                                />
                            </Suspense>

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
                    <Suspense fallback={<SectionLoadingCard label={t("admin.orders.detail.timeline.title", "Order Roadmap & Lifecycle")} />}>
                        <OrderTimelineSection
                            orderId={order.id}
                            sortedHistory={sortedHistory}
                            currentStatus={order.status}
                            refunds={order.refunds || []}
                            returnRequests={order.return_requests || []}
                            onStatusUpdate={handleStatusUpdate}
                            onReturnAction={handleReturnAction}
                            onReturnItemStatus={handleReturnItemStatus}
                            onCancel={() => setCancelDialogOpen(true)}
                            isUpdating={updating}
                            isSyncing={orderFetching}
                        />
                    </Suspense>
                </div>
            )}

            {/* Dialogs */}
            <AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.orders.detail.dialogs.confirmStatus.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.orders.detail.dialogs.confirmStatus.description", { status: t(`admin.orders.status.${statusToUpdate}`, statusToUpdate || '') })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={updating} onClick={() => setUpdateNotes(undefined)}>{t("common.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault();
                                handleConfirmStatusUpdate();
                            }}
                            disabled={updating}
                        >
                            {updating ? t("common.updating") : t("common.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <OrderCancellationDialog
                isOpen={cancelDialogOpen}
                onClose={() => setCancelDialogOpen(false)}
                onConfirm={handleCancelOrder}
                isLoading={updating}
            />

            <DeliveryUnsuccessfulDialog
                isOpen={unsuccessfulDialogOpen}
                onClose={() => setUnsuccessfulDialogOpen(false)}
                onConfirm={handleUnsuccessfulDelivery}
                isLoading={updating}
            />
        </div>
    );
}
