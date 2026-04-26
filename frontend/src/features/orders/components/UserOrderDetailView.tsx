import { Suspense, lazy } from "react";
import { Loader2 } from "lucide-react";
import { useCurrency } from "@/app/providers/currency-provider";
import { OrderDetailSkeleton } from "@/shared/components/ui/page-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { ReturnHistorySection } from "@/features/returns";
import { CustomerCancellationDialog } from "./user/CustomerCancellationDialog";
import { OrderDetailHeader } from "./user/OrderDetailHeader";
import { OrderDetailAlert } from "./user/OrderDetailAlert";
import { AdminCancellationBanner } from "./user/AdminCancellationBanner";
import { OrderDetailItems } from "./user/OrderDetailItems";
import { OrderDetailAddresses } from "./user/OrderDetailAddresses";
import { OrderDetailSummary } from "./user/OrderDetailSummary";
import { OrderDetailPayment } from "./user/OrderDetailPayment";
import { ReturnRequestDialog } from "@/features/returns";
import { ReturnSuccessScreen } from "@/features/returns";
import { useDeferredVisibility } from "@/shared/hooks/useDeferredVisibility";
import type { UserOrderDetailOrder } from "@/domains/order/model/user-order-detail.types";
import type { ReturnRequest, ReturnableItem } from "@/shared/types";

const OrderProgressFlow = lazy(() => import("@/features/orders"));

interface UserOrderDetailViewProps {
    orderId: string;
    order: UserOrderDetailOrder | null;
    returns: ReturnRequest[];
    returnableItems: ReturnableItem[];
    isLoading: boolean;
    isActionLoading: boolean;
    isOpeningReturnDialog: boolean;
    loadingMessage: string;
    cancelOpen: boolean;
    returnOpen: boolean;
    returnSuccessData: {
        returnRequestId: string;
        orderNumber: string;
    } | null;
    canCancel: boolean;
    canReturn: boolean;
    latestReturnReason?: string;
    onCancelDialogChange: (open: boolean) => void;
    onReturnDialogChange: (open: boolean) => void;
    onConfirmCancelOrder: (reason: string) => Promise<void>;
    onOpenReturnDialog: () => Promise<void>;
    onSubmitReturn: (
        selectedItems: Array<{ id: string; quantity: number }>,
        reasonCategory: string,
        specificReason: string,
        additionalDetails: string,
        images: File[]
    ) => Promise<void>;
    onDismissReturnSuccess: () => void;
    onContactSupport: () => void;
}

