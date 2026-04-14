import { logger } from "@/lib/logger";
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useRenderComplexNote } from "@/lib/i18n-utils";
import { apiClient } from "@/lib/api-client";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, Package, CreditCard, Clock, CheckCircle, AlertTriangle, XCircle, RotateCcw, FileText, CheckSquare, Truck } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { getErrorMessage } from "@/lib/errorUtils";
import axios from "axios";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Order, CartItem, Product, Address } from "@/types";
import { LoadingOverlay } from "@/components/ui/loading-overlay";
import { TaxBreakdown } from "@/components/orders/TaxBreakdown";
import { InvoiceActions } from "@/components/orders/InvoiceActions";
import { uploadService } from "@/services/upload.service";
import { MAX_USER_IMAGE_SIZE_BYTES } from "@/constants/upload.constants";
import { Upload, X, Image as ImageIcon, Loader2 } from "lucide-react";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { CommonMessages } from "@/constants/messages/CommonMessages";
import { NavMessages } from "@/constants/messages/NavMessages";
import { hasAcceptedCookieConsent, requestCookieConsentForCriticalAction } from "@/lib/cookie-consent";
import { useCurrency } from "@/contexts/CurrencyContext";
import { openInvoiceDocument } from "@/lib/invoice-download";

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

const INTERNAL_INVOICE_TYPES = ['TAX_INVOICE', 'BILL_OF_SUPPLY'];

const getActiveInternalInvoice = (order: Pick<OrderResponse, 'invoice_id' | 'invoices'>) => {
    const internalInvoices = (order.invoices || []).filter((invoice) => INTERNAL_INVOICE_TYPES.includes(invoice.type));
    return internalInvoices.find((invoice) => invoice.id === order.invoice_id) || internalInvoices[0];
};

