import { lazy, memo, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { hi } from "date-fns/locale";
import { 
    ArrowRight,
    Undo2
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import type { OrderStatusHistory } from "@/types";

// New Decoupled Architecture
import { canCancelOrder } from "@/domain/transitionGuards";

const OrderProgressFlow = lazy(() => import("@/components/orders/OrderProgressFlow"));
const REFUND_EVENT_STATUSES = new Set(['refunded', 'partially_refunded', 'refund_initiated']);
const ROADMAP_EVENT_STATUSES = new Set([
    'pending',
    'confirmed',
    'processing',
    'packed',
    'shipped',
    'out_for_delivery',
    'delivered',
    'delivery_unsuccessful',
    'delivery_reattempt_scheduled',
    'rto_in_transit',
    'returned_to_origin',
    'cancelled_by_admin',
    'cancelled_by_customer',
    'return_requested',
    'return_approved',
    'pickup_scheduled',
    'pickup_attempted',
    'pickup_completed',
    'pickup_failed',
    'picked_up',
    'in_transit_to_warehouse',
    'qc_initiated',
    'qc_passed',
    'qc_failed',
    'returned',
    'partially_returned',
    'partial_refund',
    'zero_refund',
    'return_to_customer',
    'dispose_liquidate',
    'refund_initiated',
    'refunded',
]);

function normalizeRefundStatus(status?: string | null) {
    const normalized = String(status || '').trim().toLowerCase();
    if (['processed', 'completed', 'refunded'].includes(normalized)) return 'refunded';
    if (['refund_initiated', 'created', 'initiated', 'pending', 'processing', 'razorpay_processing'].includes(normalized)) return 'refund_initiated';
    return normalized;
}

interface OrderTimelineSectionProps {
    orderId: string;
    sortedHistory: OrderStatusHistory[];
    currentStatus: string;
    refunds?: any[];
    returnRequests?: any[];
    onStatusUpdate: (status: string, notes?: string) => Promise<void>;
    onReturnAction: (returnId: string, action: 'picked_up' | 'approve' | 'reject', notes?: string) => Promise<void>;
    onReturnItemStatus: (item: any, status: string) => Promise<void>;
    onCancel: () => void;
    isUpdating: boolean;
    isSyncing?: boolean;
}

/**
 * OrderTimelineSection (Admin)
 * Fully refactored to use decoupled domain logic and UI adapters.
 */
export const OrderTimelineSection = memo(({
    orderId,
    sortedHistory,
    currentStatus,
    refunds = [],
    returnRequests = [],
    onStatusUpdate,
    onReturnAction,
    onReturnItemStatus,
    onCancel,
    isUpdating,
    isSyncing
}: OrderTimelineSectionProps) => {
    const { t, i18n } = useTranslation();
    const roadmapRef = useRef<HTMLDivElement | null>(null);
    const [shouldRenderRoadmap, setShouldRenderRoadmap] = useState(false);

    // 1. Prepare Order Payload for the Responsive Flow
    const roadmapOrder = useMemo(() => ({
        status: currentStatus,
        order_status_history: sortedHistory,
        status_history: sortedHistory
    }), [currentStatus, sortedHistory]);

    const roadmapEventCount = useMemo(() => {
        const uniqueStatuses = new Set(
            sortedHistory
                .map((history) => String(history.status || '').trim().toLowerCase())
                .filter((status) => ROADMAP_EVENT_STATUSES.has(status))
        );

        return uniqueStatuses.size;
    }, [sortedHistory]);

    useEffect(() => {
        if (shouldRenderRoadmap) return;

        const target = roadmapRef.current;
        if (!target || typeof IntersectionObserver === "undefined") {
            setShouldRenderRoadmap(true);
            return;
        }

        const observer = new IntersectionObserver(
            (entries) => {
                if (!entries[0]?.isIntersecting) return;
                setShouldRenderRoadmap(true);
                observer.disconnect();
            },
            { rootMargin: "240px 0px" }
        );

        observer.observe(target);

        return () => observer.disconnect();
    }, [shouldRenderRoadmap]);

    // 2. Helper for actor identification in history
    const getActorBadgeColor = (role: string = '') => {
        const lowerRole = role?.toLowerCase();
        if (lowerRole.includes('admin')) return "border-red-100 bg-red-50 text-red-600";
        if (lowerRole.includes('manager')) return "border-blue-100 bg-blue-50 text-blue-600";
        if (lowerRole.includes('system')) return "border-slate-100 bg-slate-50 text-slate-500";
        return "border-emerald-100 bg-emerald-50 text-emerald-600";
    };

    return (
        <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[40px] overflow-hidden bg-white mt-8">
            {/* Header with Title and Sync Status */}
            <CardHeader className="px-10 pt-10 pb-6 flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/30">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-2 h-8 bg-indigo-500 rounded-full" />
                        {t("admin.orders.detail.timeline.title", "Order Roadmap & Lifecycle")}
                    </CardTitle>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-5">
                        {t("admin.orders.detail.timeline.subtitle", "Tracking Physical Movement & Milestones")}
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <Badge variant="outline" className="px-4 py-1.5 rounded-full border-slate-200 text-slate-500 font-bold text-[10px] uppercase tracking-widest bg-white shadow-sm">
                        {roadmapEventCount} Events Logged
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {/* Visual Roadmap Section - STALELESS UI Component */}
                <div ref={roadmapRef} className="bg-white">
                    {shouldRenderRoadmap ? (
                        <Suspense
                            fallback={
                                <div className="flex h-[500px] items-center justify-center bg-gradient-to-br from-slate-50 to-white">
                                    <div className="flex flex-col items-center gap-3 rounded-[28px] border border-slate-100 bg-white px-8 py-6 shadow-sm">
                                        <div className="h-10 w-10 animate-pulse rounded-full bg-indigo-100" />
                                        <div className="text-center">
                                            <p className="text-sm font-bold text-slate-700">
                                                {t("admin.orders.detail.timeline.loadingRoadmap", "Preparing visual roadmap")}
                                            </p>
                                            <p className="text-xs text-slate-400">
                                                {t("admin.orders.detail.timeline.loadingRoadmapHint", "Loading the detailed flow only when needed")}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            }
                        >
                            <OrderProgressFlow
                                order={roadmapOrder}
                                className="border-none rounded-none"
                            />
                        </Suspense>
                    ) : (
                        <div className="flex h-[500px] items-center justify-center bg-gradient-to-br from-slate-50 to-white">
                            <div className="max-w-sm rounded-[28px] border border-slate-100 bg-white px-8 py-6 text-center shadow-sm">
                                <p className="text-sm font-bold text-slate-700">
                                    {t("admin.orders.detail.timeline.roadmapDeferred", "Visual roadmap will load when this section comes into view")}
                                </p>
                                <p className="mt-2 text-xs text-slate-400">
                                    {t("admin.orders.detail.timeline.roadmapDeferredHint", "This keeps order detail snappier while the event timeline is available immediately")}
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Event History Table */}
                <div className="bg-slate-50/20">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-transparent border-slate-50 bg-slate-50/40">
                                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4 pl-10 w-[20%]">
                                    {t("admin.orders.detail.timeline.timestamp", "Timestamp")}
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4 w-[60%]">
                                    {t("admin.orders.detail.timeline.event", "Event Description")}
                                </TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-wider text-slate-400 py-4 pr-10 text-right w-[20%]">
                                    {t("admin.orders.detail.timeline.actor", "Actor")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {sortedHistory.length > 0 ? (
                                sortedHistory.map((history, idx) => {
                                    let formattedDate = "";
                                    let dateSubtext = "";
                                    try {
                                        const dateObj = new Date(history.created_at);
                                        formattedDate = format(dateObj, "MMM d, yyyy", { locale: i18n.language === 'hi' ? hi : undefined });
                                        dateSubtext = format(dateObj, "hh:mm a");
                                    } catch (e) {
                                        formattedDate = "Invalid Date";
                                    }

                                    const role = history.updater?.role_data?.name || history.updater?.role || history.actor || "System";
                                    // Identify refund related events to show monetary badges
                                    const matchingRefund = refunds?.find(r =>
                                        r.notes?.includes(history.notes || '') ||
                                        (REFUND_EVENT_STATUSES.has(normalizeRefundStatus(history.status)) && Number(r.amount || 0) > 0)
                                    );

                                    return (
                                        <TableRow key={idx} className="border-slate-50 group hover:bg-white transition-colors">
                                            <TableCell className="py-5 pl-10 align-top">
                                                <div className="flex flex-col gap-0.5">
                                                    <span className="text-[11px] font-bold text-slate-700">{formattedDate}</span>
                                                    <span className="text-[10px] text-slate-400 font-medium">{dateSubtext}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 align-top">
                                                <div className="flex flex-col gap-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-[11px] font-semibold text-slate-600 leading-relaxed">
                                                            {history.notes?.includes('.') ? t(history.notes, history.notes) : (history.notes || t(`admin.orders.status.${history.status}`, history.status))}
                                                        </p>
                                                        {matchingRefund && (
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[9px] font-black text-indigo-600 uppercase">
                                                                ₹{matchingRefund.amount} • {matchingRefund.razorpay_refund_id || matchingRefund.id}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell className="py-5 pr-10 align-top text-right">
                                                <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 border ${getActorBadgeColor(role)}`}>
                                                    {role}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })
                            ) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="py-12 text-center text-slate-400 italic text-xs">
                                        No event history found for this order.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Interaction Footer - Transition Recommendations & Action Buttons */}
                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recommended Transition</span>
                        <div className="flex items-center gap-2">
                            <ArrowRight size={14} className="text-emerald-500" />
                            <span className="text-xs font-bold text-slate-700 uppercase tracking-tighter">
                                {(() => {
                                    if (currentStatus === 'pending') return "Confirm Customer Order";
                                    if (currentStatus === 'confirmed') return "Start Warehouse Processing";
                                    if (currentStatus === 'processing') return "Pack Order Items";
                                    if (currentStatus === 'packed') return "Generate Shipping Labels";
                                    if (currentStatus === 'shipped') return "Track Out For Delivery";
                                    if (currentStatus === 'out_for_delivery') return "Confirm Delivery Receipt";
                                    if (currentStatus === 'delivery_unsuccessful') return "Choose Reattempt or Start RTO";
                                    if (currentStatus === 'delivery_reattempt_scheduled') return "Dispatch Reattempt Delivery";
                                    if (currentStatus === 'rto_in_transit') return "Confirm Return to Origin";
                                    return "Lifecycle Progressing...";
                                })()}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {/* Standard Transition Actions */}
                        {currentStatus === 'pending' && (
                            <Button onClick={() => onStatusUpdate('confirmed')} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-emerald-200/50">
                                Confirm Order
                            </Button>
                        )}
                        {currentStatus === 'confirmed' && (
                            <Button onClick={() => onStatusUpdate('processing')} disabled={isUpdating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200/50">
                                Start Processing
                            </Button>
                        )}
                        {currentStatus === 'processing' && (
                            <Button onClick={() => onStatusUpdate('packed')} disabled={isUpdating} className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-amber-200/50">
                                Mark as Packed
                            </Button>
                        )}
                        {currentStatus === 'packed' && (
                            <Button onClick={() => onStatusUpdate('shipped')} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-blue-200/50">
                                Mark as Shipped
                            </Button>
                        )}

                        {/* Return & Failure Specialized Actions */}
                        {currentStatus === 'shipped' && (
                            <Button onClick={() => onStatusUpdate('out_for_delivery')} disabled={isUpdating} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200/50">
                                Out for Delivery
                            </Button>
                        )}
                        {currentStatus === 'out_for_delivery' && (
                            <Button onClick={() => onStatusUpdate('delivered')} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-emerald-200/50">
                                Confirm Delivery
                            </Button>
                        )}
                        
                        {(currentStatus === 'shipped' || currentStatus === 'out_for_delivery') && (
                            <Button onClick={() => onStatusUpdate('delivery_unsuccessful')} variant="outline" disabled={isUpdating} className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs h-10 px-6 rounded-xl">
                                Delivery Unsuccessful
                            </Button>
                        )}

                        {currentStatus === 'delivery_unsuccessful' && (
                            <div className="flex gap-2">
                                <Button 
                                    onClick={() => onStatusUpdate('delivery_reattempt_scheduled', 'Reattempt delivery scheduled after unsuccessful delivery attempt.')} 
                                    disabled={isUpdating} 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200 gap-2"
                                >
                                    Schedule Reattempt
                                </Button>
                                <Button 
                                    onClick={() => onStatusUpdate('rto_in_transit', 'Order moved into return-to-origin transit after unsuccessful delivery attempts.')} 
                                    disabled={isUpdating} 
                                    className="bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-violet-200 gap-2"
                                >
                                    <Undo2 size={14} />
                                    Start RTO
                                </Button>
                            </div>
                        )}

                        {currentStatus === 'delivery_reattempt_scheduled' && (
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => onStatusUpdate('out_for_delivery', 'Reattempt delivery is now out for delivery.')}
                                    disabled={isUpdating}
                                    className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200/50"
                                >
                                    Out for Delivery Again
                                </Button>
                                <Button
                                    onClick={() => onStatusUpdate('rto_in_transit', 'Order moved into return-to-origin transit after reattempt could not be completed.')}
                                    disabled={isUpdating}
                                    variant="outline"
                                    className="border-violet-200 text-violet-700 hover:bg-violet-50 font-bold text-xs h-10 px-6 rounded-xl"
                                >
                                    Convert to RTO
                                </Button>
                            </div>
                        )}

                        {currentStatus === 'rto_in_transit' && (
                            <Button 
                                onClick={() => onStatusUpdate('returned_to_origin', 'Order has been returned to origin after unsuccessful delivery attempts.')} 
                                disabled={isUpdating} 
                                className="bg-violet-700 hover:bg-violet-800 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-violet-200 gap-2"
                            >
                                <Undo2 size={14} />
                                Mark Returned to Origin
                            </Button>
                        )}

                        {/* Cancellation Guarded Action */}
                        {canCancelOrder(currentStatus) && (
                            <Button 
                                variant="outline" 
                                onClick={onCancel} 
                                disabled={isUpdating} 
                                className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs h-10 px-6 rounded-xl"
                            >
                                Cancel Order
                            </Button>
                        )}

                        {/* Return Request Management */}
                        {(() => {
                            const activeRequest = returnRequests.find((r: any) => r.status === 'requested');
                            if (activeRequest) {
                                return (
                                    <div className="flex items-center gap-2">
                                        <Button onClick={() => onReturnAction(activeRequest.id, 'approve')} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-10 px-5 rounded-xl shadow-lg shadow-emerald-200/50">
                                            Approve Return
                                        </Button>
                                        <Button variant="ghost" onClick={() => onReturnAction(activeRequest.id, 'reject')} disabled={isUpdating} className="text-red-600 hover:bg-red-50 font-bold text-xs h-10 px-5 rounded-xl">
                                            Reject
                                        </Button>
                                    </div>
                                );
                            }

                            const pickupRequest = returnRequests.find((r: any) => r.status === 'approved' || r.status === 'pickup_scheduled');
                            if (pickupRequest) {
                                return (
                                    <Button onClick={() => onReturnAction(pickupRequest.id, 'picked_up')} disabled={isUpdating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200/50">
                                        Confirm Picked Up
                                    </Button>
                                );
                            }

                            return null;
                        })()}
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

OrderTimelineSection.displayName = "OrderTimelineSection";
