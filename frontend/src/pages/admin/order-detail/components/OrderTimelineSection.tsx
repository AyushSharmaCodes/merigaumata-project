import { memo, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { hi } from "date-fns/locale";
import { 
    Clock, 
    ArrowRight,
    Undo2,
    RefreshCcw
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
import OrderProgressFlow from "@/components/orders/OrderProgressFlow";
import { mapOrderToGraph } from "@/uiAdapters/orderFlowMapper";
import { canCancelOrder } from "@/domain/transitionGuards";

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

    // 1. Prepare Order Payload for the Responsive Flow
    const roadmapOrder = useMemo(() => ({
        status: currentStatus,
        status_history: sortedHistory
    }), [currentStatus, sortedHistory]);

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
                        {sortedHistory.length} Events Logged
                    </Badge>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {/* Visual Roadmap Section - STALELESS UI Component */}
                <div className="bg-white">
                    <OrderProgressFlow 
                        order={roadmapOrder} 
                        className="border-none rounded-none h-[500px]" 
                    />
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
                                    const matchingRefund = refunds?.find(r => r.notes?.includes(history.notes || '') || (history.status === 'refunded' && r.amount > 0));

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
                                                            {history.notes || t(`admin.orders.status.${history.status}`, history.status)}
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
                                    if (currentStatus === 'delivery_unsuccessful') return "Initiate RTO & Revert Order";
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
                                    onClick={() => onStatusUpdate('returned', 'Item returned to warehouse following delivery failure.')} 
                                    disabled={isUpdating} 
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200 gap-2"
                                >
                                    <Undo2 size={14} />
                                    Mark as Returned to Origin
                                </Button>
                            </div>
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
