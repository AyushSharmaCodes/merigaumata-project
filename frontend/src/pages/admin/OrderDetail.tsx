import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback, useMemo, JSXElementConstructor, Key, ReactElement, ReactNode, ReactPortal } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CONFIG } from "@/config";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { Button } from "@/components/ui/button";
import { useRenderComplexNote } from "@/lib/i18n-utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, MapPin, Phone, Mail, CreditCard, Package, Clock, Truck, User, FileText, Info, IndianRupee, RotateCcw, CheckSquare, XCircle, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { hi } from "date-fns/locale";
import { toast } from "sonner";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { getErrorMessage } from "@/lib/errorUtils";
import { CheckoutAddress, Order, Product, CartItem, OrderItem } from "@/types";
import { TaxBreakdown } from "@/components/orders/TaxBreakdown";
import { RegenerateInvoiceButton } from "@/components/orders/RegenerateInvoiceButton";

interface OrderStatusHistory {
    status: string;
    event_type?: string;
    actor?: string;
    created_at: string;
    updated_by: string;
    notes?: string;
    updater?: {
        first_name: string;
        last_name: string;
        email: string;
        role: string;
        role_data?: {
            name: string;
        };
    };
}

interface ReturnRequestItem {
    id: string;
    product_id: string;
    quantity: number;
    reason: string;
    images?: string[];
    condition?: string;
    status: 'requested' | 'approved' | 'picked_up' | 'item_returned';
    order_item_id: string;
    order_items?: {
        id: string;
        title: string;
        price_per_unit: number;
        quantity: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        variant_snapshot?: {
            size_label?: string;
            [key: string]: any;
        };
    } | Array<{
        id: string;
        title: string;
        price_per_unit: number;
        quantity: number;
        cgst?: number;
        sgst?: number;
        igst?: number;
        variant_snapshot?: {
            size_label?: string;
            [key: string]: any;
        };
    }>;
}

interface ReturnRequest {
    id: string;
    user_id: string;
    status: 'requested' | 'approved' | 'pickup_scheduled' | 'picked_up' | 'item_returned' | 'rejected' | 'cancelled' | 'completed';
    reason: string;
    refund_amount: number;
    created_at: string;
    updated_at: string;
    staff_notes?: string;
    refund_breakdown?: any;
    return_items: ReturnRequestItem[];
}

interface OrderDetailItem {
    id: string;
    product_id: string;
    quantity: number;
    price_per_unit: number;
    title: string;
    image?: string;
    product?: Product;
    variant_id?: string;
    variant?: {
        id: string;
        size_label: string;
        size_label_i18n?: Record<string, string>;
        size_value: number;
        unit: string;
        description?: string;
        description_i18n?: Record<string, string>;
        variant_image_url?: string;
        sku?: string;
    };
    variant_snapshot?: {
        variant_id?: string;
        size_label?: string;
        selling_price?: number;
        mrp?: number;
        variant_image_url?: string;
        [key: string]: any;
    };
    size_label?: string;
    hsn_code?: string;
    gst_rate?: number;
    taxable_amount?: number;
    cgst?: number;
    sgst?: number;
    igst?: number;
    delivery_charge?: number;
    delivery_gst?: number;
    delivery_calculation_snapshot?: {
        source?: string;
        delivery_refund_policy?: 'REFUNDABLE' | 'NON_REFUNDABLE' | 'PARTIAL';
        non_refundable_delivery_charge?: number;
        non_refundable_delivery_gst?: number;
        [key: string]: any;
    };
    price?: number; // fallback
}

interface OrderDetail {
    id: string;
    order_number: string;
    customer_name: string;
    customer_email: string;
    customer_phone: string;
    status: string;
    payment_status: string;
    total_amount: number;
    subtotal: number;
    coupon_discount: number;
    delivery_charge: number;
    created_at: string;
    delivery_gst?: number;
    shipping_address: CheckoutAddress;
    billing_address: CheckoutAddress;
    items: OrderDetailItem[];
    payment_id: string;
    order_status_history?: OrderStatusHistory[];
    delivery_unsuccessful_reason?: string | null;
    email_logs?: EmailLog[];
    total_taxable_amount?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    invoice_id?: string;
    invoice_url?: string;
    invoices?: Array<{
        id: string;
        type: 'RAZORPAY' | 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
        public_url?: string;
        invoice_number: string;
        status: string;
        created_at: string;
    }>;
    refunds?: Array<{
        id: string;
        razorpay_refund_id?: string;
        amount: number;
        status: string;
        notes?: string;
        created_at: string;
    }>;
}

interface EmailLog {
    id: string;
    type: string;
    recipient: string;
    status: string;
    error_message?: string;
    retry_count: number;
    created_at: string;
    event_type: string;
}

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
    pending: ['confirmed', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['packed', 'cancelled'],
    packed: ['shipped', 'cancelled'],
    // Admin must go through delivery_unsuccessful before returned when delivery fails
    shipped: ['out_for_delivery', 'delivery_unsuccessful', 'cancelled'],
    out_for_delivery: ['delivered', 'delivery_unsuccessful', 'cancelled'],
    // Once delivery_unsuccessful, admin marks returned when product arrives back
    delivery_unsuccessful: ['returned'],
    delivered: [],
    return_requested: ['return_approved', 'return_rejected'],
    return_approved: [], // auto-set by aggregateOrderState via item-level mark-returned flow
    partially_returned: [],
    returned: [],
    cancelled: ['refunded'],
    refunded: []
};


