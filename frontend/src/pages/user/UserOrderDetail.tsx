import { useEffect, useState, useCallback, Suspense, lazy, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { RotateCcw, X, Loader2, CheckCircle, Package, Upload, Truck, Undo2, ArrowRight, MessageSquare, AlertCircle, Badge } from "lucide-react";
import { format } from "date-fns";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage, getFriendlyTitle } from "@/lib/errorUtils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Order, CartItem, Product, Address, ReturnableItem, ReturnRequest } from "@/types";
import { OrderDetailSkeleton } from "@/components/ui/page-skeletons";
import { logger } from "@/lib/logger";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import { NavMessages } from "@/constants/messages/NavMessages";
import { hasAcceptedCookieConsent, requestCookieConsentForCriticalAction } from "@/lib/cookie-consent";
import { useCurrency } from "@/contexts/CurrencyContext";
import { uploadService } from "@/services/upload.service";
import { MAX_USER_IMAGE_SIZE_BYTES } from "@/constants/upload.constants";
import { ReturnSuccessScreen } from "./components/return-request/ReturnSuccessScreen";

const OrderProgressFlow = lazy(() => import("@/components/orders/OrderProgressFlow"));
const ReturnTimeline = lazy(() => import("@/components/orders/ReturnTimeline").then(m => ({ default: m.ReturnTimeline })));
import { CustomerCancellationDialog } from "./components/CustomerCancellationDialog";

import { OrderDetailHeader } from "./components/OrderDetailHeader";
import { OrderDetailAlert } from "./components/OrderDetailAlert";
import { AdminCancellationBanner } from "./components/AdminCancellationBanner";
import { OrderDetailItems } from "./components/OrderDetailItems";
import { OrderDetailAddresses } from "./components/OrderDetailAddresses";
import { OrderDetailSummary } from "./components/OrderDetailSummary";
import { OrderDetailPayment } from "./components/OrderDetailPayment";
import { ReturnRequestDialog } from "./components/return-request/ReturnRequestDialog";
import axios from "axios";
import { ReturnHistorySection } from "@/components/orders/ReturnHistorySection";

interface OrderResponse {
    id: string;
    order_number?: string;
    created_at: string;
    status: string;
    user_id: string;
    invoice_id?: string;
    invoice_url?: string;
    invoices?: Array<{
        id: string;
        type: 'RAZORPAY' | 'TAX_INVOICE' | 'BILL_OF_SUPPLY';
        public_url?: string;
        invoice_number: string;
    }>;
    subtotal?: number;
    total_amount: number;
    delivery_charge?: number;
    delivery_gst?: number;
    coupon_discount?: number; // Added
    shipping_address?: Address & { full_name?: string; address_line1?: string; address_line2?: string; postal_code?: string; phone?: string; };
    billing_address?: Address & { full_name?: string; address_line1?: string; address_line2?: string; postal_code?: string; phone?: string; };
    payment_status?: string;
    payment_method?: string;
    payment_id?: string;
    delivery_unsuccessful_reason?: string | null;
    // GST Tax fields
    total_taxable_amount?: number;
    total_cgst?: number;
    total_sgst?: number;
    total_igst?: number;
    items: Array<{
        id: string;
        quantity: number;
        price_per_unit?: number;
        remaining_quantity?: number;
        product?: Product;
        title?: string;
        price?: number;
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
            gst_rate?: number;
            sku?: string;
        };
        size_label?: string;
        // Delivery snapshots
        delivery_charge?: number;
        delivery_gst?: number;
        delivery_calculation_snapshot?: {
            source?: string;
            delivery_refund_policy?: 'REFUNDABLE' | 'NON_REFUNDABLE' | 'PARTIAL';
            non_refundable_delivery_charge?: number;
            non_refundable_delivery_gst?: number;
            [key: string]: any;
        };
        gst_rate?: number;
    }>;
    order_status_history?: Array<{
        status: string;
        event_type?: string;
        actor?: string;
        created_at: string;
        notes?: string;
        updater?: { role_data?: { name: string } };
    }>;
    refunds?: Array<{
        id: string;
        razorpay_refund_id: string;
        amount: number;
        status: string;
        created_at: string;
        notes?: string;
    }>;
    return_requests?: ReturnRequest[];
}