export default function UserOrderDetail() {
    const { t, i18n } = useTranslation();
    const { renderNote } = useRenderComplexNote();
    const { id } = useParams();
    const { formatAmount } = useCurrency();

    // Helper to translate history notes safely
    const renderHistoryNote = (note: string) => {
        if (!note) return "";

        // Exact match in historyNotes namespace
        const exactMatch = t(`historyNotes.${note}`, { defaultValue: '' });
        if (exactMatch) return exactMatch;

        // Dynamic matches
        if (note.startsWith("Order cancelled by administrator: ")) {
            const reason = note.replace("Order cancelled by administrator: ", "");
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {t("historyNotes.cancelledByAdmin", "Order cancelled by administrator")}: <TranslatedText text={reason} />
                </span>
            );
        }
        if (note === "Order cancelled by administrator") {
            return t("historyNotes.cancelledByAdmin", { defaultValue: note });
        }
        if (note.startsWith("common.order.cancelledByUser: ")) {
            const reason = note.replace("common.order.cancelledByUser: ", "");
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {t("historyNotes.cancelledByUser")}: <TranslatedText text={reason} />
                </span>
            );
        }
        if (note === "common.order.cancelledByUser") {
            return t("historyNotes.cancelledByUser", { defaultValue: note });
        }

        if (note && note.includes("Delivery unsuccessful: ")) {
            const reason = note.replace("Delivery unsuccessful: ", "");
            return (
                <span className="inline-flex flex-wrap gap-1">
                    {t("orderStatus.delivery_unsuccessful")}: <TranslatedText text={reason} />
                </span>
            );
        }

        // Handle keys with dynamic suffixes (e.g., "common.order.returnRejectedNote: [reason]")
        const dynamicPrefixes = [
            "common.order.itemReturnedNote",
            "common.order.refundInitiatedNote",
            "common.order.returnPickedUpNote",
            "common.order.returnRequestedNote",
            "common.order.returnApprovedNote",
            "common.order.returnRejectedNote",
            "common.order.orderReturnedNote",
            "common.order.partiallyReturnedNote",
            "common.order.refundProcessedNote"
        ];

        for (const prefix of dynamicPrefixes) {
            if (note.startsWith(prefix)) {
                const baseMessage = t(prefix);
                const suffix = note.replace(prefix, "");

                // If suffix has a separator like ": ", we handle it specially for translation
                if (suffix.startsWith(": ")) {
                    const actualReason = suffix.replace(": ", "");
                    return (
                        <span className="inline-flex flex-wrap gap-1">
                            {baseMessage}: <TranslatedText text={actualReason} />
                        </span>
                    );
                }

                return <span>{baseMessage}{suffix}</span>;
            }
        }

        // Fallback to original t() for backward compatibility
        return t(note);
    };
    const navigate = useNavigate();
    const [order, setOrder] = useState<OrderResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState("");

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
            toast.error(t(OrderMessages.LOADING_ERROR || "orderDetail.loadError"));
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
            toast.error(t(OrderMessages.CANCEL_REASON_REQUIRED));
            return;
        }
        try {
            setLoadingMessage(t(OrderMessages.CANCELLING_ORDER));
            setActionLoading(true);
            setCancelOpen(false);
            await apiClient.post(`/orders/${id}/cancel`, { reason: cancelReason });
            toast.success(t(OrderMessages.CANCEL_SUCCESS));
            fetchOrderDetail(); // Refresh
        } catch (error: unknown) {
            toast.error(getErrorMessage(error, t as any, OrderMessages.CANCEL_ERROR));
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
                    toast.error(t(OrderMessages.MAX_IMAGES));
                    return prev;
                }

                // Validate size (1MB limit)
                const invalidFile = newFiles.find(f => f.size > MAX_USER_IMAGE_SIZE_BYTES);
                if (invalidFile) {
                    toast.error(t(OrderMessages.FILE_TOO_LARGE, { name: invalidFile.name }));
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
                toast.error(t(OrderMessages.SELECT_ITEM_TO_RETURN));
                return;
            }

            // Validation
            for (const item of selectedReturnItems) {
                const reason = itemReasons[item.id];
                const images = itemImages[item.id];

                if (!reason || !reason.trim()) {
                    toast.error(t(OrderMessages.RETURN_REASON_REQUIRED));
                    return;
                }
                if (!images || images.length < 1) {
                    toast.error(t(OrderMessages.MIN_IMAGES_REQUIRED));
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
                        throw new Error(t(OrderMessages.IMAGE_UPLOAD_ERROR));
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

                toast.success(t(OrderMessages.RETURN_SUBMIT_SUCCESS));
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

            toast.error(getErrorMessage(error, t as any, OrderMessages.RETURN_SUBMIT_ERROR));
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
            toast.success(t(OrderMessages.RETURN_CANCELLED));
            fetchOrderDetail(); // Refresh everything
        } catch (error) {
            toast.error(getErrorMessage(error, t as any, OrderMessages.CANCEL_RETURN_ERROR));
        } finally {
            setActionLoading(false);
            setLoadingMessage("");
        }
    };

    if (loading) return (
        <div className="min-h-screen flex items-center justify-center">
            <LoadingOverlay isLoading={true} message={t(OrderMessages.LOADING)} />
        </div>
    );
    if (!order) return <div className="p-8 text-center">{t(OrderMessages.NOT_FOUND)}</div>;

    const canCancel = ['pending', 'confirmed'].includes(order.status);

    // Can return only if:
    // 1. Order status is 'delivered'
    // 2. There are actual items available to return (fetched from backend)
    const canReturn = (() => {
        if (!['delivered', 'return_rejected', 'return_requested', 'return_approved', 'partially_returned'].includes(order.status)) return false;

        // If we have returnable items fetched, use that as the source of truth
        return returnableItems.length > 0;
    })();

    return (
        <>
            {/* Full-page loading overlay for actions */}
            <LoadingOverlay isLoading={actionLoading} message={loadingMessage} />

            <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate("/my-orders")}>
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">
                            {t(OrderMessages.TITLE)} #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                        </h1>
                        <div className="flex items-center gap-3 mt-2 text-muted-foreground">
                            <Badge variant="secondary" className="text-sm font-normal px-3 py-1">
                                {order.created_at ? format(new Date(order.created_at), "PPP") : t(OrderMessages.NA)}
                            </Badge>
                            <span>•</span>
                            <Badge
                                variant={['delivered', 'completed'].includes(order.status) ? 'default' :
                                    ['cancelled', 'returned'].includes(order.status) ? 'destructive' : 'secondary'}
                                className="text-sm capitalize px-3 py-1"
                            >
                                {t(`orderStatus.${order.status}`)}
                            </Badge>
                        </div>
                    </div>
                    <div className="ml-auto flex items-center gap-2">

                        {/* Dual Invoice Download Buttons */}
                        {/* 1. Payment Receipt (Razorpay) */}
                        {order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url && (
                            <Button variant="secondary" size="sm" onClick={() => window.open(order.invoices?.find(i => i.type === 'RAZORPAY')?.public_url, '_blank')}>
                                <FileText className="mr-2 h-4 w-4" /> {t(OrderMessages.RECEIPT)}
                            </Button>
                        )}

                        {/* 2. Tax Invoice (Internal) - Only show when an internal invoice exists */}
                        {((order.invoice_url && !order.invoice_url.includes('razorpay')) || getActiveInternalInvoice(order)) && (
                            <Button variant="outline" size="sm" onClick={() => {
                                // Prefer strict internal endpoint if available via order.invoice_url (set by orchestration)
                                // or fallback to constructing it if we have the ID from invoices array
                                const internalInv = getActiveInternalInvoice(order);
                                let url = null;

                                // 1. Priority: Trust the orchestrator-provided URL (handles strategy)
                                if (order.invoice_url && !order.invoice_url.includes('razorpay')) {
                                    url = order.invoice_url;
                                }
                                // 2. Fallback: Use invoices table entry (check public_url first for strategy compliance)
                                else if (internalInv) {
                                    url = internalInv.public_url || `/api/invoices/${internalInv.id}/download`;
                                }
                                if (url) {
                                    void openInvoiceDocument(url).catch((error) => {
                                        toast.error(getErrorMessage(error, t, "orderDetail.invoiceUnavailable"));
                                    });
                                }
                            }}>
                                <FileText className="mr-2 h-4 w-4" /> {t(OrderMessages.INVOICE)}
                            </Button>
                        )}

                        {/* Cancel Dialog */}
                        {canCancel && (
                            <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" size="sm">
                                        <XCircle className="mr-2 h-4 w-4" /> {t(OrderMessages.CANCEL_ORDER)}
                                    </Button>
                                </DialogTrigger>
                                <DialogContent>
                                    <DialogHeader>
                                        <DialogTitle>{t(OrderMessages.CANCEL_TITLE)}</DialogTitle>
                                        <DialogDescription>
                                            {t(OrderMessages.CANCEL_DESC)}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2 py-4">
                                        <Label>{t(OrderMessages.CANCEL_REASON)} <span className="text-red-500">*</span></Label>
                                        <Textarea
                                            placeholder={t(OrderMessages.CANCEL_PLACEHOLDER)}
                                            value={cancelReason}
                                            onChange={e => setCancelReason(e.target.value)}
                                        />
                                    </div>
                                    <DialogFooter>
                                        <Button variant="outline" onClick={() => setCancelOpen(false)}>{t(OrderMessages.KEEP_ORDER)}</Button>
                                        <Button variant="destructive" onClick={handleCancelOrder} disabled={actionLoading}>
                                            {actionLoading ? t(OrderMessages.CANCELLING) : t(OrderMessages.CONFIRM_CANCEL)}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}

                        {/* Return Dialog */}
                        {canReturn && (
                            <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
                                <Button
                                    size="sm"
                                    className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md hover:shadow-lg transition-all duration-200"
                                    onClick={handleOpenReturnDialog}
                                >
                                    <RotateCcw className="mr-2 h-4 w-4" /> {t(OrderMessages.REQUEST_RETURN)}
                                </Button>
                                <DialogContent className="sm:max-w-xl max-h-[90vh] flex flex-col">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-2 text-xl">
                                            <RotateCcw className="h-5 w-5 text-orange-500" />
                                            {t(OrderMessages.RETURN_TITLE)}
                                        </DialogTitle>
                                        <DialogDescription>
                                            {t(OrderMessages.RETURN_DESC)}
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="flex-1 overflow-y-auto pr-2 -mr-2 py-4 space-y-5">
                                        {/* Item Selection */}
                                        <div className="space-y-3">
                                            <Label className="text-sm font-semibold flex items-center gap-2">
                                                <Package className="h-4 w-4 text-muted-foreground" />
                                                {t(OrderMessages.SELECT_ITEMS)}
                                            </Label>
                                            <div className="rounded-lg border bg-muted/30 p-1 space-y-2">
                                                {returnableItems.length === 0 ? (
                                                    <div className="text-center py-8 text-muted-foreground">
                                                        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                                        <p className="text-sm">{t(OrderMessages.NO_RETURNABLE)}</p>
                                                    </div>
                                                ) : (
                                                    returnableItems.map((item: ReturnableItem) => {
                                                        const selected = selectedReturnItems.find(i => i.id === item.id);
                                                        const isSelected = !!selected;

                                                        return (
                                                            <div
                                                                key={item.id}
                                                                className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${isSelected
                                                                    ? 'bg-orange-50 border-orange-300 shadow-sm'
                                                                    : 'bg-white hover:bg-gray-50 border-gray-200'
                                                                    }`}
                                                                onClick={() => {
                                                                    handleReturnItemChange(
                                                                        item.id,
                                                                        !isSelected ? item.remaining_quantity : 0,
                                                                        item.remaining_quantity
                                                                    );
                                                                }}
                                                            >
                                                                <Checkbox
                                                                    id={`return-item-${item.id}`}
                                                                    checked={isSelected}
                                                                    onCheckedChange={(checked) => {
                                                                        handleReturnItemChange(
                                                                            item.id,
                                                                            checked ? item.remaining_quantity : 0,
                                                                            item.remaining_quantity
                                                                        );
                                                                    }}
                                                                    className={isSelected ? 'border-orange-500 data-[state=checked]:bg-orange-500' : ''}
                                                                />
                                                                <div className="flex-1">
                                                                    <p className="text-sm font-medium">
                                                                        {item.title}
                                                                        {item.variant_snapshot?.size_label && (
                                                                            <span className="text-muted-foreground font-normal ml-1">
                                                                                ({item.variant_snapshot.size_label})
                                                                            </span>
                                                                        )}
                                                                    </p>
                                                                    <div className="flex items-center flex-wrap gap-x-2 gap-y-0.5 mt-1">
                                                                        <span className="text-xs text-muted-foreground">{formatAmount(item.price_per_unit || 0)}</span>
                                                                        <span className="text-xs text-muted-foreground">•</span>
                                                                        <span className="text-xs text-muted-foreground">Max: {item.remaining_quantity}</span>
                                                                        {item.return_deadline && (
                                                                            <>
                                                                                <span className="text-xs text-muted-foreground">•</span>
                                                                                <span className="text-xs text-orange-600">
                                                                                    {t(OrderMessages.RETURN_BY)}: {format(new Date(item.return_deadline), "MMM d")}
                                                                                </span>
                                                                            </>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                {isSelected && (
                                                                    <div className="flex items-center gap-2 bg-white border rounded-lg p-1">
                                                                        <button
                                                                            type="button"
                                                                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleReturnItemChange(item.id, Math.max(1, (selected?.quantity || 1) - 1), item.remaining_quantity);
                                                                            }}
                                                                        >
                                                                            -
                                                                        </button>
                                                                        <span className="w-6 text-center text-sm font-medium">{selected?.quantity || 1}</span>
                                                                        <button
                                                                            type="button"
                                                                            className="w-7 h-7 flex items-center justify-center rounded hover:bg-gray-100 text-gray-600"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleReturnItemChange(item.id, Math.min(item.remaining_quantity, (selected?.quantity || 1) + 1), item.remaining_quantity);
                                                                            }}
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                            <p className="text-xs text-orange-600 flex items-center gap-1">
                                                <AlertTriangle className="h-3 w-3" />
                                                {t(OrderMessages.SELECT_ITEMS_REQUIRED)}
                                            </p>
                                        </div>



                                        {/* Dynamic Sections for Selected Items */}
                                        {selectedReturnItems.length > 0 && (
                                            <div className="space-y-4 border-t pt-4">
                                                <Label className="text-sm font-semibold">{t(OrderMessages.ITEM_CONDITION)}</Label>
                                                {selectedReturnItems.map(selectedItem => {
                                                    const itemDef = returnableItems.find(i => i.id === selectedItem.id);
                                                    if (!itemDef) return null;

                                                    return (
                                                        <div key={selectedItem.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 space-y-3">
                                                            <div className="font-medium text-sm flex justify-between">
                                                                <span>{itemDef.title}</span>
                                                                <Badge variant="outline">{t(OrderMessages.QTY)}: {selectedItem.quantity}</Badge>
                                                            </div>

                                                            {/* Reason */}
                                                            <div>
                                                                <Label className="text-xs text-muted-foreground mb-1 block">{t(OrderMessages.RETURN_REASON)} *</Label>
                                                                <Textarea
                                                                    placeholder={t(OrderMessages.REASON_PLACEHOLDER)}
                                                                    value={itemReasons[selectedItem.id] || ''}
                                                                    onChange={e => setItemReasons(prev => ({ ...prev, [selectedItem.id]: e.target.value }))}
                                                                    className="text-sm min-h-[60px] resize-none bg-white"
                                                                />
                                                            </div>

                                                            {/* Images */}
                                                            <div>
                                                                <Label className="text-xs text-muted-foreground mb-1 block">
                                                                    {t(OrderMessages.UPLOAD_IMAGES)} *
                                                                </Label>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {(itemImages[selectedItem.id] || []).map((file, idx) => (
                                                                        <div key={idx} className="relative w-16 h-16 border rounded bg-white overflow-hidden group">
                                                                            <img
                                                                                src={URL.createObjectURL(file)}
                                                                                className="w-full h-full object-cover"
                                                                                alt="preview"
                                                                            />
                                                                            <button
                                                                                onClick={() => removeImage(selectedItem.id, idx)}
                                                                                className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl opacity-0 group-hover:opacity-100 transition-opacity"
                                                                            >
                                                                                <X className="h-3 w-3" />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                    {(itemImages[selectedItem.id]?.length || 0) < 3 && (
                                                                        <label className="w-16 h-16 border-2 border-dashed border-gray-300 rounded flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors">
                                                                            <Upload className="h-4 w-4 text-gray-400" />
                                                                            <span className="text-[9px] text-gray-500 mt-1">{t(OrderMessages.ADD)}</span>
                                                                            <input
                                                                                type="file"
                                                                                accept="image/*"
                                                                                className="hidden"
                                                                                onChange={(e) => handleImageChange(selectedItem.id, e)}
                                                                            />
                                                                        </label>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        {/* Global Reason Input (Optional/Summary) */}
                                        <div className="space-y-2">
                                            <Label className="text-sm font-semibold">{t(OrderMessages.ADDITIONAL_COMMENTS)}</Label>
                                            <Textarea
                                                placeholder={t(OrderMessages.FEEDBACK_PLACEHOLDER)}
                                                value={returnReason}
                                                onChange={e => setReturnReason(e.target.value)}
                                                className="min-h-[60px] resize-none"
                                            />
                                        </div>
                                    </div>
                                    <DialogFooter className="gap-2 sm:gap-0 pt-4 border-t">
                                        <Button variant="ghost" onClick={() => setReturnOpen(false)}>
                                            {t(CommonMessages.CANCEL)}
                                        </Button>
                                        <Button
                                            className="bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600"
                                            onClick={handleReturnOrder}
                                            disabled={actionLoading || selectedReturnItems.length === 0}
                                        >
                                            {actionLoading ? (
                                                <>
                                                    <Loader2 className="animate-spin mr-2 h-4 w-4" />
                                                    {t(OrderMessages.SUBMITTING)}
                                                </>
                                            ) : (
                                                <>
                                                    <CheckCircle className="mr-2 h-4 w-4" />
                                                    {t(OrderMessages.SUBMIT_RETURN)}
                                                </>
                                            )}
                                        </Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        )}
                    </div>
                </div >

                {/* Delivery Unsuccessful Banner - shown to user */}
                {order.status === 'delivery_unsuccessful' && (
                    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
                        <div>
                            <p className="font-semibold text-amber-900 text-sm">
                                {t("orderStatus.delivery_unsuccessful_banner_title", "We couldn't deliver your order")}
                            </p>
                            <p className="text-sm text-amber-800 mt-1">
                                {t("orderStatus.delivery_unsuccessful_banner_desc", "We were unable to complete the delivery. Your order is on its way back to us. Once we receive it, we'll process a refund as per our return policy.")}
                            </p>
                            <p className="text-xs text-amber-600 font-medium mt-2">
                                {t("orderStatus.delivery_unsuccessful_banner_action", "Please check your order timeline below for more details.")}
                            </p>

                            {/* Show reason if available */}
                            {order.delivery_unsuccessful_reason && (
                                <p className="mt-3 text-xs text-amber-700 bg-amber-100/50 rounded-md px-2 py-1.5 border border-amber-200/50 inline-block">
                                    <span className="font-semibold">{t("orderStatus.delivery_unsuccessful_reason_label", "Reason:")}</span>{" "}
                                    <TranslatedText text={order.delivery_unsuccessful_reason} />
                                </p>
                            )}
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Left Column - Order Info */}
                    <div className="md:col-span-2 space-y-6">
                        {/* Items */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Package className="h-5 w-5" /> {t(OrderMessages.ITEMS)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-4">
                                    {(() => {
                                        // Calculate Non-Refundable Total to Bundle
                                        const refundableTotal = (order.items || []).reduce((sum: number, item) => {
                                            const snapshot = item.delivery_calculation_snapshot || {};
                                            if (snapshot.source !== 'global') {
                                                if (snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                                    return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                                } else if (snapshot.delivery_refund_policy === 'PARTIAL') {
                                                    const totalItemDelivery = (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                                    const nonRefComponent = (snapshot.non_refundable_delivery_charge || 0) + (snapshot.non_refundable_delivery_gst || 0);
                                                    return sum + (totalItemDelivery - nonRefComponent);
                                                }
                                            }
                                            return sum;
                                        }, 0);

                                        const deliveryTotal = (order.delivery_charge || 0) + (order.delivery_gst || 0);
                                        const nonRefundableTotalToBundle = Math.max(0, deliveryTotal - refundableTotal);

                                        // Total for pro-rating
                                        const itemsTotalAmount = order.items.reduce((sum, item) => sum + (item.quantity * (item.price_per_unit || item.product?.price || 0)), 0);

                                        return order.items.map((item, index) => {
                                            // Get variant size label and details
                                            const lang = i18n.language;
                                            const sizeLabel = item.variant?.size_label_i18n?.[lang] || item.variant?.size_label || item.size_label;
                                            const sizeValue = item.variant?.size_value;
                                            const unit = item.variant?.unit;
                                            const variantDesc = item.variant?.description_i18n?.[lang] || item.variant?.description;

                                            // Use variant image if available, otherwise use product image
                                            const displayImage = item.variant?.variant_image_url || (item as any).product_variants?.variant_image_url || item.product?.images?.[0] || (item as any).products?.images?.[0];

                                            // Calculate Bundled Price
                                            const rawUnitPrice = item.price_per_unit || item.product?.price || 0;
                                            const itemTotalRaw = item.quantity * rawUnitPrice;

                                            // Bundling logic removed for clarity, showing raw inclusive prices
                                            const bundledUnitPrice = rawUnitPrice;

                                            return (
                                                <div key={index} className="flex gap-4 items-start border-b pb-4 last:border-0 last:pb-0">
                                                    <div className="w-16 h-16 bg-muted rounded-md overflow-hidden">
                                                        {displayImage && (
                                                            <img
                                                                src={displayImage}
                                                                alt={getLocalizedContent(item.product, lang, 'title')}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="flex flex-col gap-1">
                                                            <div className="flex items-center gap-2">
                                                                <h4 className="font-medium">
                                                                    {getLocalizedContent(item.product, lang, 'title') || t(OrderMessages.ITEM)}
                                                                </h4>
                                                                {sizeLabel && (
                                                                    <Badge variant="secondary" className="text-xs font-normal">
                                                                        {sizeValue && (
                                                                            <span className="mr-1">
                                                                                {sizeValue} {unit} -
                                                                            </span>
                                                                        )}
                                                                        {sizeLabel}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                            {variantDesc && (
                                                                <p className="text-[10px] text-muted-foreground italic leading-tight">
                                                                    {variantDesc}
                                                                </p>
                                                            )}
                                                        </div>
                                                        <p className="text-sm text-muted-foreground">
                                                            {t(OrderMessages.QTY)}: {item.quantity} × {formatAmount(bundledUnitPrice)}
                                                            <span className="text-xs ml-2 text-muted-foreground/80">
                                                                ({(item.product?.price_includes_tax ?? item.product?.default_price_includes_tax ?? true) ? t(OrderMessages.INC_TAX) : t(OrderMessages.EXCL_TAX)})
                                                            </span>
                                                        </p>
                                                        {/* Base Price Display */}
                                                        {(() => {
                                                            const gstRate = item.gst_rate || item.product?.gstRate || item.product?.gst_rate || item.product?.default_gst_rate || 0;
                                                            const baseUnitPrice = gstRate > 0 ? bundledUnitPrice / (1 + gstRate / 100) : bundledUnitPrice;
                                                            return (
                                                                <p className="text-xs text-slate-500">
                                                                    {t(OrderMessages.BASE_PRICE)}: {formatAmount(baseUnitPrice)} ({t(OrderMessages.EXCL_TAX)})
                                                                </p>
                                                            );
                                                        })()}
                                                    </div>
                                                    <div className="text-right font-medium">
                                                        {formatAmount(item.quantity * bundledUnitPrice)}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                                <Separator className="my-4" />
                                <div className="space-y-2 text-sm">
                                    {(() => {
                                        const refundableTotal = (order.items || []).reduce((sum: number, item) => {
                                            const snapshot = item.delivery_calculation_snapshot || {};
                                            if (snapshot.source !== 'global') {
                                                if (snapshot.delivery_refund_policy === 'REFUNDABLE') {
                                                    return sum + (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                                } else if (snapshot.delivery_refund_policy === 'PARTIAL') {
                                                    const totalItemDelivery = (item.delivery_charge || 0) + (item.delivery_gst || 0);
                                                    const nonRefComponent = (snapshot.non_refundable_delivery_charge || 0) + (snapshot.non_refundable_delivery_gst || 0);
                                                    return sum + (totalItemDelivery - nonRefComponent);
                                                }
                                            }
                                            return sum;
                                        }, 0);

                                        const itemizedDeliveryGST = (order.items || []).reduce((sum, item) => sum + (Number(item.delivery_gst) || 0), 0);
                                        let effectiveDeliveryGST = Number(order.delivery_gst) || itemizedDeliveryGST;
                                        const subtotal = (order.items || []).reduce((sum: number, item) => sum + (item.quantity * (item.price_per_unit || item.product?.price || 0)), 0);

                                        // Fallback: If tax info is missing but total implies it exists (Total > Subtotal + Delivery)
                                        // This fixes display for legacy orders or where item.delivery_gst is stripped
                                        const deliveryBase = Number(order.delivery_charge) || 0;
                                        if (effectiveDeliveryGST === 0 && deliveryBase > 0) {
                                            const impliedTax = (order.total_amount || 0) + (order.coupon_discount || 0) - subtotal - deliveryBase;
                                            if (impliedTax > 0 && impliedTax < deliveryBase) { // Sanity check
                                                effectiveDeliveryGST = impliedTax;
                                            }
                                        }

                                        const deliveryTotal = deliveryBase + effectiveDeliveryGST;

                                        return (
                                            <>
                                                <div className="flex justify-between">
                                                    <span className="text-muted-foreground">{t(OrderMessages.SUBTOTAL)}</span>
                                                    <span>{formatAmount(subtotal)}</span>
                                                </div>
                                                {deliveryTotal > 0 && refundableTotal > 0 && (
                                                    <div className="flex justify-between mt-1">
                                                        <div className="text-muted-foreground flex items-center gap-1.5 pl-2 border-l-2 border-blue-500/30">
                                                            {t("products.refundableSurcharge", "Refundable Surcharge")}
                                                        </div>
                                                        <span className="text-muted-foreground">{formatAmount(refundableTotal)}</span>
                                                    </div>
                                                )}
                                                {deliveryTotal > 0 && (deliveryTotal - refundableTotal) > 0 && (
                                                    <div className="flex justify-between mt-1">
                                                        <div className="text-muted-foreground flex items-center gap-1.5 pl-2 border-l-2 border-orange-500/30">
                                                            <span>{t(OrderMessages.DELIVERY, "Delivery")} <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef", "Non-Refundable")})</span></span>
                                                        </div>
                                                        <span className="text-muted-foreground">{formatAmount(deliveryTotal - refundableTotal)}</span>
                                                    </div>
                                                )}
                                                {(order.coupon_discount ?? 0) > 0 && (
                                                    <div className="flex justify-between text-green-600 font-medium">
                                                        <span>{t(OrderMessages.DISCOUNT)}</span>
                                                        <span>-{formatAmount(order.coupon_discount ?? 0)}</span>
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                    <Separator className="my-2" />
                                    <div className="flex justify-between font-bold text-lg">
                                        <span>{t(OrderMessages.TOTAL)}</span>
                                        <span>{formatAmount(order.total_amount || 0)}</span>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        {/* Active/History Returns */}
                        {returns.length > 0 && (
                            <Card className="border-orange-100 shadow-sm overflow-hidden">
                                <CardHeader className="bg-orange-50/50">
                                    <div className="flex items-center justify-between">
                                        <CardTitle className="flex items-center gap-2 text-lg text-orange-950">
                                            <RotateCcw className="h-5 w-5 text-orange-600" /> {t(OrderMessages.RETURNS)}
                                        </CardTitle>
                                        <Badge variant="outline" className="bg-white border-orange-200 text-orange-800">
                                            {t(OrderMessages.REQUEST_COUNT, { count: returns.length })}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-orange-800/70">
                                        {t(OrderMessages.RETURNS_TRACK_DESC)}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="divide-y divide-orange-100">
                                        {returns.map((ret) => (
                                            <div key={ret.id} className="p-4 space-y-4">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <Badge variant={
                                                            ret.status === 'approved' ? 'default' :
                                                                ['picked_up', 'pickup_scheduled', 'item_returned'].includes(ret.status) ? 'outline' :
                                                                    ret.status === 'rejected' ? 'destructive' : 'secondary'
                                                        } className={`capitalize ${ret.status === 'approved' ? 'bg-green-600 text-white' :
                                                            ['picked_up', 'pickup_scheduled'].includes(ret.status) ? 'border-blue-500 text-blue-700 bg-blue-50' :
                                                                ret.status === 'item_returned' ? 'bg-green-50 text-green-700 border-green-200' : ''}`}>
                                                            {t(`orderStatus.${ret.status}`, { defaultValue: ret.status.replace(/_/g, ' ') })}
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">
                                                            Requested on {format(new Date(ret.created_at), "MMM d, yyyy")}
                                                        </span>
                                                    </div>
                                                    {ret.status === 'requested' && (
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 text-xs"
                                                            onClick={() => handleCancelReturn(ret.id)}
                                                            disabled={actionLoading}
                                                        >
                                                            {t(OrderMessages.CANCEL_REQUEST)}
                                                        </Button>
                                                    )}
                                                </div>

                                                {/* Informational Message about the new workflow */}
                                                {ret.status === 'approved' && (
                                                    <div className="bg-blue-50 border border-blue-100 rounded-md p-3 text-xs text-blue-800 flex items-start gap-2">
                                                        <Clock className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <p>
                                                            <strong>{t(OrderMessages.NEXT_STEP_PICKUP_TITLE)}</strong> {t(OrderMessages.NEXT_STEP_PICKUP)}
                                                        </p>
                                                    </div>
                                                )}
                                                {ret.status === 'picked_up' && (
                                                    <div className="bg-indigo-50 border border-indigo-100 rounded-md p-3 text-xs text-indigo-800 flex items-start gap-2">
                                                        <Truck className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <p>
                                                            <strong>{t(OrderMessages.ITEM_PICKED_UP_TITLE)}</strong> {t(OrderMessages.ITEM_PICKED_UP)}
                                                        </p>
                                                    </div>
                                                )}
                                                {ret.status === 'item_returned' && (
                                                    <div className="bg-green-50 border border-green-100 rounded-md p-3 text-xs text-green-800 flex items-start gap-2">
                                                        <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                        <p>
                                                            <strong>{t(OrderMessages.RETURNED_VERIFIED_TITLE)}</strong> {t(OrderMessages.RETURNED_VERIFIED)}
                                                        </p>
                                                    </div>
                                                )}

                                                <div className="space-y-2 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                                                    {ret.return_items.map((item, idx) => (
                                                        <div key={idx} className="flex justify-between text-xs items-center">
                                                            <span className="text-gray-600 flex items-center gap-2">
                                                                <span className="w-4 h-4 rounded bg-gray-200 flex items-center justify-center text-[10px] font-bold">{item.quantity}</span>
                                                                {item.order_items.title}
                                                                {item.order_items.variant_snapshot?.size_label && (
                                                                    <span className="text-muted-foreground">({item.order_items.variant_snapshot.size_label})</span>
                                                                )}
                                                            </span>
                                                            <span className="text-[10px] text-muted-foreground italic max-w-[150px] truncate" title={item.reason}>
                                                                "{item.reason}"
                                                            </span>
                                                        </div>
                                                    ))}
                                                    {(ret.status === 'approved' || ret.refund_amount > 0) && (
                                                        <div className="pt-2 mt-2 border-t border-dashed flex justify-between items-center">
                                                            <span className="text-[11px] font-semibold text-gray-700">{t(OrderMessages.REFUNDABLE_AMOUNT)}</span>
                                                            <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 text-xs py-0">
                                                                {formatAmount(ret.refund_amount)}
                                                            </Badge>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Order Timeline */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Clock className="h-5 w-5" /> {t(OrderMessages.HISTORY)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative border-l border-muted ml-2 space-y-6 pb-2 mt-2">
                                    {(() => {
                                        const historyItems = [...(order.order_status_history || [])];

                                        // Ensure "Order Placed" exists based on order creation date
                                        const hasPlaced = historyItems.some(h =>
                                            ['pending', 'ORDER_PLACED'].includes(h.status) ||
                                            h.event_type === 'ORDER_PLACED'
                                        );

                                        if (!hasPlaced && order.created_at) {
                                            historyItems.push({
                                                status: 'pending',
                                                event_type: 'ORDER_PLACED',
                                                created_at: order.created_at,
                                                notes: t(OrderMessages.ORDER_PLACED) || 'Order placed successfully.',
                                                actor: 'SYSTEM'
                                            });
                                        }

                                        const EVENT_WEIGHTS: Record<string, number> = {
                                            'ORDER_PLACED': 10,
                                            'ORDER_CONFIRMED': 20,
                                            'ORDER_PROCESSING': 30,
                                            'ORDER_PACKED': 40,
                                            'ORDER_SHIPPED': 50,
                                            'OUT_FOR_DELIVERY': 60,
                                            'ORDER_DELIVERED': 70,
                                            'DELIVERY_UNSUCCESSFUL': 80,
                                            'RETURN_REQUESTED': 90,
                                            'RETURN_APPROVED': 100,
                                            'PICKUP_SCHEDULED': 110,
                                            'RETURN_PICKED_UP': 120,
                                            'ITEM_RETURNED': 130,
                                            'PARTIALLY_RETURNED': 135,
                                            'ORDER_RETURNED': 140,
                                            'REFUND_INITIATED': 150,
                                            'REFUND_PARTIAL': 160,
                                            'REFUND_COMPLETED': 170,
                                            'RETURN_CANCELLED': 180,
                                            'RETURN_REJECTED': 190
                                        };

                                        return historyItems
                                            .slice()
                                            .sort((a, b) => {
                                                const dateA = new Date(a.created_at).getTime();
                                                const dateB = new Date(b.created_at).getTime();

                                                if (dateA !== dateB) {
                                                    return (isNaN(dateB) ? 0 : dateB) - (isNaN(dateA) ? 0 : dateA);
                                                }

                                                const weightA = EVENT_WEIGHTS[a.event_type || a.status] || 999;
                                                const weightB = EVENT_WEIGHTS[b.event_type || b.status] || 999;
                                                return weightB - weightA; // Higher weight = later event (descending order in UI)
                                            })
                                            .map((history, index) => {
                                                let formattedDate = "Date N/A";
                                                try {
                                                    formattedDate = format(new Date(history.created_at), "PPP p");
                                                } catch (e) { formattedDate = "Invalid Date"; }

                                                return (
                                                    <div key={index} className="ml-6 relative">
                                                        <span className="absolute -left-[1.65rem] top-1 h-3 w-3 rounded-full bg-primary border-2 border-background ring-2 ring-muted" />
                                                        <div className="font-medium text-sm capitalize flex items-center gap-2">
                                                            <span>{t(`orderStatus.${history.event_type || history.status}`) || (history.event_type || history.status || 'Updated').replace(/_/g, ' ')}</span>
                                                            {(history.event_type === 'REFUND_INITIATED' || history.event_type === 'REFUND_COMPLETED' || history.event_type === 'REFUND_PARTIAL' || history.event_type === 'ITEM_RETURNED' || history.status === 'refunded' || history.status === 'partially_refunded') && order.refunds?.some(r => {
                                                                try {
                                                                    return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 120000;
                                                                } catch { return false; }
                                                            }) && (
                                                                    <div className="flex items-center gap-1">
                                                                        <Badge variant="outline" className="text-[10px] h-5 font-normal border-green-200 bg-green-50 text-green-700">
                                                                            {formatAmount(order.refunds.find(r => {
                                                                                try {
                                                                                    return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 120000;
                                                                                } catch { return false; }
                                                                            })?.amount)}
                                                                        </Badge>
                                                                        {(() => {
                                                                            const ref = order.refunds.find(r => {
                                                                                try {
                                                                                    return Math.abs(new Date(r.created_at).getTime() - new Date(history.created_at).getTime()) < 120000;
                                                                                } catch { return false; }
                                                                            });
                                                                            return ref?.razorpay_refund_id && (
                                                                                <code className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 border border-slate-200">
                                                                                    {ref.razorpay_refund_id}
                                                                                </code>
                                                                            );
                                                                        })()}
                                                                    </div>
                                                                )}
                                                        </div>
                                                        <p className="text-xs text-muted-foreground mb-1">
                                                            {formattedDate}
                                                            {history.updater && (
                                                                <span className="ml-1">
                                                                    • {(history.updater.role_data?.name === 'admin' || history.updater.role_data?.name === 'manager') ? t(OrderMessages.STAFF) : t(OrderMessages.YOU)}
                                                                </span>
                                                            )}
                                                        </p>
                                                        {history.notes && (
                                                            <div className="bg-muted/50 p-2 rounded text-xs mt-1 text-gray-700 border border-muted">
                                                                {renderHistoryNote(history.notes)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )
                                            });
                                    })()}
                                    {(!order.order_status_history || order.order_status_history.length === 0) && (
                                        <p className="text-sm text-muted-foreground ml-6">{t(OrderMessages.NO_HISTORY)}</p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                    </div>

                    {/* Right Column - Info */}
                    <div className="space-y-6">
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" /> {t(OrderMessages.SHIPPING)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {order.shipping_address ? (
                                    <div className="space-y-1">
                                        <p className="font-medium"><TranslatedText text={order.shipping_address.full_name || ""} /></p>
                                        <p><TranslatedText text={order.shipping_address.address_line1 || ""} /></p>
                                        {order.shipping_address.address_line2 && <p><TranslatedText text={order.shipping_address.address_line2} /></p>}
                                        <p>
                                            {t(`locations.${order.shipping_address.city.toLowerCase()}`, order.shipping_address.city)}, {t(`locations.${order.shipping_address.state.toLowerCase()}`, order.shipping_address.state)} {order.shipping_address.postal_code}
                                        </p>
                                        <p>{t(`locations.${order.shipping_address.country.toLowerCase()}`, order.shipping_address.country)}</p>
                                        <div className="mt-2 pt-2 border-t">
                                            <p className="text-muted-foreground">{t(NavMessages.PHONE)}: <span className="text-foreground">{order.shipping_address.phone}</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic">{t(OrderMessages.ADDRESS_NOT_AVAILABLE)}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <MapPin className="h-5 w-5" /> {t(OrderMessages.BILLING)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="text-sm">
                                {order.billing_address ? (
                                    <div className="space-y-1">
                                        <p className="font-medium"><TranslatedText text={order.billing_address.full_name || ""} /></p>
                                        <p><TranslatedText text={order.billing_address.address_line1 || ""} /></p>
                                        {order.billing_address.address_line2 && <p><TranslatedText text={order.billing_address.address_line2} /></p>}
                                        <p>
                                            {t(`locations.${order.billing_address.city.toLowerCase()}`, order.billing_address.city)}, {t(`locations.${order.billing_address.state.toLowerCase()}`, order.billing_address.state)} {order.billing_address.postal_code}
                                        </p>
                                        <p>{t(`locations.${order.billing_address.country.toLowerCase()}`, order.billing_address.country)}</p>
                                        <div className="mt-2 pt-2 border-t">
                                            <p className="text-muted-foreground">{t(NavMessages.PHONE)}: <span className="text-foreground">{order.billing_address.phone}</span></p>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground italic">{t(OrderMessages.SAME_AS_SHIPPING)}</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard className="h-5 w-5" /> {t(OrderMessages.PAYMENT_INFO)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 gap-2 text-sm">
                                    <div>
                                        <span className="text-muted-foreground">{t(OrderMessages.STATUS)}:</span>
                                        <Badge variant={order.payment_status === 'paid' ? 'default' :
                                            (order.payment_status === 'refunded' || order.payment_status === 'partially_refunded') ? 'destructive' :
                                                order.payment_status === 'refund_initiated' ? 'outline' : 'secondary'}
                                            className="ml-2 uppercase">
                                            {t(`orderDetail.paymentStatus.${order.payment_status}`) || order.payment_status?.replace(/_/g, ' ')}
                                        </Badge>
                                        {order.payment_status === 'refund_initiated' && (
                                            <p className="text-xs text-orange-600 mt-1 font-medium">
                                                {t(OrderMessages.REFUND_INITIATED)}
                                            </p>
                                        )}
                                    </div>
                                    {order.payment_method && (
                                        <div>
                                            <span className="text-muted-foreground">{t(OrderMessages.PAYMENT_METHOD)}:</span>
                                            <p className="text-sm font-medium capitalize">{order.payment_method}</p>
                                        </div>
                                    )}
                                    <div>
                                        <span className="text-muted-foreground">{t(OrderMessages.PAYMENT_ID)}:</span>
                                        {order.payment_id && order.payment_id.startsWith('pay_') ? (
                                            <p className="font-mono text-xs mt-1 bg-muted p-1 rounded inline-block">{order.payment_id}</p>
                                        ) : (
                                            <p className="text-xs text-muted-foreground italic mt-1">
                                                {order.payment_id ? t(OrderMessages.SYSTEM_REFERENCE) : t(OrderMessages.NA)}
                                            </p>
                                        )}
                                    </div>

                                    {/* Refund Details */}
                                    {(order.payment_status === 'refund_initiated' || order.payment_status === 'refunded' || order.payment_status === 'partially_refunded' || (order.refunds && order.refunds.length > 0)) && (
                                        <div className="pt-2 border-t mt-2">
                                            <span className="text-muted-foreground text-xs block mb-1">{t(OrderMessages.REFUND_INFO)}:</span>
                                            {order.refunds && order.refunds.length > 0 ? (
                                                <>
                                                    <div className="space-y-1">
                                                        {order.refunds.map((r, idx) => (
                                                            <div key={idx} className="bg-red-50 p-1.5 rounded border border-red-100">
                                                                <div className="flex justify-between items-center text-xs">
                                                                    <span className="font-mono text-red-800">{r.razorpay_refund_id || r.id}</span>
                                                                    <span className="font-medium text-red-700">{formatAmount(r.amount)}</span>
                                                                </div>
                                                                {r.notes && (
                                                                    <p className="text-[10px] text-red-600/70 mt-0.5 italic pl-1 border-l border-red-200 ml-0.5">
                                                                        {t(OrderMessages.NOTE)}: {renderNote(r.notes as string)}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {order.payment_status !== 'refunded' && (
                                                        <p className="text-[10px] text-muted-foreground mt-2 px-1">
                                                            {t('paymentStatus.processedNotice', '(Refunds are typically processed within 5-7 business days)')}
                                                        </p>
                                                    )}
                                                </>
                                            ) : (
                                                <div className="bg-blue-50 p-2 rounded border border-blue-100 text-[10px] text-blue-700">
                                                    <p className="font-medium">{t(OrderMessages.REFUND_PROCESSING)}</p>
                                                    <p className="opacity-80">{t(OrderMessages.REFUND_PROCESSING_DESC)}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        {/* Tax Summary */}
                        {/* Tax Summary - Smart Handling for Legacy vs New Data */}
                        {(() => {
                            // Calculate stored tax sum logic
                            const storedTaxable = order.total_taxable_amount || 0;
                            const storedTax = (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0);
                            const storedSum = storedTaxable + storedTax;

                            // Calculate expected total including delivery
                            const deliveryCharge = order.delivery_charge || 0;
                            const totalAmount = order.total_amount || 0;

                            // Calculate effective delivery GST with fallbacks
                            const itemizedDeliveryGST = (order.items || []).reduce((sum, item) => sum + (Number(item.delivery_gst) || 0), 0);
                            let effectiveDeliveryGST = Number(order.delivery_gst) || itemizedDeliveryGST;

                            // Last resort: implied tax if tax info missing but amounts suggest it
                            if (effectiveDeliveryGST === 0 && deliveryCharge > 0) {
                                // Estimate product tax
                                const productTax = (order.items || []).reduce((sum, item) => {
                                    const qty = item.quantity || 1;
                                    const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
                                    const rawPrice = (item.price_per_unit || item.product?.price || 0) * qty;
                                    const taxable = rawPrice / (1 + (taxRate / 100));
                                    return sum + (rawPrice - taxable);
                                }, 0);

                                const totalRecordedTax = (order.total_cgst || 0) + (order.total_sgst || 0) + (order.total_igst || 0);
                                const gap = totalRecordedTax - productTax;
                                if (gap > 0 && gap < deliveryCharge) {
                                    effectiveDeliveryGST = gap; // Assume gap is delivery tax
                                }
                            }

                            // Check mismatch (Legacy: storedSum ~= ProductTotal vs TotalAmount ~= ProductTotal + Delivery)
                            const isLegacyMismatch = Math.abs(totalAmount - storedSum) > 1.0;

                            // If mismatch, we inject delivery components to make visual math work
                            // This ensures: Taxable (Product + Delivery) + Tax (Product + Delivery) = Grand Total
                            const effectiveTaxable = isLegacyMismatch ? (storedTaxable + deliveryCharge) : storedTaxable;

                            // For tax breakdown, we need to distribute delivery GST appropriately
                            // We don't know exact interstate status here easily provided by backend, 
                            // but we can infer or distribute evenly for display if needed.
                            // Simply adding to existing buckets is safest visual approximation.
                            // If IGST > 0, assume interstate. Else intrastate.
                            const isInterstate = (order.total_igst || 0) > 0;

                            return (
                                <TaxBreakdown
                                    totalTaxableAmount={effectiveTaxable}
                                    totalCgst={order.total_cgst}
                                    totalSgst={order.total_sgst}
                                    totalIgst={order.total_igst}
                                    totalAmount={totalAmount}
                                    showInvoiceLink={!!(order.invoice_url && !order.invoice_url.includes('razorpay')) || !!getActiveInternalInvoice(order)}
                                    invoiceUrl={(() => {
                                        const internalInv = getActiveInternalInvoice(order);
                                        let url = null;
                                        if (order.invoice_url && !order.invoice_url.includes('razorpay')) {
                                            url = order.invoice_url;
                                        } else if (internalInv) {
                                            url = internalInv.public_url || `/api/invoices/${internalInv.id}/download`;
                                        }
                                        return url || undefined;
                                    })()}
                                    items={order.items}
                                    deliveryCharge={deliveryCharge}
                                    deliveryGST={effectiveDeliveryGST}
                                    role="customer"
                                />
                            );
                        })()}
                    </div>
                </div>
            </div >
        </>
    );
}
