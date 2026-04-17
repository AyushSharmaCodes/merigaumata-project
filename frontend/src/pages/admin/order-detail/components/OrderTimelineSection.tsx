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
    isSyncing?: boolean;
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

const SUCCESS_PATH = ["shipped", "out_for_delivery", "delivered"];
const RETURN_PATH = ["return_requested", "return_approved", "return_picked_up", "returned", "refund_initiated", "return_rejected"];

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
    return_picked_up: "Picked up & in transit",
    returned: "Returned",
    return_rejected: "Rejected",
    cancelled: "Cancelled",
    refund_initiated: "Refunded"
};

// --- REACT FLOW CUSTOM COMPONENTS ---

interface RoadmapNodeData {
    key: string;
    label: string;
    icon: any;
    isCompleted: boolean;
    isCurrent: boolean;
    date?: string;
    reason?: string | null;
    sourcePosition?: Position;
    targetPosition?: Position;
    [key: string]: unknown;
}

interface RoadmapEdgeData {
    isCompleted: boolean;
    [key: string]: unknown;
}

const CustomRoadmapNode = memo(({ data }: { data: RoadmapNodeData }) => {
    const { t } = useTranslation();
    const Icon = data.icon;
    const { isCompleted, isCurrent, label, date, key } = data;

    return (
        <div className="flex flex-col items-center w-28 h-[160px] relative group bg-transparent">
            {/* Main Icon Container */}
            <div className="relative z-10 w-14 h-14 bg-transparent flex items-center justify-center">
                {/* Standardized Handles INSIDE the Icon Container for zero gaps */}
                <Handle 
                    type="target" 
                    position={data.targetPosition || Position.Left} 
                    style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        width: '1px', 
                        height: '1px',
                        top: data.targetPosition === Position.Top ? '-2px' : '50%',
                        bottom: data.targetPosition === Position.Bottom ? '-2px' : 'auto',
                        left: data.targetPosition === Position.Left ? '-2px' : '50%',
                        right: data.targetPosition === Position.Right ? '-2px' : 'auto',
                        transform: (data.targetPosition === Position.Left || data.targetPosition === Position.Right) ? 'translateY(-50%)' : 'translateX(-50%)'
                    }} 
                />
                <Handle 
                    type="source" 
                    position={data.sourcePosition || Position.Right} 
                    style={{ 
                        background: 'transparent', 
                        border: 'none', 
                        width: '1px', 
                        height: '1px',
                        top: data.sourcePosition === Position.Top ? '-2px' : '50%',
                        bottom: data.sourcePosition === Position.Bottom ? '-2px' : 'auto',
                        left: data.sourcePosition === Position.Left ? '-2px' : '50%',
                        right: data.sourcePosition === Position.Right ? '-2px' : 'auto',
                        transform: (data.sourcePosition === Position.Left || data.sourcePosition === Position.Right) ? 'translateY(-50%)' : 'translateX(-50%)'
                    }} 
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
                        shadow-md shadow-slate-200/50 transition-shadow duration-500 relative z-10
                        ${isCurrent ? "ring-2 ring-emerald-100 shadow-xl shadow-emerald-200/50" : ""}
                    `}
                >
                    <Icon size={20} />
                    
                    <AnimatePresence>
                        {isCurrent && (
                            <motion.div 
                                className="absolute -inset-1.5 rounded-full bg-emerald-500/10 pointer-events-none -z-0"
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1.25, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                transition={{ repeat: Infinity, duration: 2.5, repeatType: "reverse", ease: "easeInOut" }}
                            />
                        )}
                    </AnimatePresence>
                </motion.div>
            </div>

            <div className="mt-3 flex flex-col items-center text-center gap-1.5 px-1 min-h-[50px]">
                <span className={`text-[11px] font-black uppercase tracking-[0.1em] leading-tight transition-colors duration-500 ${isCompleted ? "text-slate-900" : "text-slate-400"}`}>
                    {t(`admin.orders.status.${key}`, label) as string}
                </span>
                
                <AnimatePresence mode="popLayout">
                    {date && (
                        <motion.span 
                            key={date}
                            initial={{ opacity: 0, y: 4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="text-[10px] font-bold text-slate-500 leading-none whitespace-nowrap"
                        >
                            {date}
                        </motion.span>
                    )}
                </AnimatePresence>

                {data.reason && key === 'cancelled' && (
                    <div className="mt-1 px-2 py-0.5 bg-red-50 text-red-600 text-[8px] font-black uppercase rounded border border-red-100 line-clamp-1 max-w-[100px]" title={data.reason}>
                        {data.reason}
                    </div>
                )}
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
}: EdgeProps<Edge<RoadmapEdgeData>>) => {
    // If Y difference is very small (same row), use a simple straight line
    const isSameRow = Math.abs(sourceY - targetY) < 5;
    
    let edgePath = '';
    if (isSameRow) {
        edgePath = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
    } else {
        [edgePath] = getSmoothStepPath({
            sourceX,
            sourceY,
            sourcePosition,
            targetX,
            targetY,
            targetPosition,
            borderRadius: 40 
        });
    }

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

const normalizeStatus = (status: string) => {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s === 'requested') return 'return_requested';
    if (s === 'approved' || s === 'pickup_scheduled') return 'return_approved';
    if (s === 'rejected') return 'return_rejected';
    if (s === 'partially_returned' || s === 'item_returned') return 'returned';
    if (s === 'partially_refunded') return 'refund_initiated';
    if (s === 'item_pickup' || s === 'picked_up') return 'return_picked_up';
    return s;
};

export const OrderTimelineSection = memo(({
    orderId,
    sortedHistory,
    currentStatus,
    refunds = [],
    returnRequests = [],
    onStatusUpdate,
    onReturnAction,
    onReturnItemStatus,
    isUpdating,
    isSyncing
}: OrderTimelineSectionProps) => {
    const { t, i18n } = useTranslation();
    const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1200);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const nodeTypes = useMemo(() => ({ roadmap: CustomRoadmapNode }), []);
    const edgeTypes = useMemo(() => ({ roadmap: CustomEdge }), []);

    // 1. Generate Dynamic Status Flow
    const STATUS_FLOW = useMemo(() => {
        const historyStatuses = sortedHistory.flatMap(h => [h.status?.toLowerCase(), h.event_type?.toLowerCase()]).filter(Boolean) as string[];
        const lowerCurrent = currentStatus?.toLowerCase() || '';
        const flowKeys = [...CORE_FLOW_KEYS];
        
        SUCCESS_PATH.forEach(key => {
            if (historyStatuses.includes(key) || lowerCurrent === key) {
                if (!flowKeys.includes(key)) flowKeys.push(key);
            }
        });

        if (!flowKeys.includes(lowerCurrent) && !RETURN_PATH.includes(lowerCurrent) && lowerCurrent !== "" && lowerCurrent !== 'cancelled') {
            flowKeys.push(lowerCurrent);
        }

        // Special handling for Cancelled flow: replace future nodes if they weren't reached
        if (lowerCurrent === 'cancelled' || historyStatuses.includes('cancelled')) {
            // 1. Identify future nodes in the core/success paths that were never reached
            const neverReached = [...CORE_FLOW_KEYS, ...SUCCESS_PATH].filter(key => 
                !historyStatuses.includes(key) && lowerCurrent !== key
            );

            // 2. Remove them from flowKeys
            const filteredFlow = flowKeys.filter(key => !neverReached.includes(key));
            
            // 3. Rebuild flowKeys with cancelled append
            flowKeys.length = 0;
            flowKeys.push(...filteredFlow);

            if (!flowKeys.includes('cancelled')) flowKeys.push('cancelled');
            
            // 4. If it was a paid order (implied by refund initiation in history), show the refund step
            if (historyStatuses.includes('refund_initiated') || historyStatuses.includes('refund_completed') || lowerCurrent === 'refund_initiated' || lowerCurrent === 'refunded') {
                if (!flowKeys.includes('refund_initiated')) flowKeys.push('refund_initiated');
            }
        }

        // Special handling for Delivery failure / RTO path specialization
        const hasDeliveryFailure = historyStatuses.includes('delivery_unsuccessful') || lowerCurrent === 'delivery_unsuccessful';
        const hasActualDelivery = historyStatuses.includes('delivered') || lowerCurrent === 'delivered';
        const hasActualOFD = historyStatuses.includes('out_for_delivery') || lowerCurrent === 'out_for_delivery';

        if (hasDeliveryFailure && !hasActualDelivery) {
            // 1. Remove "future" nodes that are now impossible
            const failureFiltered = flowKeys.filter(key => key !== 'delivered');
            flowKeys.length = 0;
            flowKeys.push(...failureFiltered);

            // 2. Ensure out_for_delivery only shows if it actually occurred
            if (!hasActualOFD && flowKeys.includes('out_for_delivery')) {
                const ofdIdx = flowKeys.indexOf('out_for_delivery');
                if (ofdIdx > -1) flowKeys.splice(ofdIdx, 1);
            }

            // 3. Insert Delivery Unsuccessful immediately after the last successful logistic step
            if (!flowKeys.includes('delivery_unsuccessful')) {
                let lastLogisticIdx = -1;
                for (let i = flowKeys.length - 1; i >= 0; i--) {
                    if (['shipped', 'out_for_delivery'].includes(flowKeys[i])) {
                        lastLogisticIdx = i;
                        break;
                    }
                }

                if (lastLogisticIdx !== -1) {
                    flowKeys.splice(lastLogisticIdx + 1, 0, 'delivery_unsuccessful');
                } else {
                    flowKeys.push('delivery_unsuccessful');
                }
            }
        } else {
            // Standard path: only add 'delivered' if no failure occurred
            const logisticsStarted = flowKeys.some(k => ["shipped", "out_for_delivery"].includes(k));
            if (logisticsStarted && !flowKeys.includes('delivered')) {
                flowKeys.push('delivered');
            }
        }

        const returnStarted = historyStatuses.some(h => RETURN_PATH.includes(h)) || RETURN_PATH.includes(lowerCurrent) || returnRequests.length > 0;
        if (returnStarted) {
            // Since sortedHistory is sorted newest-to-oldest, the first 'return_requested' we find is the latest cycle start
            const lastRequestIdx = sortedHistory.findIndex(h => {
                const s = normalizeStatus(h.status);
                const e = normalizeStatus(h.event_type || '');
                return s === 'return_requested' || e === 'return_requested';
            });
            const currentCycleHistory = lastRequestIdx === -1 
                ? sortedHistory.flatMap(h => [normalizeStatus(h.status), normalizeStatus(h.event_type || '')]).filter(Boolean)
                : sortedHistory.slice(0, lastRequestIdx + 1).flatMap(h => [normalizeStatus(h.status), normalizeStatus(h.event_type || '')]).filter(Boolean);

            RETURN_PATH.forEach(key => {
                let exists = currentCycleHistory.includes(key) || lowerCurrent === key;

                // Special checks for the active returnRequests data
                if (key === 'return_requested' && returnRequests.some(r => r.status === 'requested')) exists = true;
                if (key === 'return_approved' && returnRequests.some(r => r.status === 'approved' || r.status === 'pickup_scheduled')) exists = true;
                if (key === 'return_picked_up' && returnRequests.some(r => r.status === 'picked_up' || r.status === 'return_picked_up')) exists = true;
                if (key === 'return_rejected' && returnRequests.some(r => r.status === 'rejected')) exists = true;
                if (key === 'returned' && returnRequests.some(r => r.status === 'item_returned' || r.status === 'partially_returned')) exists = true;
                if (key === 'refund_initiated' && returnRequests.some(r => r.status === 'partially_refunded')) exists = true;
                
                // Truncation: If we are currently in return_requested, and this key is a "future" node 
                // that was only reached in the past (not this cycle), don't include it.
                if (lowerCurrent === 'return_requested' && key !== 'return_requested') {
                    // Only include if even in THIS cycle it reached it (unlikely but possible)
                    if (!currentCycleHistory.includes(key)) exists = false;
                }

                if (exists) {
                    if (!flowKeys.includes(key)) flowKeys.push(key);
                }
            });

            if (!flowKeys.some(k => RETURN_PATH.includes(k))) {
                flowKeys.push('return_requested');
            }
        }

        return flowKeys.map(key => {
            const historyItem = sortedHistory.find(h => h.status.toLowerCase() === key);
            return {
                key,
                icon: STATUS_ICONS[key] || Clock,
                label: STATUS_LABELS[key] || key,
                reason: historyItem?.notes || null
            };
        });
    }, [sortedHistory, currentStatus, returnRequests]);


    const currentStepIndex = useMemo(() => {
        let maxIndex = 0;
        const lowerCurrent = normalizeStatus(currentStatus);
        const historyStatuses = sortedHistory.flatMap(h => [normalizeStatus(h.status), normalizeStatus(h.event_type || '')]).filter(Boolean);

        const lastRequestIdx = sortedHistory.findIndex(h => {
            const s = normalizeStatus(h.status);
            const e = normalizeStatus(h.event_type || '');
            return s === 'return_requested' || e === 'return_requested';
        });
        const currentCycleHistory = lastRequestIdx === -1 
            ? sortedHistory.flatMap(h => [normalizeStatus(h.status), normalizeStatus(h.event_type || '')]).filter(Boolean)
            : sortedHistory.slice(0, lastRequestIdx + 1).flatMap(h => [normalizeStatus(h.status), normalizeStatus(h.event_type || '')]).filter(Boolean);

        STATUS_FLOW.forEach((step, idx) => {
            let isReached = false;
            if (lowerCurrent === step.key) isReached = true;
            
            // Only use the current cycle's history for identifying reached return steps
            if (RETURN_PATH.includes(step.key)) {
                if (currentCycleHistory.includes(step.key)) isReached = true;
            } else {
                if (historyStatuses.includes(step.key)) isReached = true;
            }

            if (step.key === 'return_requested' && returnRequests.some(r => r.status === 'requested')) isReached = true;
            if (step.key === 'return_approved' && returnRequests.some(r => r.status === 'approved' || r.status === 'pickup_scheduled')) isReached = true;
            if (step.key === 'return_picked_up' && returnRequests.some(r => r.status === 'picked_up')) isReached = true;
            if (step.key === 'returned' && returnRequests.some(r => r.status === 'item_returned' || r.status === 'partially_returned')) isReached = true;
            if (step.key === 'refund_initiated' && returnRequests.some(r => r.status === 'partially_refunded')) isReached = true;
            if (step.key === 'return_rejected' && returnRequests.some(r => r.status === 'rejected')) isReached = true;
            if (isReached) maxIndex = idx; // Use assignment instead of Math.max to respect the latest relevant status
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
    const { nodes, edges, containerHeight } = useMemo(() => {
        const flowNodes: Node[] = [];
        const flowEdges: Edge[] = [];
        
        // Breakpoints and Grid Config
        let nodesPerRow = 5;
        if (windowWidth < 768) nodesPerRow = 1;
        else if (windowWidth < 1440) nodesPerRow = 3;

        const isMobile = nodesPerRow === 1;
        const xOffset = isMobile ? 0 : 280; // Standardized spacing
        const rowHeight = 240; // High separation to prevent label overlap
        
        STATUS_FLOW.forEach((step, idx) => {
            const isCompleted = idx <= currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            
            const row = Math.floor(idx / nodesPerRow);
            const rawCol = idx % nodesPerRow;
            
            // Snake Logic: Reverse column order on odd rows
            const isReversedRow = row % 2 !== 0;
            const col = isReversedRow ? (nodesPerRow - 1) - rawCol : rawCol;

            const x = col * xOffset;
            const y = row * rowHeight;

            let sourcePosition = Position.Right;
            let targetPosition = Position.Left;

            if (isMobile) {
                sourcePosition = Position.Bottom;
                targetPosition = Position.Top;
            } else {
                // Determine handle positions based on snake direction
                if (isReversedRow) {
                    sourcePosition = Position.Left;
                    targetPosition = Position.Right;
                }
                
                // Vertical transition handles for row breaks 
                // Transition FROM a row:
                if (rawCol === nodesPerRow - 1 && idx < STATUS_FLOW.length - 1) {
                    sourcePosition = Position.Bottom; 
                }

                // Transition TO a new row:
                if (rawCol === 0 && idx > 0 && row > 0) {
                    targetPosition = Position.Top;
                }
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

        const totalRows = Math.ceil(STATUS_FLOW.length / nodesPerRow);
        const calcHeight = totalRows * rowHeight + 50;

        return { nodes: flowNodes, edges: flowEdges, containerHeight: calcHeight };
    }, [STATUS_FLOW, currentStepIndex, stepDates, windowWidth]);

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
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-500 ${isSyncing ? 'bg-indigo-50 border-indigo-100' : 'bg-emerald-50 border-emerald-100/50'}`}>
                        {isSyncing ? (
                            <RefreshCcw className="w-2 h-2 text-indigo-500 animate-spin" />
                        ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        )}
                        <span className={`text-[9px] font-black uppercase tracking-wider ${isSyncing ? 'text-indigo-600' : 'text-emerald-600'}`}>
                            {isSyncing ? 'Syncing...' : 'Real-Time Sync'}
                        </span>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                <div className="py-2 px-4 border-b border-slate-50 bg-white relative">
                    <div className="w-full transition-all duration-500 flex justify-center" style={{ height: `${containerHeight}px` }}>
                        <ReactFlow
                            key={`roadmap-layout-${nodes.length}-${currentStatus}`}
                            nodes={nodes}
                            edges={edges}
                            nodeTypes={nodeTypes}
                            edgeTypes={edgeTypes}
                            fitView
                            fitViewOptions={{ padding: windowWidth < 768 ? 0.4 : 0.25, includeHiddenNodes: false }}
                            minZoom={0.5}
                            maxZoom={1.1}
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
                                        Confirm Picked Up & In Transit
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