export default function UserOrderDetail() {
    const { t } = useTranslation();
    const { id } = useParams();
    const { formatAmount } = useCurrency();
    const { toast } = useToast();


    // Helper to translate history notes safely
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");

    // Roadmap deferred rendering state
    const roadmapRef = useRef<HTMLDivElement | null>(null);
    const [shouldRenderRoadmap, setShouldRenderRoadmap] = useState(false);

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

    // Action States
    const [cancelReason, setCancelReason] = useState("");
    const [returnReason, setReturnReason] = useState("");
    const [cancelOpen, setCancelOpen] = useState(false);
    const [returnOpen, setReturnOpen] = useState(false);
    const [selectedReturnItems, setSelectedReturnItems] = useState<{ id: string; quantity: number }[]>([]);
    const [returnableItems, setReturnableItems] = useState<ReturnableItem[]>([]);
    // Enhanced Return State
    const [returns, setReturns] = useState<ReturnRequest[]>([]);
    const [returnSuccessData, setReturnSuccessData] = useState<{
        returnRequestId: string;
        orderNumber: string;
    } | null>(null);
    const [isOpeningReturnDialog, setIsOpeningReturnDialog] = useState(false);
    const fetchReturns = useCallback(async () => {
        try {
            const response = await apiClient.get(`/returns/orders/${id}/all`);
            setReturns(response.data);
            return response.data;
        } catch (error) {
            logger.error("Error fetching returns", { err: error });
            return [];
        }
    }, [id]);

    const fetchReturnableItems = useCallback(async () => {
        try {
            const response = await apiClient.get(`/returns/orders/${id}/items`);
            setReturnableItems(response.data);
            return response.data;
        } catch (error) {
            logger.error("Failed to fetch returnable items", { err: error });
            return [];
        }
    }, [id]);

    const fetchOrderDetail = useCallback(async () => {
        try {
            setLoading(true);
            
            // Fetch all required data in parallel to avoid UI "pop-in" and delays
            const [orderRes] = await Promise.all([
                apiClient.get<OrderResponse>(`/orders/${id}`),
                fetchReturns(),
                fetchReturnableItems()
            ]);

            if (orderRes.data) {
                setOrder(orderRes.data);
            } else {
                throw new Error("Order not found");
            }
        } catch (error) {
            logger.error("Error fetching order details", { err: error });
            toast({
                title: t("common.error"),
                description: t(OrderMessages.LOADING_ERROR || "orderDetail.loadError"),
                variant: "destructive",
            });
            navigate("/my-orders");
        } finally {
            setLoading(false);
        }
    }, [id, navigate, fetchReturns, fetchReturnableItems, t]);

    useEffect(() => {
        fetchOrderDetail();
    }, [fetchOrderDetail]);

    const handleCancelOrder = async () => {
        if (!cancelReason || !cancelReason.trim()) {
            toast({
                title: t("common.error"),
                description: t(OrderMessages.CANCEL_REASON_REQUIRED),
                variant: "destructive",
            });
            return;
        }
        try {
            setLoadingMessage(t(OrderMessages.CANCELLING_ORDER));
            setActionLoading(true);
            setCancelOpen(false);
            await apiClient.post(`/orders/${id}/cancel`, { reason: cancelReason });
            toast({
                title: t("common.success"),
                description: t(OrderMessages.CANCEL_SUCCESS),
            });
            fetchOrderDetail(); // Refresh
        } catch (error: unknown) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t as any, OrderMessages.CANCEL_ERROR),
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    const cleanupUploadedReturnImages = async (urls: string[]) => {
        try {
            await Promise.allSettled(urls.map(url => uploadService.deleteImageByUrl(url)));
        } catch (e) {
            logger.error('Failed to cleanup images', { err: e });
        }
    };

    const handleReturnOrder = async (
        selectedItems: { id: string; quantity: number }[],
        reasonCategory: string,
        specificReason: string,
        additionalDetails: string,
        images: File[]
    ) => {
        let requestPayload: Record<string, unknown> | null = null;

        try {
            if (!hasAcceptedCookieConsent()) {
                requestCookieConsentForCriticalAction('/returns/request');
                return;
            }

            setLoadingMessage(t(OrderMessages.SUBMITTING_RETURN));
            setActionLoading(true);

            const uploadedImageUrls: string[] = [];

            // Upload the global images once
            for (const file of images) {
                try {
                    const folder = `${id}/return-proofs`;
                    const uploadRes = await uploadService.uploadImage(file, 'return', folder);
                    uploadedImageUrls.push(uploadRes.url);
                } catch (uploadError) {
                    logger.warn("Return image upload failed, cleaning up already uploaded images", {
                        module: 'UserOrderDetail',
                        orderId: id,
                        uploadedCount: uploadedImageUrls.length,
                    });
                    await cleanupUploadedReturnImages(uploadedImageUrls);
                    logger.error('Return image upload failed', { module: 'UserOrderDetail', err: uploadError, orderId: id });
                    throw new Error(OrderMessages.IMAGE_UPLOAD_ERROR);
                }
            }

            const itemsWithMetadata = selectedItems.map((item) => ({
                orderItemId: item.id,
                quantity: item.quantity,
                reason: `${reasonCategory}: ${specificReason}`,
                images: uploadedImageUrls,
                condition: 'opened'
            }));

            // 2. Submit Request
            try {
                requestPayload = {
                    orderId: id,
                    items: itemsWithMetadata,
                    reason: additionalDetails || `${reasonCategory}: ${specificReason}`
                };

                const response = await apiClient.post(`/returns/request`, requestPayload);

                toast({
                    title: t("common.success"),
                    description: t(OrderMessages.RETURN_SUBMIT_SUCCESS),
                });
                const returnReqId = response.data?.returnRequest?.id || response.data?.id || id || 'UNKNOWN';
                const idSuffix = returnReqId.includes('-') 
                    ? returnReqId.split('-').pop()?.toUpperCase() 
                    : returnReqId.substring(0, 8).toUpperCase();
                
                setReturnSuccessData({
                    returnRequestId: `RTN-${idSuffix}`,
                    orderNumber: order?.order_number || "Unknown"
                });

                setReturnOpen(false);
                fetchOrderDetail();
            } catch (apiError) {
                if (uploadedImageUrls.length > 0) {
                    logger.warn("Return request failed, cleaning up uploaded return images", {
                        orderId: id,
                        uploadedCount: uploadedImageUrls.length,
                        error: apiError,
                    });
                    await cleanupUploadedReturnImages(uploadedImageUrls);
                }
                throw apiError;
            }
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                void logger.error("Return request failed", {
                    module: "UserOrderDetail",
                    orderId: id,
                    status: error.response?.status,
                    responseData: error.response?.data,
                    requestPayload
                });
            } else {
                void logger.error("Return request failed", {
                    module: "UserOrderDetail",
                    orderId: id,
                    error,
                    requestPayload
                });
            }

            toast({
                title: getFriendlyTitle(error, t),
                description: getErrorMessage(error, t as any, OrderMessages.RETURN_SUBMIT_ERROR),
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    const handleOpenReturnDialog = async () => {
        if (!hasAcceptedCookieConsent()) {
            requestCookieConsentForCriticalAction('/returns/request');
            return;
        }

        try {
            setIsOpeningReturnDialog(true);
            setReturnOpen(true); // Open immediately for instant feedback
            
            // Only fetch if we don't have items yet
            if (returnableItems.length === 0) {
                await fetchReturnableItems();
            }
        } finally {
            setIsOpeningReturnDialog(false);
        }
    };

    const handleCancelReturn = async (returnId: string) => {
        try {
            setLoadingMessage(t(OrderMessages.CANCELLING_RETURN));
            setActionLoading(true);
            await apiClient.post(`/returns/${returnId}/cancel`);
            toast({
                title: t("common.success"),
                description: t(OrderMessages.RETURN_CANCELLED),
            });
            fetchOrderDetail(); // Refresh everything
        } catch (error) {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t as any, OrderMessages.CANCEL_RETURN_ERROR),
                variant: "destructive",
            });
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    if (loading) return <OrderDetailSkeleton />;
    if (!order) return <div className="p-8 text-center">{t(OrderMessages.NOT_FOUND)}</div>;

    if (returnSuccessData) {
        return (
            <div className="min-h-screen bg-[#F8F6F2]">
                <ReturnSuccessScreen
                    orderNumber={returnSuccessData.orderNumber}
                    returnRequestId={returnSuccessData.returnRequestId}
                    onBackToOrder={() => setReturnSuccessData(null)}
                    onContactSupport={() => navigate('/contact')}
                />
            </div>
        );
    }

    const canCancel = ['pending', 'confirmed'].includes(order.status);
    const canReturn = (() => {
        if (!['delivered', 'return_rejected', 'return_requested', 'return_approved', 'partially_returned'].includes(order.status)) return false;
        return returnableItems.length > 0;
    })();

    return (
        <div className="min-h-screen bg-[#F8F6F2]">
            <div className="w-full max-w-[1600px] mx-auto px-4 md:px-8 py-8 space-y-6">
                {/* HEADER */}
                <OrderDetailHeader
                    order={order}
                    onCancelOrder={() => setCancelOpen(true)}
                    canCancel={canCancel}
                />

                {/* ADMIN CANCELLATION / REJECTION BANNERS */}
                {order.status === 'cancelled_by_admin' && (
                    <AdminCancellationBanner 
                        type="order"
                        reason={order.order_status_history?.find(h => h.status === 'cancelled_by_admin')?.notes || "Policy decision"}
                    />
                )}

                {(() => {
                    const latestReturn = returns.length > 0 
                        ? [...returns].sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0] 
                        : null;
                    
                    if (latestReturn?.status === 'rejected') {
                        return (
                            <AdminCancellationBanner 
                                type="return"
                                reason={latestReturn.staff_notes || latestReturn.reason || "Policy non-compliance"}
                            />
                        );
                    }
                    return null;
                })()}

                <OrderDetailAlert status={order.status} statusHistory={order.order_status_history || []} />

                {/* MAIN CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] xl:grid-cols-[1fr_400px] gap-8 items-start">
                    {/* Left Column */}
                    <div className="space-y-6">
                        <OrderDetailItems items={order.items || []} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <OrderDetailAddresses address={order.shipping_address} title="Shipping Address" />
                            <OrderDetailAddresses address={order.billing_address} title="Billing Address" />
                        </div>
                    </div>

                    {/* Right Column — Order Summary */}
                    <div className="lg:sticky lg:top-6 space-y-6">
                        <OrderDetailSummary
                            order={order}
                            canReturn={canReturn}
                            onReturnClick={handleOpenReturnDialog}
                            isOpeningReturnDialog={isOpeningReturnDialog}
                        />
                        <OrderDetailPayment order={order} />
                    </div>
                </div>


                {/* RETURN HISTORY SECTION */}
                <ReturnHistorySection 
                    returns={returns} 
                    orderId={id || ''} 
                    viewMode="user" 
                />

                {/* JOURNEY OF YOUR HARVEST */}
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
                        {/* Visual Roadmap Section - STALELESS UI Component */}
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

            {/* DIALOGS AND OVERLAYS SECTION */}
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
                {/* Standard Return Request Dialog */}
                <ReturnRequestDialog
                    isOpen={returnOpen}
                    onClose={() => setReturnOpen(false)}
                    onSubmit={handleReturnOrder}
                    returnableItems={returnableItems}
                    orderItems={order.items}
                    orderNumber={order.order_number}
                    orderDeliveryCharge={(order.delivery_charge || 0) + (order.delivery_gst || 0)}
                    formatAmount={formatAmount}
                    isLoading={actionLoading}
                    isDataLoading={isOpeningReturnDialog}
                />

                <CustomerCancellationDialog
                    isOpen={cancelOpen}
                    onClose={() => setCancelOpen(false)}
                    onConfirm={handleCancelOrder}
                    isLoading={actionLoading}
                />
            </div>

            {/* Loading Overlay for long-running actions */}
            {actionLoading && (
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