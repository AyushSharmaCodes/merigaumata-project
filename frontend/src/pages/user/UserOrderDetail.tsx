import { useEffect, useState, useCallback, Suspense, lazy, useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { apiClient } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { RotateCcw, X, Loader2, CheckCircle, Package, Upload, Truck } from "lucide-react";
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
import { Order, CartItem, Product, Address } from "@/types";
import { OrderDetailSkeleton } from "@/components/ui/page-skeletons";
import { logger } from "@/lib/logger";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import { NavMessages } from "@/constants/messages/NavMessages";
import { hasAcceptedCookieConsent, requestCookieConsentForCriticalAction } from "@/lib/cookie-consent";
import { useCurrency } from "@/contexts/CurrencyContext";
import { uploadService } from "@/services/upload.service";
import { MAX_USER_IMAGE_SIZE_BYTES } from "@/constants/upload.constants";

const OrderProgressFlow = lazy(() => import("@/components/orders/OrderProgressFlow"));
import { CustomerCancellationDialog } from "./components/CustomerCancellationDialog";

// New Granular Components
import { OrderDetailHeader } from "./components/OrderDetailHeader";
import { OrderDetailAlert } from "./components/OrderDetailAlert";
import { OrderDetailItems } from "./components/OrderDetailItems";
import { OrderDetailAddresses } from "./components/OrderDetailAddresses";
import { OrderDetailSummary } from "./components/OrderDetailSummary";
import { OrderDetailPayment } from "./components/OrderDetailPayment";
import axios from "axios";

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
}

interface ReturnRequest {
    id: string;
    status: 'requested' | 'approved' | 'pickup_scheduled' | 'picked_up' | 'item_returned' | 'rejected' | 'cancelled' | 'completed';
    refund_amount: number;
    reason: string;
    created_at: string;
    refund_breakdown?: Record<string, unknown>;
    return_items: Array<{
        quantity: number;
        reason: string;
        order_item_id: string;
        order_items: {
            title: string;
            variant_snapshot?: { size_label?: string; color_label?: string;[key: string]: unknown };
        }
    }>;
}

interface ReturnableItem {
    id: string;
    title: string;
    price_per_unit: number;
    remaining_quantity: number;
    return_days?: number;
    return_deadline?: string;
    variant_snapshot?: { size_label?: string; color_label?: string;[key: string]: unknown };
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
    const [itemReasons, setItemReasons] = useState<Record<string, string>>({});
    const [itemImages, setItemImages] = useState<Record<string, File[]>>({});
    const [itemConditions, setItemConditions] = useState<Record<string, string>>({});
    const [returns, setReturns] = useState<ReturnRequest[]>([]);

    const handleReturnItemChange = (orderItemId: string, quantity: number, maxQuantity: number) => {
        if (quantity < 0 || quantity > maxQuantity) return;

        setSelectedReturnItems(prev => {
            const existing = prev.find(i => i.id === orderItemId);
            if (quantity === 0) {
                return prev.filter(i => i.id !== orderItemId);
            }
            if (existing) {
                return prev.map(i => i.id === orderItemId ? { ...i, quantity } : i);
            }
            return [...prev, { id: orderItemId, quantity }];
        });
    };

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

