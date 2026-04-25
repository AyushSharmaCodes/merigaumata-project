import React from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Undo2, Package, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ReturnRequest } from "@/types";
import { useTranslation } from "react-i18next";

interface ReturnHistorySectionProps {
    returns: ReturnRequest[];
    orderId: string;
    viewMode?: 'user' | 'admin';
    onReturnClick?: (returnId: string) => void;
}

export function ReturnHistorySection({ returns, orderId, viewMode = 'user', onReturnClick }: ReturnHistorySectionProps) {
    const { t } = useTranslation();

    if (returns.length === 0) return null;

    return (
        <div className="space-y-4 mt-8">
            <div className="flex items-center justify-between px-2">
                <div className="flex flex-col gap-1">
                    <h3 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                        <div className="w-2 h-8 bg-amber-500 rounded-full" />
                        {t("common.order.returnHistory", "Return History")}
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-5">
                        {viewMode === 'user' 
                            ? t("common.order.trackReturnRequests", "Track your return requests")
                            : t("admin.orders.detail.manageReturnRequests", "Manage return requests for this order")}
                    </p>
                </div>
                <Badge className="bg-slate-100 text-slate-600 hover:bg-slate-100 border-none px-3 py-1 text-xs font-bold">
                    {returns.length} {returns.length === 1 ? t("common.request") : t("common.requests")}
                </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {returns.map((ret) => {
                    const displayId = `RTN-${ret.id.split('-').pop()?.toUpperCase()}`;
                    
                    // Admin view usually triggers a different action or link
                    // In the user view, we navigate to the return detail page
                    // In the admin view, we want to show the audit/review view
                    const detailLink = viewMode === 'user'
                        ? `/my-orders/${orderId}/returns/${ret.id}`
                        : `/admin/orders/${orderId}?returnId=${ret.id}`;

                    const CardWrapper: any = onReturnClick ? 'div' : Link;

                    return (
                        <CardWrapper 
                            key={ret.id} 
                            {...(onReturnClick 
                                ? { onClick: () => onReturnClick(ret.id) } 
                                : { to: detailLink }
                            )}
                            className="group cursor-pointer bg-white rounded-[24px] p-5 shadow-sm border border-slate-100 hover:border-emerald-200 hover:shadow-md transition-all flex flex-col gap-4"
                        >
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-slate-50 text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 flex items-center justify-center transition-colors">
                                        <Undo2 className="w-5 h-5" />
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-sm font-black text-slate-800 tracking-tight">{displayId}</span>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                            {format(new Date(ret.created_at), "MMM d, yyyy")}
                                        </span>
                                    </div>
                                </div>
                                <Badge className={`
                                    px-2.5 py-0.5 text-[10px] uppercase font-black tracking-widest border-none
                                    ${ret.status === 'rejected' ? 'bg-rose-50 text-rose-600' : 
                                      ret.status === 'requested' ? 'bg-amber-50 text-amber-600' : 
                                      'bg-emerald-50 text-emerald-600'}
                                `}>
                                    {ret.status?.replace(/_/g, ' ') || 'Requested'}
                                </Badge>
                            </div>

                            <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-50">
                                <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
                                    <Package className="w-3.5 h-3.5" />
                                    {ret.return_items?.length || 0} {t("common.items")}
                                </span>
                                <div className="flex items-center gap-1 text-[11px] font-black text-emerald-600 uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                    {viewMode === 'user' ? t("common.viewDetails", "View Details") : t("admin.orders.detail.viewAudit", "View Audit")}
                                    <ArrowRight className="w-3 h-3" />
                                </div>
                            </div>
                        </CardWrapper>
                    );
                })}
            </div>
        </div>
    );
}