export function UserOrderDetailView({
    orderId,
    order,
    returns,
    returnableItems,
    isLoading,
    isActionLoading,
    isOpeningReturnDialog,
    loadingMessage,
    cancelOpen,
    returnOpen,
    returnSuccessData,
    canCancel,
    canReturn,
    latestReturnReason,
    onCancelDialogChange,
    onReturnDialogChange,
    onConfirmCancelOrder,
    onOpenReturnDialog,
    onSubmitReturn,
    onDismissReturnSuccess,
    onContactSupport,
}: UserOrderDetailViewProps) {
    const { formatAmount } = useCurrency();
    const { isVisible: shouldRenderRoadmap, targetRef: roadmapRef } = useDeferredVisibility();

    if (isLoading) {
        return <OrderDetailSkeleton />;
    }

    if (!order) {
        return <div className="p-8 text-center">Order not found</div>;
    }

    if (returnSuccessData) {
        return (
            <div className="min-h-screen bg-[#F8F6F2]">
                <ReturnSuccessScreen
                    orderNumber={returnSuccessData.orderNumber}
                    returnRequestId={returnSuccessData.returnRequestId}
                    onBackToOrder={onDismissReturnSuccess}
                    onContactSupport={onContactSupport}
                />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#F8F6F2]">
            <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-6">
                <OrderDetailHeader
                    order={order}
                    onCancelOrder={() => onCancelDialogChange(true)}
                    canCancel={canCancel}
                />

                {order.status === "cancelled_by_admin" && (
                    <AdminCancellationBanner
                        type="order"
                        reason={order.order_status_history?.find((historyEntry) => historyEntry.status === "cancelled_by_admin")?.notes || "Policy decision"}
                    />
                )}

                {latestReturnReason && (
                    <AdminCancellationBanner
                        type="return"
                        reason={latestReturnReason}
                    />
                )}

                <OrderDetailAlert status={order.status} statusHistory={order.order_status_history || []} />

                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-8 items-start">
                    <div className="space-y-6">
                        <OrderDetailItems items={order.items || []} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <OrderDetailAddresses address={order.shipping_address} title="Shipping Address" />
                            <OrderDetailAddresses address={order.billing_address} title="Billing Address" />
                        </div>
                    </div>

                    <div className="lg:sticky lg:top-6 space-y-6">
                        <OrderDetailSummary
                            order={order}
                            canReturn={canReturn}
                            onReturnClick={onOpenReturnDialog}
                            isOpeningReturnDialog={isOpeningReturnDialog}
                        />
                        <OrderDetailPayment order={order} />
                    </div>
                </div>

                <ReturnHistorySection
                    returns={returns}
                    orderId={orderId}
                    viewMode="user"
                />

                <Card className="border-none shadow-2xl shadow-slate-200/50 md:rounded-[40px] overflow-hidden bg-white w-full">
                    <CardHeader className="px-10 pt-10 pb-6 flex flex-row items-center justify-between border-b border-slate-50 bg-slate-50/30">
                        <div className="flex flex-col gap-1">
                            <CardTitle className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-3">
                                <div className="w-2 h-8 bg-emerald-500 rounded-full" />
                                Journey of your Harvest
                            </CardTitle>
                            <p className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.2em] ml-5">
                                Tracking Your Order
                            </p>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        <div ref={roadmapRef} className="bg-white">
                            {shouldRenderRoadmap ? (
                                <Suspense
                                    fallback={
                                        <div className="flex h-[500px] items-center justify-center bg-gradient-to-br from-slate-50 to-white">
                                            <div className="flex flex-col items-center gap-3 rounded-[28px] border border-slate-100 bg-white px-8 py-6 shadow-sm">
                                                <div className="h-10 w-10 animate-pulse rounded-full bg-emerald-100" />
                                                <div className="text-center">
                                                    <p className="text-sm font-bold text-slate-700">
                                                        Preparing visual roadmap
                                                    </p>
                                                    <p className="text-xs text-slate-400">
                                                        Loading the detailed flow only when needed
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    }
                                >
                                    <OrderProgressFlow
                                        order={order}
                                        className="border-none rounded-none"
                                    />
                                </Suspense>
                            ) : (
                                <div className="flex h-[500px] items-center justify-center bg-gradient-to-br from-slate-50 to-white">
                                    <div className="max-w-sm rounded-[28px] border border-slate-100 bg-white px-8 py-6 text-center shadow-sm">
                                        <p className="text-sm font-bold text-slate-700">
                                            Visual roadmap will load when this section comes into view
                                        </p>
                                        <p className="mt-2 text-xs text-slate-400">
                                            This keeps order detail snappier while the event timeline is available immediately
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
                <ReturnRequestDialog
                    isOpen={returnOpen}
                    onClose={() => onReturnDialogChange(false)}
                    onSubmit={onSubmitReturn}
                    returnableItems={returnableItems}
                    orderItems={order.items}
                    orderNumber={order.order_number}
                    orderDeliveryCharge={(order.delivery_charge || 0) + (order.delivery_gst || 0)}
                    formatAmount={formatAmount}
                    isLoading={isActionLoading}
                    isDataLoading={isOpeningReturnDialog}
                />

                <CustomerCancellationDialog
                    isOpen={cancelOpen}
                    onClose={() => onCancelDialogChange(false)}
                    onConfirm={onConfirmCancelOrder}
                    isLoading={isActionLoading}
                />
            </div>

            {isActionLoading && (
                <div className="fixed inset-0 z-[100] bg-white/60 backdrop-blur-[2px] flex items-center justify-center animate-in fade-in duration-300">
                    <div className="bg-white p-8 rounded-[32px] shadow-2xl border border-slate-100 flex flex-col items-center gap-4">
                        <Loader2 className="w-10 h-10 text-emerald-600 animate-spin" />
                        <div className="flex flex-col items-center">
                            <p className="text-lg font-black text-slate-800 tracking-tight">
                                {loadingMessage || "Processing..."}
                            </p>
                            <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
                                Please wait a moment
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
