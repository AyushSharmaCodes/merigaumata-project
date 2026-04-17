import { memo, useMemo, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import { hi } from "date-fns/locale";
import { 
    Clock, 
    CheckCircle2, 
    Package, 
    Truck, 
    ShoppingBag, 
    ClipboardCheck,
    Container,
    RefreshCcw,
    Undo2,
    AlertCircle,
    XCircle,
    ArrowRight
} from "lucide-react";
import { 
    ReactFlow, 
    Handle, 
    Position, 
    Edge, 
    Node, 
    ConnectionLineType,
    MarkerType,
    BaseEdge,
    getSmoothStepPath,
    EdgeProps
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

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

interface OrderTimelineSectionProps {
    orderId: string;
    sortedHistory: OrderStatusHistory[];
    currentStatus: string;
    refunds?: any[];
    returnRequests?: any[];
    onStatusUpdate: (status: string, notes?: string) => Promise<void>;
    onReturnAction: (returnId: string, action: 'picked_up' | 'approve' | 'reject', notes?: string) => Promise<void>;
    onReturnItemStatus: (item: any, status: string) => Promise<void>;
    isUpdating: boolean;
}

const CORE_FLOW_KEYS = ["pending", "confirmed", "processing", "packed"];

const STATUS_ICONS: Record<string, any> = {
    pending: ShoppingBag,
    confirmed: CheckCircle2,
    processing: ClipboardCheck,
    packed: Package,
    shipped: Truck,
    out_for_delivery: Container,
    delivered: CheckCircle2,
    delivery_unsuccessful: AlertCircle,
    return_requested: Undo2,
    return_approved: ClipboardCheck,
    return_picked_up: Package,
    returned: Undo2,
    return_rejected: XCircle,
    cancelled: XCircle,
    refund_initiated: RefreshCcw
};

const STATUS_LABELS: Record<string, string> = {
    pending: "Order Placed",
    confirmed: "Confirmed",
    processing: "Processing",
    packed: "Packed",
    shipped: "Shipped",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    delivery_unsuccessful: "Unsuccessful",
    return_requested: "Return Requested",
    return_approved: "Approved",
    return_picked_up: "Picked Up",
    returned: "Returned",
    return_rejected: "Rejected",
    cancelled: "Cancelled",
    refund_initiated: "Refunded"
};

// --- REACT FLOW CUSTOM COMPONENTS ---

// --- REACT FLOW CUSTOM COMPONENTS ---

const CustomRoadmapNode = memo(({ data }: any) => {
    const { t } = useTranslation();
    const Icon = data.icon;
    const { isCompleted, isCurrent, label, date, key } = data;

    return (
        <div className="flex flex-col items-center w-28 relative group">
            <div className="relative z-10 w-16 h-16 flex items-center justify-center">
                <Handle 
                    type="target" 
                    position={data.targetPosition || Position.Left} 
                    style={{ background: 'transparent', border: 'none', top: '50%', transform: 'translateY(-50%)' }} 
                />
                
                <motion.div 
                    initial={false}
                    animate={{ 
                        backgroundColor: isCompleted ? "#10b981" : "#ffffff",
                        borderColor: isCompleted ? "#10b981" : "#e2e8f0",
                        color: isCompleted ? "#ffffff" : "#475569",
                        scale: isCurrent ? 1.15 : 1
                    }}
                    transition={{ duration: 0.5, ease: "circOut" }}
                    className={`
                        w-full h-full rounded-full flex items-center justify-center border-2 border-slate-200 
                        shadow-md transition-shadow duration-500
                        ${isCurrent ? "ring-4 ring-emerald-100 shadow-xl shadow-emerald-200/50" : ""}
                    `}
                >
                    <Icon size={26} />
                    
                    <AnimatePresence>
                        {isCurrent && (
                            <motion.div 
                                className="absolute -inset-2.5 rounded-full bg-emerald-500/10 pointer-events-none -z-0"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.35, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2.5, repeatType: "reverse", ease: "easeInOut" }}
                            />
                        )}
                    </AnimatePresence>
                </motion.div>

                <Handle 
                    type="source" 
                    position={data.sourcePosition || Position.Right} 
                    style={{ background: 'transparent', border: 'none', top: '50%', transform: 'translateY(-50%)' }} 
                />
            </div>

            <div className="mt-5 flex flex-col items-center text-center gap-2 px-1 min-h-[56px]">
                <span className={`text-[12px] font-black uppercase tracking-[0.1em] leading-tight transition-colors duration-500 ${isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                    {t(`admin.orders.status.${key}`, label) as string}
                </span>
                
                <AnimatePresence mode="popLayout">
                    {date && (
                        <motion.span 
                            key={date}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="text-[11px] font-bold text-slate-500 leading-none whitespace-nowrap"
                        >
                            {date}
                        </motion.span>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
});

const CustomEdge = memo(({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    style = {},
    markerEnd,
    data
}: EdgeProps) => {
    // Determine edge type based on direction
    const isStep = sourceX !== targetX && sourceY !== targetY;

    const [edgePath] = getSmoothStepPath({
        sourceX,
        sourceY,
        sourcePosition,
        targetX,
        targetY,
        targetPosition,
        borderRadius: isStep ? 30 : 0 
    });

    return (
        <BaseEdge 
            path={edgePath} 
            markerEnd={markerEnd} 
            style={{
                ...style,
                strokeWidth: 2,
                stroke: data?.isCompleted ? '#10b981' : '#e2e8f0',
                transition: 'stroke 0.5s ease'
            }} 
        />
    );
});

export const OrderTimelineSection = memo(({
    orderId,
    sortedHistory,
    currentStatus,
    refunds = [],
    returnRequests = [],
    onStatusUpdate,
    onReturnAction,
    onReturnItemStatus,
    isUpdating
}: OrderTimelineSectionProps) => {
    const { t, i18n } = useTranslation();

    const nodeTypes = useMemo(() => ({ roadmap: CustomRoadmapNode }), []);
    const edgeTypes = useMemo(() => ({ roadmap: CustomEdge }), []);

    // 1. Generate Dynamic Status Flow
    const STATUS_FLOW = useMemo(() => {
        const historyStatuses = sortedHistory.flatMap(h => [h.status?.toLowerCase(), h.event_type?.toLowerCase()]).filter(Boolean) as string[];
        const lowerCurrent = currentStatus?.toLowerCase() || '';
        const flowKeys = [...CORE_FLOW_KEYS];
        const SUCCESS_PATH = ["shipped", "out_for_delivery", "delivered"];
        const RETURN_PATH = ["return_requested", "return_approved", "return_picked_up", "returned", "refund_initiated", "return_rejected"];
        
        SUCCESS_PATH.forEach(key => {
            if (historyStatuses.includes(key) || lowerCurrent === key) {
                if (!flowKeys.includes(key)) flowKeys.push(key);
            }
        });

        if (!flowKeys.includes(lowerCurrent) && !RETURN_PATH.includes(lowerCurrent) && lowerCurrent !== "") {
            flowKeys.push(lowerCurrent);
        }

        const logisticsStarted = flowKeys.some(k => ["shipped", "out_for_delivery"].includes(k));
        if (logisticsStarted && !flowKeys.includes('delivered')) {
            flowKeys.push('delivered');
        }

        const returnStarted = historyStatuses.some(h => RETURN_PATH.includes(h)) || RETURN_PATH.includes(lowerCurrent) || returnRequests.length > 0;
        if (returnStarted) {
            RETURN_PATH.forEach(key => {
                if (historyStatuses.includes(key) || lowerCurrent === key) {
                    if (!flowKeys.includes(key)) flowKeys.push(key);
                } else if (key === 'return_requested' && returnRequests.some(r => r.status === 'requested')) {
                     if (!flowKeys.includes(key)) flowKeys.push(key);
                } else if (key === 'return_approved' && returnRequests.some(r => r.status === 'approved' || r.status === 'pickup_scheduled')) {
                     if (!flowKeys.includes(key)) flowKeys.push(key);
                } else if (key === 'return_picked_up' && returnRequests.some(r => r.status === 'picked_up')) {
                     if (!flowKeys.includes(key)) flowKeys.push(key);
                } else if (key === 'return_rejected' && returnRequests.some(r => r.status === 'rejected')) {
                     if (!flowKeys.includes(key)) flowKeys.push(key);
                }
            });
            if (!flowKeys.some(k => RETURN_PATH.includes(k))) {
                flowKeys.push('return_requested');
            }
        }

        return flowKeys.map(key => ({
            key,
            icon: STATUS_ICONS[key] || Clock,
            label: STATUS_LABELS[key] || key
        }));
    }, [sortedHistory, currentStatus, returnRequests]);

    const normalizeStatus = (status: string) => {
        if (!status) return '';
        const s = status.toLowerCase();
        if (s === 'partially_returned') return 'returned';
        if (s === 'partially_refunded') return 'refund_initiated';
        if (s === 'item_pickup') return 'return_picked_up';
        return s;
    };

    const currentStepIndex = useMemo(() => {
        let maxIndex = 0;
        const lowerCurrent = normalizeStatus(currentStatus);
        const historyStatuses = sortedHistory.flatMap(h => [normalizeStatus(h.status), normalizeStatus(h.event_type || '')]).filter(Boolean);
        
        STATUS_FLOW.forEach((step, idx) => {
            let isReached = false;
            if (lowerCurrent === step.key) isReached = true;
            if (historyStatuses.includes(step.key)) isReached = true;
            if (step.key === 'return_requested' && returnRequests.some(r => r.status === 'requested')) isReached = true;
            if (step.key === 'return_approved' && returnRequests.some(r => r.status === 'approved' || r.status === 'pickup_scheduled')) isReached = true;
            if (step.key === 'return_picked_up' && returnRequests.some(r => r.status === 'picked_up')) isReached = true;
            if (step.key === 'returned' && returnRequests.some(r => r.status === 'item_returned' || r.status === 'partially_returned')) isReached = true;
            if (step.key === 'refund_initiated' && returnRequests.some(r => r.status === 'partially_refunded')) isReached = true;
            if (step.key === 'return_rejected' && returnRequests.some(r => r.status === 'rejected')) isReached = true;
            if (isReached) maxIndex = Math.max(maxIndex, idx);
        });
        return maxIndex;
    }, [STATUS_FLOW, sortedHistory, currentStatus, returnRequests]);

    const stepDates = useMemo(() => {
        const dates: Record<string, string> = {};
        [...sortedHistory].reverse().forEach(h => {
             const status = h.status.toLowerCase();
             try {
                 dates[status] = format(new Date(h.created_at), "MMM d, hh:mm a");
             } catch (e) {
                 dates[status] = "";
             }
        });
        return dates;
    }, [sortedHistory]);

    // React Flow Node & Edge Generation
    const { nodes, edges, hasRow2 } = useMemo(() => {
        const deliveredIdx = STATUS_FLOW.findIndex(s => s.key === 'delivered');
        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];
        const xOffset = 180; 
        const rowHeight = 130;  // Reduced from 160 to save vertical space
        STATUS_FLOW.forEach((step, idx) => {
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            
            let x = 0;
            let y = 0;
            let sourcePosition = Position.Right;
            let targetPosition = Position.Left;

            if (deliveredIdx === -1 || idx <= deliveredIdx) {
                // Row 1: x starts at 0, ends at deliveredIdx * xOffset
                x = idx * xOffset;
                y = 0;
                if (idx === deliveredIdx && deliveredIdx < STATUS_FLOW.length - 1) {
                    sourcePosition = Position.Bottom;
                }
            } else {
                // Row 2: snake right-to-left
                const row2Idx = idx - (deliveredIdx + 1);
                x = (deliveredIdx - row2Idx) * xOffset;
                y = rowHeight;
                targetPosition = row2Idx === 0 ? Position.Top : Position.Right;
                sourcePosition = Position.Left;
            }

            flowNodes.push({
                id: step.key,
                type: 'roadmap',
                position: { x, y },
                data: {
                    ...step,
                    isCompleted,
                    isCurrent,
                    date: stepDates[step.key],
                    sourcePosition,
                    targetPosition
                },
                draggable: false,
            });

            if (idx > 0) {
                const prevStep = STATUS_FLOW[idx - 1];
                const isEdgeCompleted = (idx <= currentStepIndex);

                flowEdges.push({
                    id: `edge-${prevStep.key}-${step.key}`,
                    source: prevStep.key,
                    target: step.key,
                    type: 'roadmap',
                    data: { isCompleted: isEdgeCompleted },
                });
            }
        });

        // Shift all nodes to be centered around x=0 for better fitView symmetry
        const totalWidth = (deliveredIdx === -1 ? STATUS_FLOW.length - 1 : deliveredIdx) * xOffset;
        const xShift = -totalWidth / 2;
        flowNodes.forEach(n => { n.position.x += xShift; });

        return { nodes: flowNodes, edges: flowEdges, hasRow2: deliveredIdx !== -1 && deliveredIdx < STATUS_FLOW.length - 1 };
    }, [STATUS_FLOW, currentStepIndex, stepDates]);

    const getActorBadgeColor = (role: string = '') => {
        const r = role.toLowerCase();
        if (r === 'system') return 'bg-purple-50 text-purple-600 border-purple-100';
        if (r === 'admin' || r === 'manager') return 'bg-blue-50 text-blue-600 border-blue-100';
        if (r.includes('logistics') || r.includes('warehouse')) return 'bg-indigo-50 text-indigo-600 border-indigo-100';
        return 'bg-slate-50 text-slate-600 border-slate-100';
    };

    return (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-white border-b border-slate-50 py-5 flex-row items-center justify-between space-y-0">
                <CardTitle className="text-xs font-black flex items-center gap-2.5 text-slate-700 uppercase tracking-[0.15em]">
                    <Clock className="h-4 w-4 text-primary" />
                    {t("admin.orders.detail.timeline.unifiedTitle", "Order Tracking History")}
                </CardTitle>
                <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 rounded-full border border-emerald-100/50">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] font-black text-emerald-600 uppercase tracking-wider">Real-Time Sync</span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="py-2 px-4 border-b border-slate-50 bg-white relative">
                    <div className="w-full transition-all duration-500 flex justify-center" style={{ height: hasRow2 ? '340px' : '180px' }}>
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}
                            fitView
                            fitViewOptions={{ padding: 0.05, includeHiddenNodes: false }}
                            panOnDrag={false}
                            zoomOnScroll={false}
                            zoomOnPinch={false}
                            zoomOnDoubleClick={false}
                            nodesDraggable={false}
                            nodesConnectable={false}
                            elementsSelectable={false}
                            proOptions={{ hideAttribution: true }}
                        />
                    </div>
                </div>

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
                                    const refundEvent = history.status === 'ITEM_RETURNED' || history.event_type?.includes('REFUND');
                                    const matchingRefund = refundEvent ? refunds?.find(r => r.notes?.includes(history.notes || '') || r.amount > 0) : null;

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
                                                            {history.notes || t("admin.orders.detail.timeline.transitionedTo", { status: t(`admin.orders.status.${history.status}`, history.status) })}
                                                        </p>
                                                        {matchingRefund && (
                                                            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-indigo-50 border border-indigo-100 rounded text-[9px] font-black text-indigo-600 uppercase">
                                                                <RefreshCcw size={10} />
                                                                ₹{matchingRefund.amount} • {matchingRefund.razorpay_refund_id || matchingRefund.id}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {history.event_type && (
                                                        <div className="flex items-center gap-1.5">
                                                            <div className="w-1 h-1 rounded-full bg-slate-300" />
                                                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{history.event_type}</span>
                                                        </div>
                                                    )}
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

                <div className="p-8 bg-slate-50/50 border-t border-slate-100 flex flex-col md:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Recommended Next Step</span>
                        <div className="flex items-center gap-2">
                            <ArrowRight size={14} className="text-emerald-500" />
                            <span className="text-xs font-bold text-slate-700">
                                {(() => {
                                    const activeReturn = returnRequests.find((r: any) => r.status === 'requested');
                                    if (activeReturn) return "Review and Approve Return Request";
                                    
                                    const pickupReturn = returnRequests.find((r: any) => r.status === 'approved');
                                    if (pickupReturn) return "Confirm Item Pickup from Customer";

                                    switch (currentStatus) {
                                        case 'pending': return "Confirm Customer Order";
                                        case 'confirmed': return "Allocate Inventory & Start Processing";
                                        case 'processing': return "Pack Order Items";
                                        case 'packed': return "Generate Shipping Labels";
                                        case 'shipped': return "Handover to Logistics / Out for Delivery";
                                        case 'out_for_delivery': return "Confirm Customer Delivery Receipt";
                                        case 'delivered': return "Fulfillment Cycle Complete";
                                        case 'delivery_unsuccessful': return "Initiate Return to Origin (RTO) & Auto-Refund";
                                        case 'returned': return "Product Reverted to Inventory";
                                        case 'cancelled': return "Order Lifecycle Terminated";
                                        default: return "Monitor Order Progress";
                                    }
                                })()}
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        {currentStatus === 'pending' && (
                            <Button onClick={() => onStatusUpdate('confirmed')} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-emerald-200">
                                Confirm Order
                            </Button>
                        )}
                        {currentStatus === 'confirmed' && (
                            <Button onClick={() => onStatusUpdate('processing')} disabled={isUpdating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200">
                                Start Processing
                            </Button>
                        )}
                        {currentStatus === 'processing' && (
                            <Button onClick={() => onStatusUpdate('packed')} disabled={isUpdating} className="bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-amber-200">
                                Mark as Packed
                            </Button>
                        )}
                        {currentStatus === 'packed' && (
                            <Button onClick={() => onStatusUpdate('shipped')} disabled={isUpdating} className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-blue-200">
                                Mark as Shipped
                            </Button>
                        )}
                        {currentStatus === 'shipped' && (
                            <>
                                <Button onClick={() => onStatusUpdate('out_for_delivery')} disabled={isUpdating} className="bg-indigo-500 hover:bg-indigo-600 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200">
                                    Out for Delivery
                                </Button>
                                <Button variant="outline" onClick={() => onStatusUpdate('delivery_unsuccessful')} disabled={isUpdating} className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs h-10 px-6 rounded-xl">
                                    Delivery Unsuccessful
                                </Button>
                            </>
                        )}
                        {currentStatus === 'out_for_delivery' && (
                            <div className="flex gap-2">
                                <Button onClick={() => onStatusUpdate('delivered')} disabled={isUpdating} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-emerald-200">
                                    Confirm Delivery
                                </Button>
                                <Button onClick={() => onStatusUpdate('delivery_unsuccessful')} variant="outline" disabled={isUpdating} className="border-red-200 text-red-600 hover:bg-red-50 font-bold text-xs h-10 px-6 rounded-xl">
                                    Delivery Unsuccessful
                                </Button>
                            </div>
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
                                <Button 
                                    onClick={() => {
                                        const previousState = sortedHistory.find(h => h.status !== 'delivery_unsuccessful')?.status || 'out_for_delivery';
                                        onStatusUpdate(previousState, `Delivery re-attempt initiated. Reverting to ${previousState}.`);
                                    }} 
                                    variant="outline" 
                                    disabled={isUpdating} 
                                    className="border-slate-200 text-slate-600 hover:bg-slate-50 font-bold text-xs h-10 px-6 rounded-xl shadow-sm"
                                >
                                    Re-attempt Delivery
                                </Button>
                            </div>
                        )}

                        {(() => {
                            const activeReturn = returnRequests.find((r: any) => r.status === 'requested');
                            if (activeReturn) {
                                return (
                                    <div className="flex items-center gap-2">
                                        <Button onClick={() => onReturnAction(activeReturn.id, 'approve')} disabled={isUpdating} className="bg-green-600 hover:bg-green-700 text-white font-bold text-xs h-10 px-5 rounded-xl">
                                            Approve Return
                                        </Button>
                                        <Button variant="ghost" onClick={() => onReturnAction(activeReturn.id, 'reject')} disabled={isUpdating} className="text-red-600 hover:bg-red-50 font-bold text-xs h-10 px-5 rounded-xl">
                                            Reject
                                        </Button>
                                    </div>
                                );
                            }
                            
                            const pickupReturn = returnRequests.find((r: any) => r.status === 'approved');
                            if (pickupReturn) {
                                return (
                                    <Button onClick={() => onReturnAction(pickupReturn.id, 'picked_up')} disabled={isUpdating} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs h-10 px-6 rounded-xl shadow-lg shadow-indigo-200">
                                        Confirm Picked Up
                                    </Button>
                                );
                            }

                            const processedReturn = returnRequests.find((r: any) => r.status === 'picked_up');
                            if (processedReturn) {
                                return (
                                    <span className="text-[10px] font-black text-slate-400 uppercase italic">Awaiting Item Inspection Below</span>
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
