import { Suspense, lazy } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cleanRejectionReason } from "@/core/utils/stringUtils";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import { OrderDetailSkeleton } from "@/shared/components/ui/page-skeletons";
import {
    PickupAddressCard,
    PickupInformationCard,
    RefundSettlementCard,
    ReturnInventoryCard,
    ReturnOverviewCard,
} from "@/features/returns";
import type { Order, ReturnRequest } from "@/shared/types";

const ReturnTimeline = lazy(() => import("./ReturnTimeline").then((module) => ({ default: module.ReturnTimeline })));

interface UserReturnDetailViewProps {
    orderId: string;
    returnId: string;
    order: Order | null;
    returnRequest: ReturnRequest | null;
    returns: ReturnRequest[];
    error: string | null;
    isLoadingOrder: boolean;
    isLoadingReturn: boolean;
    onBackToOrder: () => void;
}

export function UserReturnDetailView({
    orderId,
    returnId,
    order,
    returnRequest,
    returns,
    error,
    isLoadingOrder,
    isLoadingReturn,
    onBackToOrder,
}: UserReturnDetailViewProps) {
    if (error) {
        return (
            <div className="container mx-auto px-4 py-16 flex flex-col items-center text-center">
                <AlertTriangle className="w-16 h-16 text-rose-500 mb-4" />
                <h2 className="text-2xl font-black text-slate-800 mb-2">Return Request Unavailable</h2>
                <p className="text-slate-500 max-w-md mb-8">{error}</p>
                <Button onClick={onBackToOrder} className="bg-emerald-600 hover:bg-emerald-700">
                    Back to Order Details
                </Button>
            </div>
        );
    }

    if (isLoadingOrder && !order) {
        return <OrderDetailSkeleton />;
    }

    if (!order) {
        return null;
    }

    const customerName = order.shipping_address?.name || order.customer_name || "Customer";
    const placedDate = order.created_at ? format(new Date(order.created_at), "MMM d, yyyy") : "";

    return (
        <div className="min-h-screen bg-[#fcfaf5]/50 pb-24">
            <div className="bg-white border-b border-slate-100 sticky top-0 z-40">
                <div className="container mx-auto px-4 lg:px-8 h-20 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link
                            to={`/my-orders/${orderId}`}
                            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-800 transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </Link>
                        <div className="flex flex-col">
                            <h1 className="text-sm font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">
                                ORDER #{order.order_number || orderId}
                            </h1>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-black text-slate-800 tracking-tight">Return &amp; Pickup Details</h2>
                            </div>
                            <div className="text-xs font-bold text-slate-500 mt-1">
                                Customer: <span className="text-slate-800">{customerName}</span> • Placed {placedDate}
                            </div>
                        </div>
                    </div>

                    {returnRequest && (
                        <Badge className="bg-[#f3ead8] text-[#cca036] hover:bg-[#f3ead8] border-none px-4 py-1.5 text-[10px] uppercase font-black tracking-widest rounded-full flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#cca036] animate-pulse" />
                            {returnRequest.status?.replace(/_/g, " ") || "Requested"}
                        </Badge>
                    )}
                </div>
            </div>

            <div className="container mx-auto px-4 lg:px-8 mt-8 space-y-8">
                {!returnRequest && isLoadingReturn ? (
                    <div className="space-y-6">
                        <div className="h-32 bg-white rounded-2xl animate-pulse border border-slate-100" />
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                            <div className="lg:col-span-2 h-64 bg-white rounded-2xl animate-pulse border border-slate-100" />
                            <div className="h-64 bg-white rounded-2xl animate-pulse border border-slate-100" />
                        </div>
                    </div>
                ) : (
                    <>
                        {["pickup_scheduled", "pickup_attempted"].includes(returnRequest?.status || "") &&
                            order.order_status_history?.some((historyEntry) => historyEntry.status === "pickup_attempted") && (
                                <div className="bg-rose-50 rounded-2xl p-6 text-rose-800 border border-rose-100 flex flex-col gap-2">
                                    <h2 className="text-sm font-black flex items-center gap-2 uppercase tracking-widest">
                                        <AlertTriangle className="w-4 h-4 text-rose-600" />
                                        Previous Pickup Attempt Failed
                                    </h2>
                                    <p className="text-sm font-medium opacity-80">
                                        Agent reached the location, but the pickup could not be completed. A re-attempt has been scheduled.
                                    </p>
                                </div>
                            )}

                        {returnRequest?.status === "rejected" && (
                            <div className="bg-rose-500 rounded-2xl p-6 text-white shadow-lg shadow-rose-500/20 flex flex-col gap-2">
                                <h2 className="text-lg font-black flex items-center gap-2">
                                    <AlertTriangle className="w-5 h-5" />
                                    Return Request Rejected
                                </h2>
                                <p className="text-rose-50 font-medium">
                                    We apologize, but this return request was rejected. Reason:{" "}
                                    {cleanRejectionReason(
                                        returnRequest.staff_notes || "Does not meet return policy criteria."
                                    )}
                                </p>
                            </div>
                        )}

                        {returnRequest && (
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                                <div className="col-span-1 lg:col-span-8 space-y-8">
                                    <ReturnOverviewCard returnRequest={returnRequest} />
                                    <ReturnInventoryCard returnRequest={returnRequest} order={order} />
                                </div>

                                <div className="col-span-1 lg:col-span-4 lg:sticky lg:top-28 space-y-6">
                                    <RefundSettlementCard returnRequest={returnRequest} order={order} />
                                    <PickupAddressCard order={order} />
                                    <PickupInformationCard returnRequest={returnRequest} order={order} />
                                </div>
                            </div>
                        )}
                    </>
                )}

                <div className="pt-8 border-t border-slate-100 min-h-[400px]">
                    <Suspense fallback={<div className="h-[400px] bg-white rounded-2xl animate-pulse border border-slate-100" />}>
                        <ReturnTimeline
                            history={order.order_status_history || order.status_history || []}
                            returns={returns}
                            activeReturnId={returnId}
                            showOnlyActive
                        />
                    </Suspense>
                </div>
            </div>
        </div>
    );
}
