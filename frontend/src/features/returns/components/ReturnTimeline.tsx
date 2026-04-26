import React from 'react';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { 
    Undo2, 
    ClipboardCheck, 
    Clock, 
    Truck, 
    RotateCcw, 
    CheckCircle2, 
    AlertCircle, 
    XCircle,
    RotateCw
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { OrderStatusHistory, ReturnRequest } from "@/shared/types";

const RETURN_TIMELINE_STATUSES = new Set([
    'delivered',
    'return_requested',
    'return_approved',
    'return_rejected',
    'return_cancelled',
    'pickup_scheduled',
    'pickup_attempted',
    'pickup_completed',
    'pickup_failed',
    'return_picked_up',
    'picked_up',
    'in_transit_to_warehouse',
    'item_returned',
    'partially_returned',
    'returned',
    'qc_initiated',
    'qc_passed',
    'qc_failed',
    'partial_refund',
    'zero_refund',
    'refund_initiated',
    'refunded',
    'return_to_customer',
    'return_back_to_customer',
    'dispose_liquidate',
    'cancelled',
    'cancelled_by_admin',
    'cancelled_by_customer'
]);

const STATUS_ICONS: Record<string, React.ElementType> = {
    return_requested: Undo2,
    return_approved: ClipboardCheck,
    pickup_scheduled: Clock,
    pickup_attempted: Clock,
    pickup_completed: Truck,
    pickup_failed: XCircle,
    return_picked_up: Truck,
    picked_up: Truck,
    in_transit_to_warehouse: Truck,
    item_returned: RotateCcw,
    partially_returned: RotateCcw,
    returned: RotateCcw,
    qc_initiated: ClipboardCheck,
    qc_passed: CheckCircle2,
    qc_failed: AlertCircle,
    partial_refund: RotateCw,
    zero_refund: AlertCircle,
    return_to_customer: RotateCcw,
    return_back_to_customer: RotateCcw,
    dispose_liquidate: XCircle,
    return_completed: CheckCircle2,
    return_rejected: XCircle,
    return_cancelled: XCircle,
    refund_initiated: CheckCircle2,
    refunded: CheckCircle2,
    delivered: CheckCircle2,
};

interface ReturnTimelineProps {
    history: OrderStatusHistory[];
    returns?: ReturnRequest[];
    activeReturnId?: string;
    showOnlyActive?: boolean;
}

export function ReturnTimeline({ history, returns = [], activeReturnId, showOnlyActive = false }: ReturnTimelineProps) {
    const { t } = useTranslation();

    // Group and Sort everything into a single unified timeline flow
    const timelineItems = React.useMemo(() => {
        // 1. Identify relevant events
        const relevantHistory = history.filter(h => {
            const s = h.status.toLowerCase();
            return RETURN_TIMELINE_STATUSES.has(s);
        });

        // 2. Map returns for quick lookup
        let filteredReturns = [...returns];
        if (showOnlyActive && activeReturnId) {
            filteredReturns = filteredReturns.filter(r => r.id === activeReturnId);
        }
        
        const sortedReturns = filteredReturns.sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        // 3. Group history by return_id
        const groups: Record<string, OrderStatusHistory[]> = {};
        const orphanEvents: OrderStatusHistory[] = [];
        
        // Full list for robust legacy matching
        const allReturnsSorted = [...returns].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );

        relevantHistory.forEach(h => {
            let targetReturnId = h.return_id;

            // Legacy/Orphan support: Try to match by timestamp if return_id is missing
            if (!targetReturnId && (h.status.toLowerCase().startsWith('return_') || h.status === 'item_returned' || h.status === 'picked_up')) {
                const eventTime = new Date(h.created_at).getTime();
                const bestMatch = allReturnsSorted.find(r => new Date(r.created_at).getTime() <= eventTime + 1000);
                if (bestMatch) {
                    targetReturnId = bestMatch.id;
                }
            }

            if (targetReturnId) {
                // If filtering, only show if it matches the active return
                if (showOnlyActive && activeReturnId && targetReturnId !== activeReturnId) return;

                if (!groups[targetReturnId]) groups[targetReturnId] = [];
                groups[targetReturnId].push(h);
            } else {
                // It's a global event or a true orphan
                const isGlobal = ['delivered', 'cancelled', 'cancelled_by_admin', 'cancelled_by_customer'].includes(h.status);
                
                // In filtered mode, only show global events (Delivered), hide other orphans
                if (showOnlyActive && activeReturnId && !isGlobal) return;

                orphanEvents.push(h);
            }
        });

        // Combine all events into one final sorted list for the "Unified Timeline" look
        // but keeping them categorized for labeling if needed.
        const allItems: { type: 'event' | 'header'; data: any; timestamp: number }[] = [];

        // Add orphan events
        orphanEvents.forEach(e => allItems.push({ type: 'event', data: e, timestamp: new Date(e.created_at).getTime() }));

        // Add grouped events
        Object.values(groups).forEach(group => {
            group.forEach(e => allItems.push({ type: 'event', data: e, timestamp: new Date(e.created_at).getTime() }));
        });

        // Sort all items by timestamp descending
        allItems.sort((a, b) => b.timestamp - a.timestamp);

        return allItems;
    }, [history, returns, activeReturnId, showOnlyActive]);

    if (timelineItems.length === 0) {
        return (
            <div className="p-12 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                    {t("user.orders.detail.history.empty", "No activity recorded yet.")}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 w-full">
            {/* Header Container */}
            {activeReturnId && (
                <div className="flex items-center justify-between mb-2 px-2">
                    <div className="flex items-start gap-3">
                        <div className="w-1 h-6 bg-emerald-500 rounded-full mt-0.5 shrink-0" />
                        <h2 className="text-sm font-black text-slate-800 uppercase tracking-widest leading-tight">
                            Return Timeline — <span className="break-all opacity-60">RTN-{activeReturnId.split('-').pop()?.toUpperCase()}</span>
                        </h2>
                    </div>
                </div>
            )}

            <Card className="border-none shadow-sm bg-white rounded-[32px] overflow-hidden w-full">
                <CardContent className="p-8 md:p-12">
                    <div className="relative w-full">
                        {/* Dotted Vertical Line */}
                        <div className="absolute left-[20px] top-10 bottom-10 border-l-2 border-dotted border-slate-200" />

                        <div className="space-y-12">
                            {timelineItems.map((item, idx) => (
                                <TimelineEntry 
                                    key={`${item.type}-${idx}`} 
                                    entry={item.data} 
                                    isLatest={idx === 0} 
                                />
                            ))}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function TimelineEntry({ entry, isLatest }: { entry: OrderStatusHistory; isLatest: boolean }) {
    const { t } = useTranslation();
    const s = entry.status.toLowerCase();
    const Icon = STATUS_ICONS[s] || CheckCircle2;

    const isGreen = ['return_approved', 'item_returned', 'return_completed', 'refund_initiated', 'refunded', 'delivered', 'qc_passed'].includes(s);
    const isAmber = ['return_requested', 'pickup_scheduled', 'pickup_attempted', 'pickup_completed', 'picked_up', 'in_transit_to_warehouse', 'qc_initiated', 'partial_refund'].includes(s) || s.includes('requested');
    const isRed = ['return_rejected', 'return_cancelled', 'qc_failed', 'pickup_failed', 'zero_refund', 'dispose_liquidate', 'cancelled', 'cancelled_by_admin', 'cancelled_by_customer'].includes(s);

    let nodeClass = 'bg-slate-400 text-white'; // Grey as default
    if (isGreen) nodeClass = 'bg-[#2E7D32] text-white'; // Darker green like reference
    else if (isAmber) nodeClass = 'bg-[#C68400] text-white'; // Deep amber like reference
    else if (isRed) nodeClass = 'bg-[#C62828] text-white'; // Soft red

    return (
        <div className="relative flex gap-8 group items-start">
            {/* Timeline Node */}
            <div className={`
                w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-300 
                ${nodeClass} shadow-lg shadow-white border-2 border-white
            `}>
                <Icon size={18} strokeWidth={2.5} />
            </div>
            
            <div className="flex flex-col pt-0.5">
                {/* Title */}
                <h4 className={`text-base font-bold tracking-tight ${isLatest ? 'text-slate-900' : 'text-slate-700'}`}>
                    {t(`orderStatus.${entry.status}`, entry.status.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()))}
                </h4>
                
                {/* Timestamp */}
                <p className="text-sm font-medium text-slate-400 mt-0.5">
                    {format(new Date(entry.created_at), 'EEEE, hh:mm a')} 
                    {/* (e.g. Yesterday, 10:15 AM) - using EEEE for Day name as in reference */}
                </p>

                {/* Notes / Admin Feedback */}
                {entry.notes && (
                    <p className="text-sm text-slate-500 font-normal leading-relaxed mt-1.5 break-words">
                        {t(entry.notes, { defaultValue: entry.notes })}
                    </p>
                )}
            </div>
        </div>
    );
}