export default function OrderDetail() {
    const { t, i18n } = useTranslation();
    const { renderNote } = useRenderComplexNote();
    const { id } = useParams();
    const navigate = useNavigate();

    // Helper to translate history notes safely
    const renderHistoryNote = (note: string | null | undefined, status: string) => {
        if (!note) {
            return t("admin.orders.detail.timeline.transitionedTo", { status: t(`status.${status}`) });
        }

        // Exact matches
        const exactMatch = t(`historyNotes.${note}`, { defaultValue: '' });
        if (exactMatch) return exactMatch;

        // Dynamic matches
        if (note.startsWith("Order cancelled by administrator: ")) {
            const reason = note.replace("Order cancelled by administrator: ", "");
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {t("historyNotes.cancelledByAdmin")}: <TranslatedText text={reason} />
                </span>
            );
        }
        if (note === "Order cancelled by administrator") {
            return t("historyNotes.cancelledByAdmin", { defaultValue: note });
        }
        if (note.startsWith("common.order.cancelledByUser: ")) {
            const reason = note.replace("common.order.cancelledByUser: ", "");
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {t("historyNotes.cancelledByUser")}: <TranslatedText text={reason} />
                </span>
            );
        }
        if (note === "common.order.cancelledByUser") {
            return t("historyNotes.cancelledByUser", { defaultValue: note });
        }

        // Handle keys with dynamic suffixes (e.g., "common.order.returnRejectedNote: [reason]")
        const dynamicPrefixes = [
            "common.order.itemReturnedNote",
            "common.order.refundInitiatedNote",
            "common.order.returnPickedUpNote",
            "common.order.returnRequestedNote",
            "common.order.returnApprovedNote",
            "common.order.returnRejectedNote",
            "common.order.orderReturnedNote",
            "common.order.partiallyReturnedNote",
            "common.order.refundProcessedNote"
        ];

        for (const prefix of dynamicPrefixes) {
            if (note.startsWith(prefix)) {
                const baseMessage = t(prefix);
                const suffix = note.replace(prefix, "");

                // If suffix has a separator like ": ", we handle it specially for translation
                if (suffix.startsWith(": ")) {
                    const actualReason = suffix.replace(": ", "");
                    return (
                        <span className="inline-flex flex-wrap gap-1">
                            {baseMessage}: <TranslatedText text={actualReason} />
                        </span>
                    );
                }

                return <span>{baseMessage}{suffix}</span>;
            }
        }

        if (status === 'delivery_unsuccessful' && note) {
            // Handle delivery unsuccessful reason
            const prefixes = [
                t("admin.orders.detail.deliveryUnsuccessful.notePrefix"), // Try localized prefix first
                "Delivery unsuccessful: ",
                "डिलीवरी असफल: ",
                "டெலிவரி தோல்வியடைந்தது: ",
                "డెలివరీ విఫలమైంది: "
            ];
            let cleanReason = note;
            let matched = false;
            for (const p of prefixes) {
                if (p && cleanReason.startsWith(p)) {
                    cleanReason = cleanReason.slice(p.length).trim();
                    matched = true;
                    break;
                }
            }

            if (matched || (note && !note.includes(': '))) {
                return (
                    <span className="inline-flex flex-wrap gap-1">
                        {t("admin.orders.detail.deliveryUnsuccessful.buttonLabel") || "Delivery Unsuccessful"}: <TranslatedText text={cleanReason} />
                    </span>
                );
            }
        }

        // Fallback
        return t(note, { defaultValue: note, status: t(`status.${status}`) });
    };
    const queryClient = useQueryClient();

    // Fetch order details
    const {
        data: order,
        isLoading: loading,
        error: queryError,
        refetch: fetchOrderDetail
    } = useQuery({
        queryKey: ["admin-order", id],
        queryFn: async () => {
            const response = await apiClient.get(`/orders/${id}`);
            return response.data;
        },
        enabled: !!id,
        staleTime: 30000,
    });

    // Fetch return requests
    const {
        data: returnRequests = [],
        refetch: fetchReturns
    } = useQuery<ReturnRequest[]>({
        queryKey: ["admin-order-returns", id],
        queryFn: async () => {
            const response = await apiClient.get(`/returns/orders/${id}/all`);
            return response.data;
        },
        enabled: !!id,
        staleTime: 30000,
    });

    const error = queryError ? t("admin.orders.loadError") : null;

    const [updating, setUpdating] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
    const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
    const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
    const [deliveryUnsuccessfulDialogOpen, setDeliveryUnsuccessfulDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [cancelReason, setCancelReason] = useState("");
    const [deliveryUnsuccessfulReason, setDeliveryUnsuccessfulReason] = useState("");
    const [pendingStatus, setPendingStatus] = useState<string | null>(null);
    const [pendingReturnId, setPendingReturnId] = useState<string | null>(null);
    const [syncRefundDialogOpen, setSyncRefundDialogOpen] = useState(false);
    const [forceRefundSync, setForceRefundSync] = useState(false);

    const sortedHistory = useMemo(() => {
        if (!order) return [];
        const historyItems = [...(order.order_status_history || [])];

        // Ensure "Order Placed" exists based on order creation date
        const hasPlaced = historyItems.some(h =>
            ['pending', 'ORDER_PLACED'].includes(h.status) ||
            h.event_type === 'ORDER_PLACED'
        );

        if (!hasPlaced && order.created_at) {
            historyItems.push({
                status: 'pending',
                event_type: 'ORDER_PLACED',
                created_at: order.created_at,
                notes: t("admin.orders.detail.timeline.placedSuccess"),
                actor: t("admin.orders.detail.timeline.system"),
                updated_by: t("admin.orders.detail.timeline.system")
            } as OrderStatusHistory);
        }

        const EVENT_WEIGHTS: Record<string, number> = {
            'order_placed': 10,
            'order_confirmed': 20,
            'order_processing': 30,
            'order_packed': 40,
            'order_shipped': 50,
            'out_for_delivery': 60,
            'order_delivered': 70,
            'delivery_unsuccessful': 80,
            'return_requested': 90,
            'return_approved': 100,
            'pickup_scheduled': 110,
            'return_picked_up': 120,
            'item_returned': 130,
            'partially_returned': 135,
            'order_returned': 140,
            'refund_initiated': 150,
            'refund_partial': 160,
            'refund_completed': 170,
            'return_cancelled': 180,
            'return_rejected': 190
        };

        return historyItems
            .sort((a, b) => {
                const dateA = new Date(a.created_at).getTime();
                const dateB = new Date(b.created_at).getTime();

                if (dateA !== dateB) {
                    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                }

                const rawA = (a.event_type || a.status || 'unknown').toLowerCase();
                const rawB = (b.event_type || b.status || 'unknown').toLowerCase();
                const weightA = EVENT_WEIGHTS[rawA] || 999;
                const weightB = EVENT_WEIGHTS[rawB] || 999;
                return weightB - weightA;
            });
    }, [order, i18n.language, t]);


    const openStatusConfirmation = (newStatus: string) => {
        setPendingStatus(newStatus);
        if (newStatus === 'return_rejected') {
            setRejectionReason("");
            setRejectionDialogOpen(true);
        } else if (newStatus === 'cancelled') {
            setCancelReason("");
            setCancelDialogOpen(true);
        } else if (newStatus === 'delivery_unsuccessful') {
            setDeliveryUnsuccessfulReason("");
            setDeliveryUnsuccessfulDialogOpen(true);
        } else {
            setConfirmDialogOpen(true);
        }
    };

    const handleStatusUpdate = async () => {
        if (!pendingStatus) return;
        setConfirmDialogOpen(false);
        setCancelDialogOpen(false);
        setRejectionDialogOpen(false);

        try {
            setUpdating(true);
            setLoadingMessage(t("admin.orders.updatingStatus"));

            // SPECIAL LOGIC: Return Approval/Rejection
            // (Compatibility fallback for old single active return logic)
            const activeRet = returnRequests.find(r => r.status === 'requested' || r.status === 'pickup_scheduled' || r.status === 'picked_up');
            if ((pendingStatus === 'return_approved' || pendingStatus === 'return_rejected') && activeRet) {
                await handleReturnAction(
                    activeRet.id,
                    pendingStatus === 'return_approved' ? 'approve' : 'reject',
                    pendingStatus === 'return_rejected' ? rejectionReason : undefined
                );
                return;
            }

            const payload: Record<string, unknown> = { status: pendingStatus };
            if (pendingStatus === 'cancelled') {
                payload.notes = cancelReason.trim()
                    ? `${t("admin.orders.detail.cancellation.adminCancelledPrefix")}${cancelReason}`
                    : t("admin.orders.detail.cancellation.adminCancelledPrefix") || "Order cancelled by administrator";
            }
            if (pendingStatus === 'delivery_unsuccessful') {
                payload.notes = deliveryUnsuccessfulReason.trim()
                    ? `${t("admin.orders.detail.deliveryUnsuccessful.notePrefix")}${deliveryUnsuccessfulReason}`
                    : t("admin.orders.detail.deliveryUnsuccessful.notePrefix") || "Delivery unsuccessful: ";
            }

            const response = await apiClient.put(`/orders/${id}/status`, payload);
            fetchOrderDetail();

            if (response.data?.refundInitiated) {
                toast.success(t("admin.orders.statusUpdatedRefund", { status: t(`status.${pendingStatus}`) }), {
                    description: t("admin.orders.detail.paymentInfo.refundDescription"),
                    duration: 5000
                });
            } else {
                toast.success(t("admin.orders.statusUpdated", { status: t(`status.${pendingStatus}`) }));
            }
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, t, "admin.orders.detail.toasts.updateStatusError"));
            // Sync logic: Even on error, we try to refresh state as backend might have processed it (e.g. timeout but success)
            fetchOrderDetail();
        } finally {
            setUpdating(false);
            setPendingStatus(null);
            setRejectionReason("");
            setDeliveryUnsuccessfulReason("");
        }
    };

    const handleReturnAction = async (returnId: string, action: 'picked_up' | 'approve' | 'reject', notes?: string) => {
        if (action === 'reject' && !notes) {
            setPendingReturnId(returnId);
            setRejectionReason("");
            setRejectionDialogOpen(true);
            return;
        }

        try {
            setUpdating(true);
            const friendlyAction = action === 'approve' ? t("admin.orders.detail.actions.approving") : action === 'reject' ? t("admin.orders.detail.actions.rejecting") : t("admin.orders.detail.actions.markingPickedUp");
            setLoadingMessage(friendlyAction);

            if (action === 'picked_up') {
                await apiClient.post(`/returns/${returnId}/status`, { status: 'picked_up', notes });
                toast.success(t("admin.orders.returnPickedUp"));
            } else if (action === 'approve') {
                await apiClient.post(`/returns/${returnId}/approve`, { notes });
                toast.success(t("admin.orders.returnApproved"));
            } else if (action === 'reject') {
                await apiClient.post(`/returns/${returnId}/reject`, { reason: notes });
                toast.success(t("admin.orders.returnRejected"));
            }

            fetchOrderDetail();
            fetchReturns();
        } catch (error) {
            toast.error(getErrorMessage(error, t, "admin.orders.detail.toasts.returnActionError", { action }));
        } finally {
            setUpdating(false);
            setLoadingMessage("");
            setPendingReturnId(null);
        }
    };

    const handleReturnItemStatus = async (item: ReturnRequestItem, status: string) => {
        try {
            setUpdating(true);
            setLoadingMessage(t("admin.orders.detail.actions.markingItemReturned", { status: status.replace('_', ' ') }));

            // returnItemId is included in the body for compatibility with the compat route
            // which handles any stale clients calling /api/return-requests/item-status
            await apiClient.post(`/returns/items/${item.id}/status`, { status, returnItemId: item.id });
            toast.success(t("admin.orders.detail.toasts.itemStatusUpdated", { status: status.replace('_', ' ') }));

            fetchOrderDetail();
            fetchReturns();
        } catch (error) {
            toast.error(getErrorMessage(error, t, "admin.orders.detail.toasts.updateItemStatusError"));
        } finally {
            setUpdating(false);
            setLoadingMessage("");
        }
    };

    const handleSyncRefunds = async () => {
        try {
            setUpdating(true);
            setLoadingMessage(t("admin.orders.detail.actions.syncingRefunds", "Syncing Refunds..."));
            const response = await apiClient.post(`/orders/${id}/sync-refunds`, { force: forceRefundSync });
            toast.success(response.data.message || t("admin.orders.detail.toasts.syncRefundSuccess", "Refunds synced successfully"));
            fetchOrderDetail();
        } catch (error) {
            toast.error(getErrorMessage(error, t, "admin.orders.detail.toasts.syncRefundError"));
        } finally {
            setUpdating(false);
            setLoadingMessage("");
            setSyncRefundDialogOpen(false);
            setForceRefundSync(false);
        }
    };

    if (loading) return <LoadingOverlay isLoading={true} message={t("admin.orders.loading")} />;
    if (error) return (
        <div className="flex flex-col items-center justify-center p-8 text-center text-red-600">
            <p className="text-lg font-semibold mb-2">{t("common.error")}</p>
            <p>{error}</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/admin/orders')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> {t("admin.orders.backToOrders")}
            </Button>
        </div>
    );
    if (!order) return <LoadingOverlay isLoading={true} message={t("orderDetail.notFound")} />;

    const availableActions = ALLOWED_TRANSITIONS[order.status] || [];

    return (
        <div className="space-y-6">
            <LoadingOverlay isLoading={updating} message={loadingMessage} />

            <div className="flex items-center gap-4">
                <Button variant="outline" size="icon" onClick={() => navigate("/admin/orders")}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-3">
                        {t("orderDetail.title")} {order.order_number}
                        <Badge variant="outline" className="text-base font-normal">
                            {order.created_at ? (
                                (() => {
                                    try {
                                        return format(new Date(order.created_at), "PPP p", { locale: i18n.language === 'hi' ? hi : undefined });
                                    } catch (e) {
                                        return t("admin.orders.detail.common.invalidDate");
                                    }
                                })()
                            ) : (
                                t("admin.orders.detail.common.dateNA")
                            )}
                        </Badge>
                    </h1>
                </div>
                <div className="ml-auto flex items-center gap-3">
                    {availableActions
                        .filter(action => {
                            if (returnRequests && returnRequests.length > 0) {
                                // Always hide return approval/rejection — managed via return requests box
                                if (['return_approved', 'return_rejected', 'return_requested'].includes(action)) return false;
                                // Hide partially_returned/returned when any return request is still active
                                const hasActiveReturn = returnRequests.some(r =>
                                    ['requested', 'pickup_scheduled', 'picked_up'].includes(r.status)
                                );
                                if (hasActiveReturn && ['partially_returned', 'returned'].includes(action)) return false;
                            }
                            return true;
                        })
                        .map(action => (
                            <Button
                                key={action}
                                size="sm"
                                onClick={() => openStatusConfirmation(action)}
                                disabled={updating}
                                variant={
                                    action === 'cancelled' ? 'destructive' :
                                        action === 'delivery_unsuccessful' ? 'outline' :
                                            'default'
                                }
                                className={
                                    action === 'delivery_unsuccessful'
                                        ? 'border-amber-500 text-amber-700 hover:bg-amber-50 hover:border-amber-600'
                                        : ''
                                }
                            >
                                {action === 'delivery_unsuccessful' ? (
                                    <>
                                        <AlertTriangle className="h-3.5 w-3.5 mr-1.5" />
                                        {t("admin.orders.detail.deliveryUnsuccessful.buttonLabel")}
                                    </>
                                ) : (
                                    t("admin.orders.markAs", { status: (t(`status.${action}`) as string).toUpperCase() })
                                )}
                            </Button>
                        ))}

                    {/* Sync / Force Refund Override Button */}
                    {(order.payment_status === 'refund_initiated' || ((order.status === 'cancelled' || order.status === 'returned') && order.payment_status !== 'refunded')) && (
                        <Button
                            size="sm"
                            variant="outline"
                            className="border-indigo-300 text-indigo-700 hover:bg-indigo-50"
                            onClick={() => setSyncRefundDialogOpen(true)}
                            disabled={updating}
                        >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                            {t("admin.orders.detail.syncRefundsBtn", "Sync / Mark Refunded")}
                        </Button>
                    )}
                </div>
            </div>

            {/* Delivery Unsuccessful Banner */}
            {order.status === 'delivery_unsuccessful' && (
                <Card className="border-amber-300 bg-amber-50 shadow-sm">
                    <CardContent className="py-4 px-5">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-0.5 bg-amber-100 rounded-full p-1.5">
                                <AlertTriangle className="h-5 w-5 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-amber-900 text-sm">
                                    {t("admin.orders.detail.deliveryUnsuccessful.banner")}
                                </p>
                                <p className="text-amber-800 text-xs mt-1 leading-relaxed">
                                    {t("admin.orders.detail.deliveryUnsuccessful.bannerDesc")}
                                </p>
                                {/* Show admin's reason from dedicated column or fallback to history */}
                                {(order.delivery_unsuccessful_reason || order.order_status_history?.find((h: { status: string; notes: any; }) => h.status === 'delivery_unsuccessful' && h.notes)) && (() => {
                                    const duEntry = order.order_status_history
                                        ?.find((h: { status: string; notes: any; }) => h.status === 'delivery_unsuccessful' && h.notes);

                                    let reason = order.delivery_unsuccessful_reason;
                                    if (!reason && duEntry?.notes) {
                                        const prefix = t("admin.orders.detail.deliveryUnsuccessful.notePrefix");
                                        reason = duEntry.notes.startsWith(prefix)
                                            ? duEntry.notes.slice(prefix.length).trim()
                                            : duEntry.notes;
                                    }

                                    return reason ? (
                                        <p className="mt-2 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1 border border-amber-200">
                                            <span className="font-semibold">{t("admin.orders.detail.deliveryUnsuccessful.adminReason")}:</span>{" "}
                                            <TranslatedText text={reason} />
                                        </p>
                                    ) : null;
                                })()}
                                <p className="mt-2 text-[11px] text-amber-600 font-medium">
                                    {t("admin.orders.detail.deliveryUnsuccessful.bannerAction")}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* NEW: Comprehensive Return Management Section */}
            {returnRequests.length > 0 && (
                <Card className="bg-slate-50 border-slate-200 shadow-sm">
                    <CardHeader className="py-4 bg-white/50 border-b">
                        <CardTitle className="text-slate-800 flex items-center gap-2 text-lg">
                            <RotateCcw className="h-5 w-5 text-indigo-600" />
                            {t("admin.orders.detail.returnManagement.title", { count: returnRequests.length })}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="divide-y divide-slate-100">
                            {returnRequests.map((ret) => (
                                <div key={ret.id} className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <Badge variant={
                                                ret.status === 'approved' ? 'default' :
                                                    ret.status === 'rejected' ? 'destructive' :
                                                        ret.status === 'cancelled' ? 'secondary' :
                                                            ret.status === 'picked_up' ? 'outline' : 'secondary'
                                            } className={`capitalize ${ret.status === 'approved' ? 'bg-green-600 text-white' :
                                                ret.status === 'picked_up' ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                                    ret.status === 'rejected' ? 'bg-red-100 text-red-700 border-red-200' : ''}`}>
                                                {t(`orderStatus.${ret.status}`)}
                                            </Badge>
                                            <div className="text-xs text-muted-foreground">
                                                {t("admin.orders.detail.returnManagement.id")}: <span className="font-mono">{ret.id.split('-')[0]}</span> • {format(new Date(ret.created_at), "MMM d, h:mm a", { locale: i18n.language === 'hi' ? hi : undefined })}
                                            </div>
                                        </div>

                                        {/* Actions for Pending Transitions */}
                                        <div className="flex items-center gap-2">
                                            {ret.status === 'approved' && (
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="h-8 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                                                    onClick={() => handleReturnAction(ret.id, 'picked_up')}
                                                    disabled={updating}
                                                >
                                                    <Truck className="h-3.5 w-3.5 mr-1" /> {t("admin.orders.detail.returnManagement.markPickedUp")}
                                                </Button>
                                            )}
                                            {ret.status === 'requested' && (
                                                <>
                                                    <Button
                                                        size="sm"
                                                        className="h-8 text-xs bg-green-600 hover:bg-green-700"
                                                        onClick={() => handleReturnAction(ret.id, 'approve')}
                                                        disabled={updating}
                                                    >
                                                        <CheckSquare className="h-3.5 w-3.5 mr-1" /> {t("admin.orders.detail.returnManagement.approve")}
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        className="h-8 text-xs text-red-600 hover:bg-red-50"
                                                        onClick={() => handleReturnAction(ret.id, 'reject')}
                                                        disabled={updating}
                                                    >
                                                        <XCircle className="h-3.5 w-3.5 mr-1" /> {t("admin.orders.detail.returnManagement.reject")}
                                                    </Button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Items List for this return */}
                                    <div className="bg-white p-3 rounded border border-slate-200 space-y-3">
                                        <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider font-inter">{t("admin.orders.detail.returnManagement.requestedItems")}</p>
                                        {ret.return_items.map((item, idx) => (
                                            <div key={idx} className="flex justify-between items-start text-sm border-b last:border-0 pb-2 last:pb-0">
                                                <div>
                                                    <div className="font-medium flex items-center gap-2">
                                                        {(() => {
                                                            const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                                                            return orderItem?.title;
                                                        })()}
                                                        {(() => {
                                                            const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                                                            return orderItem?.variant_snapshot?.size_label && (
                                                                <Badge variant="secondary" className="text-[10px] h-4 font-normal">
                                                                    {orderItem.variant_snapshot.size_label}
                                                                </Badge>
                                                            );
                                                        })()}
                                                    </div>
                                                    <p className="text-[11px] text-muted-foreground italic mt-0.5">"{t("admin.orders.detail.returnManagement.reason")}: {item.reason}"</p>
                                                    {item.images && item.images.length > 0 && (
                                                        <div className="flex gap-1 mt-2">
                                                            {item.images.map((img, i) => (
                                                                <img
                                                                    key={i}
                                                                    src={img}
                                                                    className="w-10 h-10 object-cover rounded border cursor-pointer hover:opacity-80"
                                                                    onClick={() => window.open(img, '_blank')}
                                                                    alt={t("admin.orders.detail.returnManagement.returnProof") || "return proof"}
                                                                />
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <div className="text-right">
                                                        <div className="font-bold">{t("admin.orders.detail.returnManagement.qty")}: {item.quantity}</div>
                                                        <div className="text-[10px] text-muted-foreground mt-1">
                                                            ₹{(() => {
                                                                const orderItem = Array.isArray(item.order_items) ? item.order_items[0] : item.order_items;
                                                                // Calculate inclusive unit price if possible
                                                                const base = orderItem?.price_per_unit || 0;
                                                                const tax = (orderItem?.cgst || 0) + (orderItem?.sgst || 0) + (orderItem?.igst || 0);
                                                                const unitTax = tax / (orderItem?.quantity || 1);
                                                                return (base + unitTax).toFixed(2);
                                                            })()}/{t("admin.orders.detail.returnManagement.unit")} ({t("admin.orders.detail.returnManagement.inclTax")})
                                                        </div>
                                                    </div>
                                                    {ret.status === 'picked_up' && (
                                                        <div className="flex flex-col gap-1">
                                                            <Badge variant={item.status === 'item_returned' ? 'default' : 'outline'} className={item.status === 'item_returned' ? 'bg-green-600' : ''}>
                                                                {t(`orderStatus.${item.status || 'picked_up'}`)}
                                                            </Badge>
                                                            {item.status !== 'item_returned' && (
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="h-7 text-[10px] px-2 bg-indigo-600 hover:bg-indigo-700"
                                                                    onClick={() => handleReturnItemStatus(item, 'item_returned')}
                                                                    disabled={updating}
                                                                >
                                                                    {t("admin.orders.detail.returnManagement.markReturned")}
                                                                </Button>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                        <div className="pt-2 border-t border-dashed space-y-1">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-semibold">{t("admin.orders.detail.returnManagement.refundImpact")}</span>
                                                <span className="text-sm font-bold text-indigo-700">₹{ret.refund_amount.toFixed(2)}</span>
                                            </div>
                                            {ret.refund_breakdown && (
                                                <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-100 pt-1">
                                                    <div className="flex justify-between text-[10px] text-slate-500">
                                                        <span>{t("admin.orders.detail.returnManagement.productsInclTax")}:</span>
                                                        <span>₹{(ret.refund_breakdown.totalRefund || 0).toFixed(2)}</span>
                                                    </div>
                                                    {(ret.refund_breakdown.totalDeliveryRefund > 0) && (
                                                        <div className="flex justify-between text-[10px] text-indigo-600 font-medium">
                                                            <span>{t("admin.orders.detail.returnManagement.deliveryRefund")}:</span>
                                                            <span>₹{ret.refund_breakdown.totalDeliveryRefund.toFixed(2)}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {ret.staff_notes && (
                                        <p className="text-[10px] text-slate-500 italic bg-slate-100 p-2 rounded">
                                            {t("admin.orders.detail.returnManagement.adminNote")}: {ret.staff_notes}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left Column - Order Info */}
                <div className="md:col-span-2 space-y-6">
                    {/* Items */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Package className="h-5 w-5" />
                                {t("admin.orders.detail.orderItems.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-4">
                                {(() => {
                                    // Calculate Non-Refundable Total to Bundle
                                    const refundableTotal = (order.items || []).reduce((sum: number, item: OrderDetailItem) => {
                                        const snapshot = item.delivery_calculation_snapshot || {};
                                        if (snapshot.source !== 'global') {
                                            if (snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                                return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                            } else if (snapshot.delivery_refund_policy === 'PARTIAL') {
                                                const totalItemDelivery = (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                                const nonRefComponent = (snapshot.non_refundable_delivery_charge || 0) + (snapshot.non_refundable_delivery_gst || 0);
                                                return sum + (totalItemDelivery - nonRefComponent);
                                            }
                                        }
                                        return sum;
                                    }, 0);

                                    const deliveryTotal = (order.delivery_charge || 0) + (order.delivery_gst || 0);
                                    const nonRefundableTotalToBundle = Math.max(0, deliveryTotal - refundableTotal);

                                    const itemsTotalAmount = order.items.reduce((sum: number, item: any) => sum + (item.quantity * (item.price_per_unit || item.price || item.product?.price || item.variant_snapshot?.selling_price || 0)), 0);

                                    return order.items.map((item: any, index: number) => {
                                        // Get variant size label and details
                                        const lang = i18n.language;
                                        const sizeLabel = item.variant_snapshot?.size_label_i18n?.[lang] || item.variant?.size_label_i18n?.[lang] || item.variant_snapshot?.size_label || item.variant?.size_label || item.size_label;
                                        const sizeValue = item.variant_snapshot?.size_value || item.variant?.size_value;
                                        const unit = item.variant_snapshot?.unit || item.variant?.unit;
                                        const variantDesc = item.variant_snapshot?.description_i18n?.[lang] || item.variant?.description_i18n?.[lang] || item.variant_snapshot?.description || item.variant?.description;
                                        const sku = item.variant_snapshot?.sku || item.variant?.sku;

                                        // Use variant image if available, otherwise use product image
                                        const displayImage = item.variant_snapshot?.variant_image_url || item.variant?.variant_image_url || (item as any).product_variants?.variant_image_url || item.product?.images?.[0] || (item as any).products?.images?.[0];
                                        const itemTitle = item.title || item.product?.title || t("admin.orders.detail.common.product");

                                        // Bundling Logic Removed for Clarity
                                        const rawUnitPrice = item.price_per_unit || item.price || item.product?.price || item.variant_snapshot?.selling_price || 0;
                                        const bundledUnitPrice = rawUnitPrice;

                                        return (
                                            <div key={index} className="border-b pb-4 last:border-0 last:pb-0">
                                                <div className="flex gap-4 items-start">
                                                    <div className="w-16 h-16 bg-muted rounded-md overflow-hidden">
                                                        {displayImage && (
                                                            <img
                                                                src={displayImage}
                                                                alt={itemTitle}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium">{itemTitle}</h4>
                                                                {sizeLabel && (
                                                                    <Badge variant="secondary" className="text-xs font-normal">
                                                                        {sizeValue && (
                                                                            <span className="mr-1">
                                                                                {sizeValue} {unit} -
                                                                            </span>
                                                                        )}
                                                                        {sizeLabel}
                                                                    </Badge>
                                                                )}
                                                                {sku && (
                                                                    <span className="text-[10px] text-muted-foreground bg-muted px-1 rounded uppercase">
                                                                        SKU: {sku}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {variantDesc && (
                                                                <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                                    {variantDesc}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {t("admin.orders.detail.orderItems.qty")}: {item.quantity} × ₹{bundledUnitPrice.toFixed(2)}
                                                            <span className="text-xs ml-2 text-muted-foreground/80">
                                                                ({(item.product?.price_includes_tax ?? item.product?.default_price_includes_tax ?? true) ? t("admin.orders.detail.orderItems.incTax") : t("admin.orders.detail.orderItems.excTax")})
                                                            </span>
                                                        </p>
                                                        {/* Base Price Display */}
                                                        {(() => {
                                                            const gstRate = (item.gst_rate || item.product?.gstRate || item.product?.gst_rate || item.product?.default_gst_rate || 0) as any;
                                                            const baseUnitPrice = gstRate > 0 ? bundledUnitPrice / (1 + (gstRate as number) / 100) : bundledUnitPrice;
                                                            return (
                                                                <p className="text-xs text-slate-500">
                                                                    {t("admin.orders.detail.orderItems.basePrice")}: ₹{baseUnitPrice.toFixed(2)} ({t("admin.orders.detail.orderItems.excTax")})
                                                                </p>
                                                            );
                                                        })()}
                                                        {(Number(item.gst_rate) || 0) > 0 && (
                                                            <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                                                <p>{t("admin.orders.detail.orderItems.genericTax")}: {item.gst_rate}% (HSN: {item.hsn_code || 'N/A'})</p>
                                                                <div className="flex gap-2">
                                                                    {item.cgst ? <span>CGST: ₹{item.cgst}</span> : null}
                                                                    {item.sgst ? <span>SGST: ₹{item.sgst}</span> : null}
                                                                    {item.igst ? <span>IGST: ₹{item.igst}</span> : null}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                    <div className="text-right font-medium">
                                                        ₹{(item.quantity * bundledUnitPrice).toFixed(2)}
                                                    </div>
                                                </div>
                                                {item.delivery_calculation_snapshot && (
                                                    <div className="ml-20 mt-2 text-xs text-muted-foreground bg-muted/30 p-2 rounded border border-dashed border-muted-foreground/20 max-w-md">
                                                        <div className="flex items-center gap-1.5 font-medium text-[10px] uppercase tracking-wider mb-1 text-primary">
                                                            <Truck className="h-3 w-3" />
                                                            {t("admin.orders.detail.orderItems.deliveryDetails")}
                                                        </div>
                                                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                                            <p>{t("admin.orders.detail.orderItems.method")}: <span className="font-medium">{item.delivery_calculation_snapshot.calculation_type?.replace(/_/g, ' ')}</span></p>
                                                            <p>{t("admin.orders.detail.orderItems.charge")}: <span className="font-medium">₹{Number(item.delivery_calculation_snapshot.delivery_charge).toFixed(2)}</span></p>
                                                            {item.delivery_gst ? <p>{t("admin.orders.detail.orderItems.genericTax")} (18%): <span className="font-medium">₹{item.delivery_gst}</span></p> : null}
                                                            {item.delivery_calculation_snapshot.delivery_refund_policy && (
                                                                <p className={item.delivery_calculation_snapshot.delivery_refund_policy === 'NON_REFUNDABLE' ? 'text-orange-600 font-medium' : 'text-green-600 font-medium'}>
                                                                    {item.delivery_calculation_snapshot.delivery_refund_policy === 'NON_REFUNDABLE' ? t("admin.orders.detail.orderItems.nonRefundable") : t("admin.orders.detail.orderItems.refundable")}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    });
                                })()}
                            </div>

                            <Separator className="my-4" />

                            <div className="space-y-2 text-sm">
                                {(() => {
                                    const refundableTotal = (order.items || []).reduce((sum: number, item: OrderDetailItem) => {
                                        const snapshot = item.delivery_calculation_snapshot || {};
                                        if (snapshot.source !== 'global') {
                                            if (snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                                return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                            } else if (snapshot.delivery_refund_policy === 'PARTIAL') {
                                                const totalItemDelivery = (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                                const nonRefComponent = (snapshot.non_refundable_delivery_charge || 0) + (snapshot.non_refundable_delivery_gst || 0);
                                                return sum + (totalItemDelivery - nonRefComponent);
                                            }
                                        }
                                        return sum;
                                    }, 0);

                                    const itemizedDeliveryGST = (order.items || []).reduce((sum: any, item: { delivery_gst: any; }) => sum + (item.delivery_gst || 0), 0);
                                    const effectiveDeliveryGST = order.delivery_gst || itemizedDeliveryGST;
                                    const deliveryTotal = (order.delivery_charge || 0) + effectiveDeliveryGST;
                                    const nonRefundableTotal = Math.max(0, deliveryTotal - refundableTotal);

                                    return (
                                        <>
                                            <div className="flex justify-between">
                                                <span className="text-muted-foreground">{t("admin.orders.detail.orderItems.productSubtotal")}</span>
                                                <span>₹{(order.subtotal || 0).toFixed(2)}</span>
                                            </div>
                                            {order.coupon_discount > 0 && (
                                                <div className="flex justify-between text-green-600">
                                                    <span>{t("admin.orders.detail.orderItems.couponDiscount")}</span>
                                                    <span>-₹{order.coupon_discount.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {refundableTotal > 0 && (
                                                <div className="flex justify-between mt-1">
                                                    <div className="text-muted-foreground flex items-center gap-1.5 pl-2 border-l-2 border-blue-500/30">
                                                        {t("products.refundableSurcharge", "Refundable Surcharge")}
                                                    </div>
                                                    <span className="text-muted-foreground">₹{refundableTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                            {nonRefundableTotal > 0 && (
                                                <div className="flex justify-between mt-1">
                                                    <div className="text-muted-foreground flex items-center gap-1.5 pl-2 border-l-2 border-orange-500/30">
                                                        <span>{t("admin.orders.detail.orderItems.deliveryHandling", "Delivery & Handling")} <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef", "Non-Refundable")})</span></span>
                                                    </div>
                                                    <span className="text-muted-foreground">₹{nonRefundableTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </>
                                    );
                                })()}
                                <Separator className="my-2" />
                                <div className="flex justify-between font-bold text-lg">
                                    <span>{t("admin.orders.detail.orderItems.totalPayable")}</span>
                                    <span>₹{(order.total_amount || 0).toFixed(2)}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Payment Info */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <CreditCard className="h-5 w-5" />
                                {t("admin.orders.detail.paymentInfo.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground">{t("admin.orders.detail.paymentInfo.status")}</p>
                                    <Badge
                                        variant={
                                            (() => {
                                                const s = (order.payment_status || '').toLowerCase().replace('status.', '').trim().replace(/ /g, '_');
                                                return s === 'paid' ? 'default' :
                                                    s === 'refunded' ? 'destructive' :
                                                        s === 'refund_initiated' ? 'outline' :
                                                            'secondary';
                                            })()
                                        }
                                        className={`mt-1 uppercase ${(() => {
                                            const s = (order.payment_status || '').toLowerCase().replace('status.', '').trim().replace(/ /g, '_');
                                            return s === 'paid' ? 'bg-green-600 text-white' :
                                                s === 'refund_initiated' ? 'bg-blue-500 text-white' :
                                                    s === 'refunded' ? 'bg-red-500 text-white' : '';
                                        })()}`}
                                    >
                                        {(() => {
                                            const raw = order.payment_status || 'secondary';
                                            const normalized = raw.toLowerCase().replace('status.', '').trim().replace(/ /g, '_');
                                            return normalized === 'partially_refunded' ? t("admin.orders.status.partiallyRefunded") : (t(`admin.orders.status.${normalized}`, raw) as string).replace(/_/g, ' ');
                                        })()}
                                    </Badge>
                                </div>
                                <div>
                                    <p className="text-muted-foreground">{t("admin.orders.detail.paymentInfo.originalTransactionAmount")}</p>
                                    <p className="font-medium mt-1">₹{(order.total_amount || 0).toFixed(2)}</p>
                                </div>

                                {order.payment_id && (
                                    <div className="col-span-2 pt-2 border-t border-dashed mt-2">
                                        <div className="flex justify-between items-end mb-2">
                                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">{t("admin.orders.detail.paymentInfo.razorpayMetadata")}</p>
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-muted-foreground text-[11px]">{t("admin.orders.detail.paymentInfo.paymentId")}</p>
                                                <code className="bg-muted px-1 rounded text-[10px] break-all">{order.payment_id}</code>
                                            </div>
                                            {order.invoice_id && (
                                                <div>
                                                    <p className="text-muted-foreground text-[11px]">{t("admin.orders.detail.paymentInfo.invoiceId")}</p>
                                                    <code className="bg-muted px-1 rounded text-[10px] break-all">{order.invoice_id}</code>
                                                </div>
                                            )}
                                        </div>

                                        {/* Refund Metadata Display */}
                                        {(order.payment_status === 'refund_initiated' || order.payment_status === 'refunded' || order.payment_status === 'partially_refunded' || (order.refunds && order.refunds.length > 0)) && (
                                            <div className="mt-3 space-y-2">
                                                <p className="text-[10px] text-red-600 uppercase tracking-widest font-semibold">{t("admin.orders.detail.paymentInfo.refundsInformation")}</p>
                                                {order.refunds && order.refunds.length > 0 ? (
                                                    order.refunds.map((ref: { status: any; razorpay_refund_id: any; id: any; amount: any; notes: string | number | boolean | ReactElement<any, string | JSXElementConstructor<any>> | Iterable<ReactNode> | ReactPortal | Iterable<ReactNode> | null | undefined; }, idx: Key | null | undefined) => (
                                                        <div key={idx} className="grid grid-cols-2 gap-4 bg-red-50/50 p-2 rounded border border-red-100/50">
                                                            <div className="flex flex-col gap-1">
                                                                <p className="text-muted-foreground text-[11px]">{t("admin.orders.detail.paymentInfo.refundId", { status: ref.status || t("admin.orders.detail.paymentInfo.initiated") })}</p>
                                                                <div className="flex items-center gap-2">
                                                                    <code className="bg-white px-1 rounded text-[10px] break-all text-red-700 border border-red-100">{ref.razorpay_refund_id || ref.id}</code>
                                                                    <span className="text-[10px] text-muted-foreground italic">
                                                                        {t("admin.orders.detail.paymentInfo.processedNotice")}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-muted-foreground text-[11px]">{t("admin.orders.detail.paymentInfo.amount")}</p>
                                                                <span className="text-xs font-medium text-red-700">₹{(ref.amount || 0).toFixed(2)}</span>
                                                            </div>
                                                            {ref.notes && (
                                                                <div className="col-span-2">
                                                                    <p className="text-[9px] text-muted-foreground italic">{t("admin.orders.detail.paymentInfo.note")}: {renderNote(ref.notes as string)}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))
                                                ) : (
                                                    <div className="bg-amber-50 p-2 rounded border border-amber-100 text-[11px] text-amber-800">
                                                        <p className="font-medium flex items-center gap-1.5">
                                                            <Clock className="h-3 w-3" /> {t("admin.orders.detail.paymentInfo.refundStatus", { status: order.payment_status === 'refund_initiated' ? t("admin.orders.detail.paymentInfo.initiated") : t("admin.orders.detail.paymentInfo.recordPending") })}
                                                        </p>
                                                        <p className="mt-0.5 opacity-80">
                                                            {t("admin.orders.detail.paymentInfo.refundDescription")}
                                                            {order.payment_id && (
                                                                <span className="block mt-1 font-mono text-[10px5]">
                                                                    {t("admin.orders.detail.paymentInfo.paymentId")}: <strong>{order.payment_id}</strong>
                                                                </span>
                                                            )}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}

                                {order.payment_status === 'partially_refunded' && (
                                    <div className="col-span-2 p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-800 flex items-start gap-2 mt-2">
                                        <Info size={14} className="mt-0.5 shrink-0" />
                                        <p>
                                            <strong>{t("admin.orders.detail.paymentInfo.adminNote")}:</strong> {t("admin.orders.detail.paymentInfo.partiallyRefundedMessage")}
                                        </p>
                                    </div>
                                )}
                            </div>


                            {/* Dual Invoice Downloads */}
                            <div className="flex flex-col gap-2 mt-4 pt-4 border-t">
                                <p className="text-xs font-medium text-muted-foreground uppercase">{t("admin.orders.detail.paymentInfo.linkedDocuments")}</p>
                                <div className="flex gap-2 flex-wrap">
                                    {/* 1. Razorpay Receipt */}
                                    {order.invoices?.find((i: { type: string; }) => i.type === 'RAZORPAY')?.public_url ? (
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            className="h-8 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-200"
                                            onClick={() => window.open(order.invoices?.find((i: { type: string; }) => i.type === 'RAZORPAY')?.public_url, '_blank')}
                                        >
                                            <FileText className="mr-1.5 h-3 w-3" /> {t("admin.orders.detail.paymentInfo.razorpayReceipt")}
                                        </Button>
                                    ) : (
                                        order.payment_status === 'paid' && (
                                            <span className="text-xs text-muted-foreground italic">{t("admin.orders.detail.paymentInfo.receiptPending")}</span>
                                        )
                                    )}

                                    {/* 2. Tax Invoice - Only show for DELIVERED orders */}
                                    {(order.invoice_url || order.invoices?.find((i: { type: string; }) => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type))) && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={() => {
                                                const internalInv = order.invoices?.find((i: { type: string; }) => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type));

                                                let url = null;
                                                // 1. Priority: Trust the orchestrator-provided URL (handles strategy)
                                                if (order.invoice_url && !order.invoice_url.includes('razorpay')) {
                                                    url = order.invoice_url;
                                                }
                                                // 2. Fallback: Use invoices table entry (check public_url first for strategy compliance)
                                                else if (internalInv) {
                                                    url = internalInv.public_url || `/api/invoices/${internalInv.id}/download`;
                                                }

                                                if (url) {
                                                    const fullUrl = url.startsWith('http') ? url : `${CONFIG.BACKEND_URL}${url}`;
                                                    window.open(fullUrl, '_blank');
                                                } else {
                                                    toast.error(t("admin.orders.detail.paymentInfo.invoiceUnavailable", { defaultValue: "Invoice link is unavailable." }));
                                                }
                                            }}
                                        >
                                            <FileText className="mr-1.5 h-3 w-3" /> {t("admin.orders.detail.paymentInfo.invoice")}
                                        </Button>
                                    )}
                                </div>
                            </div>

                        </CardContent>
                    </Card>

                    {/* Order History Timeline */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Clock className="h-5 w-5" />
                                {t("admin.orders.detail.timeline.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-6">
                                {(() => {
                                    return sortedHistory
                                        .map((history, idx) => {
                                            let formattedDate = t("admin.orders.detail.common.dateNA");
                                            try {
                                                formattedDate = format(new Date(history.created_at), "MMM d, HH:mm", { locale: i18n.language === 'hi' ? hi : undefined });
                                            } catch (e) {
                                                formattedDate = t("admin.orders.detail.common.invalidDate");
                                            }

                                            return (
                                                <div key={idx} className="relative pl-6 pb-4 last:pb-0">
                                                    {/* Connector */}
                                                    {idx !== sortedHistory.length - 1 && (
                                                        <div className="absolute left-2.5 top-2 bottom-0 w-[1px] bg-muted" />
                                                    )}
                                                    {/* Dot */}
                                                    <div className="absolute left-0 top-1.5 w-5 h-5 rounded-full border bg-background z-10 flex items-center justify-center">
                                                        <div className={`w-2 h-2 rounded-full ${idx === 0 ? 'bg-primary' : 'bg-muted-foreground'}`} />
                                                    </div>
                                                    <div>
                                                        <div className="flex justify-between items-start">
                                                            <div className="text-sm font-semibold capitalize flex items-center gap-2">
                                                                {/* Prefer Event Type for display if set, else status */}
                                                                <span>
                                                                    {(() => {
                                                                        const raw = history.event_type || history.status || 'unknown';
                                                                        const normalized = raw.toLowerCase().replace('status.', '').trim().replace(/ /g, '_');
                                                                        return (t(`admin.orders.status.${normalized}`, raw) as string).replace(/_/g, ' ');
                                                                    })()}
                                                                </span>

                                                                {/* Show Refund Amount & ID in Tagline */}
                                                                {(() => {
                                                                    if (history.event_type !== 'REFUND_INITIATED' && history.event_type !== 'REFUND_COMPLETED' && history.event_type !== 'REFUND_PARTIAL') return null;
                                                                    if (!order.refunds || !order.refunds.length) return null;

                                                                    let matchedRefund = null;

                                                                    // Priority 1: Exact ID match in notes
                                                                    if (history.notes) {
                                                                        matchedRefund = order.refunds.find((r: any) =>
                                                                            (r.razorpay_refund_id && history.notes.includes(r.razorpay_refund_id)) ||
                                                                            (r.id && history.notes.includes(r.id))
                                                                        );
                                                                    }

                                                                    // Priority 2: Closest time match within 2 mins
                                                                    if (!matchedRefund) {
                                                                        const validRefunds = order.refunds.map((r: any) => {
                                                                            try {
                                                                                const timeDiff = Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime());
                                                                                return { r, timeDiff };
                                                                            } catch { return { r, timeDiff: Infinity }; }
                                                                        }).filter((x: any) => x.timeDiff < 120000);

                                                                        if (validRefunds.length > 0) {
                                                                            validRefunds.sort((a: any, b: any) => a.timeDiff - b.timeDiff);
                                                                            matchedRefund = validRefunds[0].r;
                                                                        }
                                                                    }

                                                                    if (!matchedRefund) return null;

                                                                    return (
                                                                        <div className="flex items-center gap-1 mt-1">
                                                                            <Badge variant="outline" className="text-[10px] h-5 font-normal border-green-200 bg-green-50 text-green-700">
                                                                                ₹{matchedRefund.amount}
                                                                            </Badge>
                                                                            {matchedRefund.razorpay_refund_id && (
                                                                                <code className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 border border-slate-200">
                                                                                    {matchedRefund.razorpay_refund_id}
                                                                                </code>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                })()}
                                                            </div>
                                                            <time className="text-[10px] text-muted-foreground">
                                                                {formattedDate}
                                                            </time>
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mt-1 bg-muted/20 p-2 rounded italic">
                                                            {/* Translate notes if it mimics a key (e.g. refund initiated note), else serve raw */}
                                                            {renderHistoryNote(history.notes, history.status)}
                                                        </p>
                                                        <p className="text-[9px] text-muted-foreground mt-1 flex items-center gap-1">
                                                            <User size={10} />
                                                            {/* Show Actor explicitly if available */}
                                                            {history.actor ? (
                                                                <span className="font-medium">{t(`admin.orders.detail.timeline.${history.actor.toLowerCase()}`, { defaultValue: history.actor })}</span>
                                                            ) : history.updater ? (
                                                                <span>{history.updater.first_name || history.updater.email} ({history.updater.role_data?.name || t("admin.orders.detail.timeline.staff")})</span>
                                                            ) : (
                                                                <span>{history.updated_by || t("admin.orders.detail.timeline.system")}</span>
                                                            )}
                                                        </p>
                                                    </div>
                                                </div>
                                            )
                                        });
                                })()}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Email History */}
                    {
                        order.email_logs && order.email_logs.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Mail className="h-5 w-5" />
                                        {t("admin.orders.detail.emailNotifications.title")}
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-4">
                                        {order.email_logs.map((email: EmailLog, index: number) => (
                                            <div key={index} className="flex gap-4 items-start border-l-2 border-muted pl-4 ml-2 pb-4 last:pb-0">
                                                <div className="flex-1">
                                                    <div className="flex items-center justify-between">
                                                        <span className="font-medium text-sm">{(t(`status.${email.event_type || 'unknown'}`) as string).replace(/_/g, ' ')}</span>
                                                        <Badge
                                                            variant={email.status === 'SENT' ? 'default' : email.status === 'FAILED' ? 'destructive' : 'secondary'}
                                                            className={`text-xs ${email.status === 'SENT' ? 'bg-green-100 text-green-800 border-green-200 hover:bg-green-100' : ''}`}
                                                        >
                                                            {email.status}
                                                        </Badge>
                                                    </div>
                                                    <div className="flex justify-between items-center mt-1">
                                                        <p className="text-xs text-muted-foreground">
                                                            {t("admin.orders.detail.emailNotifications.to")}: {email.recipient}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {(() => {
                                                                try {
                                                                    return format(new Date(email.created_at), "MMM d, h:mm a", { locale: i18n.language === 'hi' ? hi : undefined });
                                                                } catch (e) {
                                                                    return t("admin.orders.detail.common.dateNA");
                                                                }
                                                            })()}
                                                        </p>
                                                    </div>
                                                    {email.status === 'FAILED' && (
                                                        <p className="text-xs text-red-600 mt-1 font-medium bg-red-50 p-1.5 rounded border border-red-100">
                                                            {t("admin.orders.detail.emailNotifications.error")}: {email.error_message || t("admin.orders.detail.emailNotifications.unknownError")} ({t("admin.orders.detail.emailNotifications.retries")}: {email.retry_count})
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    }
                </div >

                {/* Right Column - Customer & Address */}
                < div className="space-y-6" >
                    <Card>
                        <CardHeader>
                            <CardTitle>{t("admin.orders.detail.customerDetails.title")}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <p className="font-medium">{order.customer_name}</p>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Mail className="h-4 w-4" />
                                    {order.customer_email}
                                </div>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <Phone className="h-4 w-4" />
                                    {order.customer_phone || 'N/A'}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                {t("admin.orders.detail.shippingAddress.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            {order.shipping_address ? (
                                <div className="space-y-1">
                                    <p className="font-medium"><TranslatedText text={order.shipping_address.full_name || ""} /></p>
                                    <p><TranslatedText text={order.shipping_address.address_line1 || ""} /></p>
                                    {order.shipping_address.address_line2 && <p><TranslatedText text={order.shipping_address.address_line2} /></p>}
                                    <p>
                                        {(t(`locations.${order.shipping_address.city.toLowerCase()}`, order.shipping_address.city) as string)}, {(t(`locations.${order.shipping_address.state.toLowerCase()}`, order.shipping_address.state) as string)} - {order.shipping_address.postal_code}
                                    </p>
                                    <p>{(t(`locations.${order.shipping_address.country.toLowerCase()}`, order.shipping_address.country) as string)}</p>
                                    <p className="mt-2 text-muted-foreground">{t("admin.orders.detail.shippingAddress.phone")}: {order.shipping_address.phone}</p>
                                    {order.shipping_address.alternatePhone && (
                                        <p className="text-muted-foreground">{t("admin.orders.detail.shippingAddress.altPhone")}: {order.shipping_address.alternatePhone}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">{t("admin.orders.detail.shippingAddress.notAvailable")}</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="h-5 w-5" />
                                {t("admin.orders.detail.billingAddress.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm">
                            {order.billing_address ? (
                                <div className="space-y-1">
                                    <p className="font-medium"><TranslatedText text={order.billing_address.full_name || ""} /></p>
                                    <p><TranslatedText text={order.billing_address.address_line1 || ""} /></p>
                                    {order.billing_address.address_line2 && <p><TranslatedText text={order.billing_address.address_line2} /></p>}
                                    <p>
                                        {(t(`locations.${order.billing_address.city.toLowerCase()}`, order.billing_address.city) as string)}, {(t(`locations.${order.billing_address.state.toLowerCase()}`, order.billing_address.state) as string)} - {order.billing_address.postal_code}
                                    </p>
                                    <p>{(t(`locations.${order.billing_address.country.toLowerCase()}`, order.billing_address.country) as string)}</p>
                                    <p className="mt-2 text-muted-foreground">{t("admin.orders.detail.billingAddress.phone")}: {order.billing_address.phone}</p>
                                    {order.billing_address.alternatePhone && (
                                        <p className="text-muted-foreground">{t("admin.orders.detail.billingAddress.altPhone")}: {order.billing_address.alternatePhone}</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-muted-foreground">{t("admin.orders.detail.billingAddress.sameAsShipping")}</p>
                            )}
                        </CardContent>
                    </Card>

                    <TaxBreakdown
                        totalTaxableAmount={(() => {
                            const storedSum = (order.total_taxable_amount || 0) + (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0);
                            const totalAmount = order.total_amount || 0;
                            // Reconcile if total_taxable_amount seems to exclude delivery (migration artifact)
                            const isLegacyMismatch = Math.abs(totalAmount - storedSum) > 1.0;
                            return isLegacyMismatch ? (order.total_taxable_amount || 0) + (order.delivery_charge || 0) : (order.total_taxable_amount || 0);
                        })()}
                        totalCgst={order.total_cgst}
                        totalSgst={order.total_sgst}
                        totalIgst={order.total_igst}
                        totalAmount={order.total_amount}
                        showInvoiceLink={!!order.invoice_url || !!order.invoices?.find((i: { type: string; }) => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type))}
                        invoiceUrl={(() => {
                            const internalInv = order.invoices?.find((i: { type: string; }) => ['TAX_INVOICE', 'BILL_OF_SUPPLY'].includes(i.type));
                            let url = null;
                            if (order.invoice_url && !order.invoice_url.includes('razorpay')) {
                                url = order.invoice_url;
                            } else if (internalInv) {
                                url = internalInv.public_url || `/api/invoices/${internalInv.id}/download`;
                            }
                            if (!url) return undefined;
                            return url.startsWith('http') ? url : `${CONFIG.BACKEND_URL}${url}`;
                        })()}
                        items={order.items || []}
                        deliveryCharge={order.delivery_charge || 0}
                        deliveryGST={order.delivery_gst || (order.items || []).reduce((sum: any, item: { delivery_gst: any; }) => sum + (item.delivery_gst || 0), 0)}
                        role="admin"
                    />

                    <Card>
                        <CardContent className="pt-6">
                            <RegenerateInvoiceButton
                                orderId={order.id}
                                onSuccess={fetchOrderDetail}
                                className="w-full"
                            />
                        </CardContent>
                    </Card>
                </div >
            </div >

            {/* Status Update Confirmation Dialog */}
            < AlertDialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.orders.detail.confirmStatus.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.orders.detail.confirmStatus.description", { status: t(`status.${pendingStatus || ''}`).toUpperCase() })}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setPendingStatus(null)}>
                            {t("admin.orders.dialog.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleStatusUpdate}
                            disabled={updating}
                        >
                            {updating ? t("admin.orders.detail.actions.updating") : t("admin.orders.detail.actions.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* Rejection Reason Dialog */}
            < AlertDialog open={rejectionDialogOpen} onOpenChange={setRejectionDialogOpen} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.orders.detail.rejection.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.orders.detail.rejection.description")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <textarea
                            id="rejection-reason"
                            name="rejectionReason"
                            aria-label={t("admin.orders.detail.rejection.title") || "Reason for rejection"}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={t("admin.orders.detail.rejection.description") || "Reason for rejection..."}
                            value={rejectionReason}
                            onChange={(e) => setRejectionReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setRejectionDialogOpen(false);
                            setPendingStatus(null);
                        }}>
                            {t("admin.orders.dialog.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={async () => {
                                if (pendingReturnId) {
                                    await handleReturnAction(pendingReturnId, 'reject', rejectionReason);
                                    setRejectionDialogOpen(false);
                                } else {
                                    handleStatusUpdate();
                                }
                            }}
                            disabled={!rejectionReason.trim() || updating}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {updating ? t("admin.orders.detail.actions.rejecting") : t("admin.orders.detail.actions.reject")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog >

            {/* Admin Cancellation Reason Dialog */}
            < AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen} >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("status.cancelled")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.orders.detail.cancellation.reasonLabel")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <textarea
                            id="cancellation-reason"
                            name="cancellationReason"
                            aria-label={t("admin.orders.detail.cancellation.reasonLabel")}
                            className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={t("admin.orders.detail.cancellation.reasonPlaceholder")}
                            value={cancelReason}
                            onChange={(e) => setCancelReason(e.target.value)}
                        />
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setCancelDialogOpen(false);
                            setPendingStatus(null);
                        }}>
                            {t("admin.orders.detail.actions.goBack")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleStatusUpdate}
                            disabled={updating}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            {updating ? t("admin.orders.detail.actions.cancelling") : t("admin.orders.detail.actions.cancel")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent >
            </AlertDialog >

            {/* Delivery Unsuccessful Reason Dialog */}
            <AlertDialog open={deliveryUnsuccessfulDialogOpen} onOpenChange={setDeliveryUnsuccessfulDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-amber-800">
                            <AlertTriangle className="h-5 w-5 text-amber-600" />
                            {t("admin.orders.detail.deliveryUnsuccessful.title")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.orders.detail.deliveryUnsuccessful.description")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <label
                            htmlFor="delivery-unsuccessful-reason"
                            className="text-sm font-medium text-foreground block mb-1.5"
                        >
                            {t("admin.orders.detail.deliveryUnsuccessful.reasonLabel")}
                        </label>
                        <textarea
                            id="delivery-unsuccessful-reason"
                            name="deliveryUnsuccessfulReason"
                            aria-label={t("admin.orders.detail.deliveryUnsuccessful.reasonLabel")}
                            className="flex min-h-[90px] w-full rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            placeholder={t("admin.orders.detail.deliveryUnsuccessful.reasonPlaceholder")}
                            value={deliveryUnsuccessfulReason}
                            onChange={(e) => setDeliveryUnsuccessfulReason(e.target.value)}
                        />
                        <p className="text-[11px] text-muted-foreground mt-1.5">
                            {t("admin.orders.detail.deliveryUnsuccessful.returningNote")}
                        </p>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setDeliveryUnsuccessfulDialogOpen(false);
                            setPendingStatus(null);
                        }}>
                            {t("admin.orders.detail.actions.goBack")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => {
                                setDeliveryUnsuccessfulDialogOpen(false);
                                handleStatusUpdate();
                            }}
                            disabled={updating}
                            className="bg-amber-600 hover:bg-amber-700 text-white"
                        >
                            {updating
                                ? t("admin.orders.detail.deliveryUnsuccessful.confirming")
                                : t("admin.orders.detail.deliveryUnsuccessful.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Sync Refund Dialog */}
            <AlertDialog open={syncRefundDialogOpen} onOpenChange={setSyncRefundDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2 text-indigo-800">
                            <RotateCcw className="h-5 w-5 text-indigo-600" />
                            {t("admin.orders.detail.syncRefunds.title", "Sync Refunds")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.orders.detail.syncRefunds.description", "This action retrieves the latest refund status from Razorpay. If Razorpay says it's processed, the system updates automatically.")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <div className="py-2">
                        <label className="flex items-start gap-2 p-3 bg-indigo-50/50 rounded-md border border-indigo-100 cursor-pointer">
                            <input
                                type="checkbox"
                                className="mt-1"
                                checked={forceRefundSync}
                                onChange={(e) => setForceRefundSync(e.target.checked)}
                            />
                            <div className="text-sm">
                                <span className="font-semibold text-indigo-900 block">{t("admin.orders.detail.syncRefunds.forceLabel", "Force Override (Admin Only)")}</span>
                                <span className="text-indigo-700/80">{t("admin.orders.detail.syncRefunds.forceDesc", "Check this box to manually force the status to 'Refunded' regardless of what Razorpay says. Use this only if the refund was completed outside Razorpay or Razorpay API is down.")}</span>
                            </div>
                        </label>
                    </div>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                            setSyncRefundDialogOpen(false);
                            setForceRefundSync(false);
                        }}>
                            {t("admin.orders.detail.actions.goBack", "Cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleSyncRefunds}
                            disabled={updating}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                        >
                            {updating
                                ? t("admin.orders.detail.syncRefunds.confirming", "Syncing...")
                                : forceRefundSync
                                    ? t("admin.orders.detail.syncRefunds.confirmForce", "Force Mark as Refunded")
                                    : t("admin.orders.detail.syncRefunds.confirm", "Check Razorpay Status")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div >
    );
}