    const handleImageChange = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files);

            setItemImages(prev => {
                const currentFiles = prev[itemId] || [];
                const totalFiles = [...currentFiles, ...newFiles];

                if (totalFiles.length > 3) {
                    toast({
                        title: t("common.error"),
                        description: t(OrderMessages.MAX_IMAGES),
                        variant: "destructive",
                    });
                    return prev;
                }

                // Validate size (1MB limit)
                const invalidFile = newFiles.find(f => f.size > MAX_USER_IMAGE_SIZE_BYTES);
                if (invalidFile) {
                    toast({
                        title: t("common.error"),
                        description: t(OrderMessages.FILE_TOO_LARGE, { name: invalidFile.name }),
                        variant: "destructive",
                    });
                    return prev;
                }

                return { ...prev, [itemId]: totalFiles };
            });
        }
    };

    const removeImage = (itemId: string, index: number) => {
        setItemImages(prev => {
            const currentFiles = prev[itemId] || [];
            const newFiles = currentFiles.filter((_, i) => i !== index);
            return { ...prev, [itemId]: newFiles };
        });
    };

    const cleanupUploadedReturnImages = async (uploadedUrls: string[]) => {
        if (uploadedUrls.length === 0) return;

        await Promise.allSettled(
            uploadedUrls.map(async (url) => {
                try {
                    await uploadService.deleteImageByUrl(url);
                } catch (cleanupError) {
                    logger.error("Failed to cleanup orphaned return image", { cleanupError, url, orderId: id });
                    throw cleanupError;
                }
            })
        );
    };

    const handleReturnOrder = async () => {
        let requestPayload: Record<string, unknown> | null = null;

        try {
            if (!hasAcceptedCookieConsent()) {
                requestCookieConsentForCriticalAction('/returns/request');
                return;
            }

            if (selectedReturnItems.length === 0) {
                toast({
                    title: t("common.error"),
                    description: t(OrderMessages.SELECT_ITEM_TO_RETURN),
                    variant: "destructive",
                });
                return;
            }

            // Validation: global reason (heading) is required
            if (!returnReason || !returnReason.trim()) {
                toast({
                    title: t("common.error"),
                    description: t(OrderMessages.RETURN_REASON_REQUIRED, "Please provide a reason for return."),
                    variant: "destructive",
                });
                return;
            }

            // Validation: per-item description and images
            for (const item of selectedReturnItems) {
                const description = itemReasons[item.id];
                const images = itemImages[item.id];

                if (!description || !description.trim()) {
                    toast({
                        title: t("common.error"),
                        description: t(OrderMessages.RETURN_REASON_REQUIRED, "Please describe the issue for each selected item."),
                        variant: "destructive",
                    });
                    return;
                }
                if (!images || images.length < 1) {
                    toast({
                        title: t("common.error"),
                        description: t(OrderMessages.MIN_IMAGES_REQUIRED),
                        variant: "destructive",
                    });
                    return;
                }
            }

            setLoadingMessage(t(OrderMessages.SUBMITTING_RETURN));
            setActionLoading(true);


            const uploadedImageUrls: string[] = [];

            const itemsWithMetadata = await Promise.all(selectedReturnItems.map(async (item) => {
                const images = itemImages[item.id] || [];
                const imageUrls: string[] = [];

                for (const file of images) {
                    try {
                        const folder = `${id}/${item.id}`;
                        const uploadRes = await uploadService.uploadImage(file, 'return', folder);
                        imageUrls.push(uploadRes.url);
                        uploadedImageUrls.push(uploadRes.url);
                    } catch (uploadError) {
                        logger.warn("Return image upload failed, cleaning up already uploaded images", {
                            module: 'UserOrderDetail',
                            orderId: id,
                            itemId: item.id,
                            uploadedCount: uploadedImageUrls.length,
                        });
                        await cleanupUploadedReturnImages(uploadedImageUrls);
                        logger.error('Return image upload failed', { module: 'UserOrderDetail', err: uploadError, orderId: id, itemId: item.id });
                        // Throw the key directly so error handling logic can translate it with proper context
                        throw new Error(OrderMessages.IMAGE_UPLOAD_ERROR);
                    }
                }

                return {
                    orderItemId: item.id,
                    quantity: item.quantity,
                    reason: itemReasons[item.id],
                    images: imageUrls,
                    condition: itemConditions[item.id] || 'opened'
                };
            }));

            // 2. Submit Request
            try {
                requestPayload = {
                    orderId: id,
                    items: itemsWithMetadata,
                    reason: returnReason // Keeping global reason optional or as summary
                };

                await apiClient.post(`/returns/request`, requestPayload);

                toast({
                    title: t("common.success"),
                    description: t(OrderMessages.RETURN_SUBMIT_SUCCESS),
                });
                setReturnOpen(false);
                // Reset state
                setItemImages({});
                setItemReasons({});
                setSelectedReturnItems([]);

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

        await fetchReturnableItems();
        setReturnOpen(true);
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

    const canCancel = ['pending', 'confirmed'].includes(order.status);
    const canReturn = (() => {
        if (!['delivered', 'return_rejected', 'return_requested', 'return_approved', 'partially_returned'].includes(order.status)) return false;
        return returnableItems.length > 0;
    })();

    return (
        <div className="min-h-screen bg-[#F8F6F2]">
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8 space-y-6">
                {/* HEADER */}
                <OrderDetailHeader
                    order={order}
                    onCancelOrder={() => setCancelOpen(true)}
                    canCancel={canCancel}
                />

                {/* MAIN CONTENT GRID */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-5 items-start">
                    {/* Left Column */}
                    <div className="space-y-5">
                        <OrderDetailItems items={order.items || []} />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                            <OrderDetailAddresses shippingAddress={order.shipping_address} />
                            <OrderDetailPayment order={order} />
                        </div>
                    </div>

                    {/* Right Column — Order Summary */}
                    <div className="lg:sticky lg:top-6">
                        <OrderDetailSummary
                            order={order}
                            canReturn={canReturn}
                            onReturnClick={handleOpenReturnDialog}
                        />
                    </div>
                </div>
            </div>

            {/* JOURNEY OF YOUR HARVEST */}
            <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
                <Card className="border-none shadow-2xl shadow-slate-200/50 rounded-[40px] overflow-hidden bg-white">
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
                                        order={{
                                            status: order.status,
                                            status_history: [...(order.order_status_history || [])].sort(
                                                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
                                            )
                                        }}
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
                <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                    <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col rounded-[32px] overflow-hidden border-none shadow-2xl">
                        <DialogHeader className="p-8 pb-4">
                            <DialogTitle className="flex items-center gap-3 text-2xl font-black tracking-tight">
                                <div className="w-10 h-10 rounded-2xl bg-orange-100 flex items-center justify-center text-orange-600">
                                    <RotateCcw className="h-5 w-5" />
                                </div>
                                {t(OrderMessages.RETURN_TITLE)}
                            </DialogTitle>
                            <DialogDescription className="text-slate-500 font-medium">
                                {t(OrderMessages.RETURN_DESC)}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto px-8 py-4 space-y-6">
                            {/* Reason for Return */}
                            <div className="space-y-3">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">Reason for Return *</Label>
                                <Textarea
                                    placeholder="e.g. Damaged product received..."
                                    value={returnReason}
                                    onChange={e => setReturnReason(e.target.value)}
                                    className="min-h-[80px] rounded-2xl border-slate-100 bg-slate-50/50 p-4 focus:bg-white transition-all text-sm font-medium"
                                />
                            </div>

                            {/* Item Selection */}
                            <div className="space-y-4">
                                <Label className="text-xs font-black uppercase tracking-widest text-slate-400">{t(OrderMessages.SELECT_ITEMS)} *</Label>
                                <div className="space-y-3">
                                    {returnableItems.map(item => {
                                        const selected = selectedReturnItems.find(i => i.id === item.id);
                                        const isSelected = !!selected;

                                        return (
                                            <div key={item.id}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer shadow-sm
                                                    ${isSelected ? 'bg-orange-50 border-orange-200' : 'bg-white border-slate-100 hover:border-slate-200'}
                                                `}
                                                onClick={() => handleReturnItemChange(item.id, !isSelected ? item.remaining_quantity : 0, item.remaining_quantity)}
                                            >
                                                <Checkbox
                                                    checked={isSelected}
                                                    className="border-slate-300 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                                                />
                                                <div className="flex-1 space-y-0.5">
                                                    <p className="text-sm font-bold text-slate-800">{item.title}</p>
                                                    <p className="text-[10px] font-bold text-slate-400 capitalize">MAX: {item.remaining_quantity} • {formatAmount(item.price_per_unit || 0)} EACH</p>
                                                </div>
                                                {isSelected && (
                                                    <div className="flex items-center gap-2 bg-white rounded-xl border border-slate-100 p-1">
                                                        <button type="button" className="w-8 h-8 flex items-center justify-center font-bold" onClick={(e) => { e.stopPropagation(); handleReturnItemChange(item.id, Math.max(1, selected!.quantity - 1), item.remaining_quantity); }}>-</button>
                                                        <span className="w-6 text-center text-xs font-bold">{selected!.quantity}</span>
                                                        <button type="button" className="w-8 h-8 flex items-center justify-center font-bold" onClick={(e) => { e.stopPropagation(); handleReturnItemChange(item.id, Math.min(item.remaining_quantity, selected!.quantity + 1), item.remaining_quantity); }}>+</button>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Item Details (Images/Condition) */}
                            {selectedReturnItems.length > 0 && selectedReturnItems.map(selectedItem => {
                                const itemDef = returnableItems.find(i => i.id === selectedItem.id);
                                return (
                                    <div key={selectedItem.id} className="space-y-4 p-6 rounded-3xl bg-slate-50/50 border border-slate-100 animate-in zoom-in-95">
                                        <p className="text-xs font-black text-slate-800 tracking-tight">{itemDef?.title}</p>
                                        <div className="space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Detailed Description *</Label>
                                                <Textarea
                                                    value={itemReasons[selectedItem.id] || ''}
                                                    onChange={e => setItemReasons(prev => ({ ...prev, [selectedItem.id]: e.target.value }))}
                                                    placeholder="Describe the issue..."
                                                    className="min-h-[70px] rounded-xl border-none shadow-inner bg-white text-xs"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upload Evidence (Max 3) *</Label>
                                                <div className="flex gap-2">
                                                    {(itemImages[selectedItem.id] || []).map((file, idx) => (
                                                        <div key={idx} className="relative w-16 h-16 rounded-xl overflow-hidden shadow-sm">
                                                            <img src={URL.createObjectURL(file)} className="w-full h-full object-cover" alt="Return evidence" />
                                                            <button type="button" onClick={() => removeImage(selectedItem.id, idx)} className="absolute top-1 right-1 w-5 h-5 bg-rose-500 text-white rounded-full flex items-center justify-center"><X className="h-3 w-3" /></button>
                                                        </div>
                                                    ))}
                                                    {(itemImages[selectedItem.id]?.length || 0) < 3 && (
                                                        <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-100 transition-colors">
                                                            <Upload className="h-4 w-4 text-slate-400" />
                                                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleImageChange(selectedItem.id, e)} />
                                                        </label>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <DialogFooter className="p-8 pt-4 border-t border-slate-50 gap-4">
                            <Button variant="ghost" className="rounded-xl font-bold uppercase tracking-widest text-[10px]" onClick={() => setReturnOpen(false)}>{t(CommonMessages.CANCEL)}</Button>
                            <Button
                                className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl h-12 px-8 font-black uppercase tracking-widest text-xs shadow-lg shadow-emerald-200"
                                onClick={handleReturnOrder}
                                disabled={actionLoading || selectedReturnItems.length === 0}
                            >
                                {actionLoading ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                                {t(OrderMessages.SUBMIT_RETURN)}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <CustomerCancellationDialog
                    isOpen={cancelOpen}
                    onClose={() => setCancelOpen(false)}
                    onConfirm={handleCancelOrder}
                    isLoading={actionLoading}
                />
            </div>
        </div>
    );
}