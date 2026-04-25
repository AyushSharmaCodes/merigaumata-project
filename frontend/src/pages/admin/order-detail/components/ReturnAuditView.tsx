import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    RotateCcw,
    CheckCircle2,
    XCircle,
    Clock,
    Info,
    Package,
    Undo2,
    ClipboardCheck,
    Truck,
    AlertCircle,
    X as CloseIcon,
    ZoomIn,
    RotateCw,
    Sprout,
    ArrowLeft,
} from 'lucide-react';
import { ReturnTimeline } from "@/components/orders/ReturnTimeline";
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/components/ui/use-toast";
import { 
    Select, 
    SelectContent, 
    SelectGroup, 
    SelectItem, 
    SelectLabel, 
    SelectTrigger, 
    SelectValue 
} from "@/components/ui/select";
import { RETURN_REJECTION_REASONS } from '../constants/returnRejectionReasons';
import type { Order, ReturnRequest, OrderStatusHistory } from "@/types";

const QCAuditForm = lazy(() => import('@/components/admin/QCAuditForm'));

import { 
    PickupAddressCard 
} from "@/pages/user/components/return-request/ReturnDetailCards";

interface ReturnAuditViewProps {
    order: Order;
    returnRequest: ReturnRequest;
    updating: boolean;
    onBack: () => void;
    onApprove: (returnId: string, notes?: string) => Promise<void>;
    onReject: (returnId: string, notes?: string) => Promise<void>;
    onMarkPickedUp: (returnId: string) => Promise<void>;
    onMarkReturned: (returnId: string) => Promise<void>;
    history: OrderStatusHistory[];
    onUpdateStatus: (returnId: string, status: string) => Promise<void>;
    onQCComplete?: (returnItemId: string, qcData: any) => Promise<void>;
}


// Statuses where the refund has been or is being processed
const REFUND_INITIATED_STATUSES = ['item_returned', 'qc_passed', 'partial_refund', 'return_completed', 'completed', 'refunded', 'partially_refunded'];

function normalizeRefundStatus(status?: string | null) {
    if (!status) return '';

    const normalized = String(status).trim().toUpperCase();
    if (['PROCESSED', 'COMPLETED', 'REFUNDED'].includes(normalized)) return 'processed';
    if (['CREATED', 'INITIATED', 'REFUND_INITIATED', 'PENDING', 'PROCESSING', 'RAZORPAY_PROCESSING'].includes(normalized)) return 'pending';
    if (normalized === 'FAILED') return 'failed';

    return normalized.toLowerCase();
}

export const ReturnAuditView: React.FC<ReturnAuditViewProps> = ({
    order,
    returnRequest,
    updating,
    onBack,
    onApprove,
    onReject,
    onMarkPickedUp,
    onMarkReturned,
    onUpdateStatus,
    onQCComplete,
    history,
}) => {
    const { t, i18n } = useTranslation();
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const [isRejectDialogOpen, setIsRejectDialogOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedRejectionKey, setSelectedRejectionKey] = useState<string>("");
    const [auditingItemId, setAuditingItemId] = useState<string | null>(null);

    if (!returnRequest) {
        return (
            <Card className="border border-[#ebe1d5] shadow-sm bg-white p-16 flex flex-col items-center justify-center gap-4 rounded-2xl">
                <AlertCircle className="h-8 w-8 text-amber-500" />
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{t("admin.orders.detail.return.dataUnavailable")}</p>
                <Button variant="outline" onClick={onBack} className="mt-2 text-xs">{t("admin.orders.detail.return.backToOrder")}</Button>
            </Card>
        );
    }

    const status = returnRequest.status?.toLowerCase() ?? 'requested';

    // 2. Find Linked Refund from Order (Moved up to prevent initialization errors)
    const linkedRefund = useMemo(() => {
        if (!order?.refunds) return null;
        // Match by return_id OR check metadata for a specific item link if return_id is missing
        return order.refunds.find(r => 
            r.return_id === returnRequest.id || 
            (r.metadata as any)?.return_item_id === returnRequest.return_items?.[0]?.id
        );
    }, [order?.refunds, returnRequest.id, returnRequest.return_items]);

    const normalizedLinkedRefundStatus = normalizeRefundStatus(linkedRefund?.status);
    const isRefundInitiated =
        REFUND_INITIATED_STATUSES.includes(status) ||
        (!!normalizedLinkedRefundStatus && normalizedLinkedRefundStatus !== 'failed');


    // Aggregate all proof images from return items
    const aggregatedImages = useMemo(() => {
        const images = returnRequest.return_items?.flatMap(item => item.images || []) ?? [];
        return [...new Set(images)].filter(Boolean);
    }, [returnRequest.return_items]);

    // Per-item financial calculations
    const itemBreakdowns = useMemo(() => {
        return (returnRequest.return_items || []).map(ri => {
            // Robust lookup: Prioritize the item from the main order object which has full joins and snapshots
            const orderItem: any = order?.items?.find(i => i.id === ri.order_item_id) || (Array.isArray(ri.order_items) ? ri.order_items[0] : ri.order_items);

            const pricePerUnit = orderItem?.price_per_unit ?? 0;
            const qty = ri.quantity ?? 1;

            const cgst = orderItem?.cgst ?? 0;
            const sgst = orderItem?.sgst ?? 0;
            const igst = orderItem?.igst ?? 0;
            const totalGst = cgst + sgst + igst;
            const gstPerUnit = qty > 0 ? totalGst / (orderItem?.quantity ?? qty) : 0;
            const taxableAmountPerUnit = orderItem?.taxable_amount ? orderItem.taxable_amount / (orderItem?.quantity ?? qty) : pricePerUnit - gstPerUnit;

            const totalItemDeliveryCharge = orderItem?.delivery_charge ?? 0;
            const totalItemDeliveryGst = orderItem?.delivery_gst ?? 0;

            const productSubtotal = taxableAmountPerUnit * qty;
            const gstAmount = gstPerUnit * qty;
            
            // Calculate non-refundable components based on snapshot
            let deliveryCharge = 0;
            let deliveryGst = 0;
            let nonRefundableDeliveryCharge = 0;
            let nonRefundableDeliveryGst = 0;

            const snapshot = orderItem?.delivery_calculation_snapshot || {};
            if (snapshot && typeof snapshot === 'object' && Object.keys(snapshot).length > 0 && snapshot.source !== 'global') {
                if (snapshot.delivery_refund_policy === 'REFUNDABLE') {
                    deliveryCharge = totalItemDeliveryCharge;
                    deliveryGst = totalItemDeliveryGst;
                } else if (snapshot.delivery_refund_policy === 'PARTIAL') {
                    nonRefundableDeliveryCharge = snapshot.non_refundable_delivery_charge ?? 0;
                    nonRefundableDeliveryGst = snapshot.non_refundable_delivery_gst ?? 0;
                    deliveryCharge = Math.max(0, totalItemDeliveryCharge - nonRefundableDeliveryCharge);
                    deliveryGst = Math.max(0, totalItemDeliveryGst - nonRefundableDeliveryGst);
                } else {
                    nonRefundableDeliveryCharge = totalItemDeliveryCharge;
                    nonRefundableDeliveryGst = totalItemDeliveryGst;
                }
            } else {
                // For global/standard delivery charges, we don't calculate them at the item level in the 'refundable' column yet.
                // They will be handled at the aggregate level if it's a final return.
                // However, we preserve the total values for reference.
                if (snapshot.source !== 'global') {
                    deliveryCharge = totalItemDeliveryCharge;
                    deliveryGst = totalItemDeliveryGst;
                }
            }
            
            const nonRefundableTotal = nonRefundableDeliveryCharge + nonRefundableDeliveryGst;
            const totalAmount = productSubtotal + gstAmount + deliveryCharge + deliveryGst;

            // Image + title resolution - Prioritize actual product image/snapshot
            const displayImage =
                orderItem?.image ||
                orderItem?.variant_snapshot?.variant_image_url ||
                orderItem?.product_snapshot?.main_image ||
                orderItem?.product_snapshot?.image ||
                orderItem?.product?.images?.[0];

            const itemTitle =
                ri.product_name ||
                orderItem?.title ||
                orderItem?.product?.title ||
                t('admin.orders.detail.common.product', 'Product');

            const productId = ri.order_item_id || orderItem?.product_id || orderItem?.id || '—';
            const sku = orderItem?.variant_snapshot?.sku || orderItem?.sku;
            const hsnCode = orderItem?.hsn_code || '—';
            const gstRate = orderItem?.gst_rate || 0;
            const variantLabel = orderItem?.variant_snapshot?.label || orderItem?.size_label || '';
            
            const igstValue = orderItem?.igst || 0;
            const cgstValue = orderItem?.cgst || 0;
            const sgstValue = orderItem?.sgst || 0;

            const igstPerUnit = qty > 0 ? igstValue / (orderItem?.quantity || qty) : 0;
            const cgstPerUnit = qty > 0 ? cgstValue / (orderItem?.quantity || qty) : 0;
            const sgstPerUnit = qty > 0 ? sgstValue / (orderItem?.quantity || qty) : 0;

            const isDeliveryRefundable = snapshot.delivery_refund_policy === 'REFUNDABLE';
            const isGlobalDelivery = snapshot.source === 'global';
            const deliveryMethod = snapshot.method || 'STANDARD';

            return {
                ri,
                orderItem,
                pricePerUnit,
                qty,
                productSubtotal,
                taxableAmountPerUnit,
                gstAmount,
                igstPerUnit,
                cgstPerUnit,
                sgstPerUnit,
                deliveryCharge,
                deliveryGst,
                nonRefundableDeliveryCharge,
                nonRefundableDeliveryGst,
                totalAmount,
                nonRefundableTotal,
                displayImage,
                itemTitle,
                productId,
                sku,
                hsnCode,
                gstRate,
                variantLabel,
                deliveryMethod,
                isDeliveryRefundable,
                isGlobalDelivery,
            };
        });
    }, [returnRequest.return_items, i18n.language, t]);

    const handleConfirmReject = async () => {
        let finalReason = "";
        
        if (selectedRejectionKey === "other") {
            finalReason = rejectionReason.trim();
        } else {
            // Find the reason label
            let foundLabel = "";
            for (const cat of RETURN_REJECTION_REASONS) {
                const r = cat.reasons.find(reason => reason.key === selectedRejectionKey);
                if (r) {
                    foundLabel = r.label;
                    break;
                }
            }
            
            finalReason = rejectionReason.trim() 
                ? `[${foundLabel}] ${rejectionReason.trim()}`
                : foundLabel;
        }

        if (!finalReason) return;
        
        try {
            await onReject(returnRequest.id, finalReason);
            setIsRejectDialogOpen(false);
            setRejectionReason("");
            setSelectedRejectionKey("");
        } catch (error) {
            // Error handling is managed by the parent toast
        }
    };

    // Check if this is a "Final Return" (all returnable items cleared)
    const isFinalReturn = useMemo(() => {
        if (!order?.items) return false;
        
        // Check every item in the order
        return order.items.every(oi => {
            const currentReturnItem = (returnRequest.return_items || []).find(ri => ri.order_item_id === oi.id);
            const returnQty = currentReturnItem?.quantity || 0;
            const previouslyReturned = (oi as any).returned_quantity || 0;
            
            // This is final if (previously returned + current return) >= total quantity
            return (previouslyReturned + returnQty) >= oi.quantity;
        });
    }, [order?.items, returnRequest.return_items]);

    // Helper to calculate the true Global (Order-level) delivery portion
    // In this system, order.delivery_charge is the TOTAL of all delivery charges.
    // To find the Global portion, we subtract all item-level surcharges.
    const globalDeliveryInfo = useMemo(() => {
        if (!order?.items) return { base: 0, gst: 0, total: 0, policy: 'NON_REFUNDABLE', isRefundable: false };
        
        const summedItemCharges = order.items.reduce((sum, oi) => sum + (oi.delivery_charge || 0), 0);
        const summedItemGst = order.items.reduce((sum, oi) => sum + (oi.delivery_gst || 0), 0);
        
        const globalBase = Math.max(0, (order.delivery_charge || 0) - summedItemCharges);
        const globalGst = Math.max(0, (order.delivery_gst || 0) - summedItemGst);
        
        const globalItem = order.items.find(oi => oi.delivery_calculation_snapshot?.source === 'global');
        const policy = globalItem?.delivery_calculation_snapshot?.delivery_refund_policy || 'NON_REFUNDABLE';
        
        return { 
            base: globalBase, 
            gst: globalGst, 
            total: globalBase + globalGst,
            policy,
            isRefundable: policy === 'REFUNDABLE'
        };
    }, [order?.items, order?.delivery_charge, order?.delivery_gst]);

    const isGlobalDeliveryRefundable = globalDeliveryInfo.isRefundable;

    // 1. Calculate Financial Totals
    const totals = useMemo(() => {
        const baseTotals = itemBreakdowns.reduce(
            (acc, bd) => ({
                productSubtotal: acc.productSubtotal + bd.productSubtotal,
                gstAmount: acc.gstAmount + bd.gstAmount,
                deliveryCharge: acc.deliveryCharge + bd.deliveryCharge,
                deliveryGst: acc.deliveryGst + bd.deliveryGst,
                nonRefundableDeliveryCharge: acc.nonRefundableDeliveryCharge + bd.nonRefundableDeliveryCharge,
                nonRefundableDeliveryGst: acc.nonRefundableDeliveryGst + bd.nonRefundableDeliveryGst,
                totalAmount: acc.totalAmount + bd.totalAmount,
                nonRefundableTotal: acc.nonRefundableTotal + bd.nonRefundableTotal,
            }),
            { 
                productSubtotal: 0, 
                gstAmount: 0, 
                deliveryCharge: 0, 
                deliveryGst: 0, 
                nonRefundableDeliveryCharge: 0,
                nonRefundableDeliveryGst: 0,
                totalAmount: 0, 
                nonRefundableTotal: 0 
            }
        );

        // Add Order-level Global Delivery if it's the final return AND it's refundable
        let finalDeliveryCharge = baseTotals.deliveryCharge;
        let finalDeliveryGst = baseTotals.deliveryGst;
        let globalDeliveryRefundable = 0;
        let globalDeliveryGstRefundable = 0;

        if (isFinalReturn && globalDeliveryInfo.isRefundable && globalDeliveryInfo.base > 0) {
            globalDeliveryRefundable = globalDeliveryInfo.base;
            globalDeliveryGstRefundable = globalDeliveryInfo.gst;
            
            finalDeliveryCharge += globalDeliveryRefundable;
            finalDeliveryGst += globalDeliveryGstRefundable;
        }

        return {
            ...baseTotals,
            deliveryCharge: finalDeliveryCharge,
            deliveryGst: finalDeliveryGst,
            globalDeliveryRefundable,
            globalDeliveryGstRefundable,
            globalTotal: globalDeliveryInfo.total,
            totalAmount: baseTotals.totalAmount + globalDeliveryRefundable + globalDeliveryGstRefundable
        };
    }, [itemBreakdowns, isFinalReturn, order, globalDeliveryInfo]);


    const refundAmount = returnRequest.refund_amount || returnRequest.refund_breakdown?.totalRefund || totals.totalAmount;

    // The customer's specific reason(s) from item level (joined if multiple)
    const itemReasons = useMemo(() => {
        const descriptions = (returnRequest.return_items || [])
            .map(ri => ri.reason)
            .filter(Boolean);
        return [...new Set(descriptions)];
    }, [returnRequest.return_items]);

    const reasonHeading = itemReasons.length > 0 ? itemReasons.join(' | ') : (returnRequest.reason || '—');

    // The customer's global description/summary
    const customerDescription = useMemo(() => {
        // If the global reason is different from the item reasons, show it here
        if (returnRequest.reason && !itemReasons.includes(returnRequest.reason)) {
            return returnRequest.reason;
        }
        return null;
    }, [returnRequest.reason, itemReasons]);

    return (
        <div className="space-y-6 font-sans animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Native Image Lightbox */}
            {lightboxImage && (
                <div
                    className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
                    onClick={() => setLightboxImage(null)}
                >
                    <div
                        className="relative max-w-3xl max-h-[90vh] w-full"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            className="absolute -top-3 -right-3 z-10 bg-white rounded-full p-1 shadow-lg hover:bg-slate-100 transition-colors"
                            onClick={() => setLightboxImage(null)}
                        >
                            <CloseIcon className="w-5 h-5 text-slate-700" />
                        </button>
                        <img
                            src={lightboxImage}
                            alt="Proof"
                            className="w-full h-full object-contain rounded-xl shadow-2xl"
                            style={{ maxHeight: '85vh' }}
                        />
                    </div>
                </div>
            )}

                <div className="flex items-center gap-3 mb-6">
                    <Button
                        variant="outline"
                        onClick={onBack}
                        className="bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl px-4 h-10 gap-2 shadow-sm transition-all duration-300"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="font-semibold text-sm">{t("admin.orders.detail.return.backToOrder", "Back to Order")}</span>
                    </Button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                    {/* ── LEFT COLUMN ── */}
                    <div className="lg:col-span-8 space-y-6">

                        {/* CARD 1: Return Request Overview */}
                        <Card className="border border-[#ebe1d5] shadow-sm bg-white rounded-2xl overflow-hidden">
                            <CardHeader className="p-6 pb-3 flex flex-row items-center justify-between border-none">
                                <div className="flex items-center gap-4">
                                    <CardTitle className="text-base font-semibold text-slate-800">
                                        Return Information — <span className="opacity-60">RTN-{returnRequest.id.split('-').pop()?.toUpperCase()}</span>
                                    </CardTitle>
                                </div>
                            <Badge className="bg-[#cca036] hover:bg-[#b89030] text-white rounded-md px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium border-none shadow-sm">
                                <ClipboardCheck className="w-3.5 h-3.5" />
                                {t(`orderStatus.${returnRequest.status}`, status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
                            </Badge>
                        </CardHeader>

                        <CardContent className="p-6 pt-2 space-y-5">
                            {/* Reason for Return (short heading) */}
                            <div className="bg-[#fcfaf5] border border-[#f3ead8] rounded-xl p-4">
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-1">
                                    {t("admin.orders.detail.return.reasonLabel", "Reason for Return")}
                                </div>
                                <div className="text-slate-800 font-semibold text-sm">
                                    {reasonHeading}
                                </div>
                            </div>

                            {/* Customer Description (detailed explanation) */}
                            <div>
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-2">
                                    {t("admin.orders.detail.return.customerDescription", "Customer Description")}
                                </div>
                                <p className="text-sm text-slate-600 leading-relaxed italic">
                                    "{customerDescription || t("admin.orders.detail.return.noDescription", "No additional description provided.")}"
                                </p>
                            </div>

                            {/* Uploaded Proof */}
                            <div>
                                <div className="text-[10px] text-slate-500 font-medium uppercase tracking-wider mb-3">
                                    {t("admin.orders.detail.return.uploadedProof", "Uploaded Proof")} ({aggregatedImages.length} {aggregatedImages.length === 1 ? t("common.image", "Image") : t("common.images", "Images")})
                                </div>
                                <div className="flex gap-3 flex-wrap">
                                    {aggregatedImages.length === 0 ? (
                                        <div className="py-6 px-8 border border-dashed border-slate-200 bg-slate-50 rounded-xl text-xs text-slate-400 font-medium flex items-center gap-3">
                                            <Package className="w-4 h-4 opacity-50" />
                                            {t("admin.orders.detail.return.noProof", "No proof images provided")}
                                        </div>
                                    ) : (
                                        aggregatedImages.map((img, i) => (
                                            <div
                                                key={i}
                                                className="relative w-28 h-28 shrink-0 rounded-xl overflow-hidden border border-slate-200 cursor-pointer shadow-sm hover:ring-2 hover:ring-[#cca036]/40 transition-all group"
                                                onClick={() => setLightboxImage(img)}
                                            >
                                                <img src={img} className="w-full h-full object-cover" alt={`Proof ${i + 1}`} />
                                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                    <ZoomIn className="w-5 h-5 text-white" />
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* ── STATUS-BASED ACTION BUTTONS ── */}
                            {status === 'requested' && (
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button
                                        className="flex-1 bg-[#42a053] hover:bg-[#368544] text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onApprove(returnRequest.id)}
                                        disabled={updating}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {t("admin.orders.actions.approveReturn", "Approve Return")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="flex-1 bg-[#fdf4f4] hover:bg-[#fbe8e8] border-[#f0d5d5] text-red-700 rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => setIsRejectDialogOpen(true)}
                                        disabled={updating}
                                    >
                                        <XCircle className="w-4 h-4" />
                                        {t("admin.orders.actions.rejectReturn", "Reject Return")}
                                    </Button>
                                </div>
                            )}

                            {(status === 'approved' || status === 'return_approved' || status === 'pickup_attempted') && (
                                <div className="pt-2">
                                    <Button
                                        className="w-full bg-[#1a6fc4] hover:bg-[#155ea0] text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onUpdateStatus(returnRequest.id, 'pickup_scheduled')}
                                        disabled={updating}
                                    >
                                        <Clock className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.schedulePickup", "Schedule Pickup")}
                                    </Button>
                                </div>
                            )}

                            {(status === 'pickup_scheduled') && (
                                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                                    <Button
                                        className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onUpdateStatus(returnRequest.id, 'pickup_attempted')}
                                        disabled={updating}
                                    >
                                        <AlertCircle className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.markAttempted", "Record Pickup Attempt")}
                                    </Button>
                                    <Button
                                        className="flex-1 bg-[#42a053] hover:bg-[#368544] text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onUpdateStatus(returnRequest.id, 'pickup_completed')}
                                        disabled={updating}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.markCompleted", "Record Pickup Completion")}
                                    </Button>
                                </div>
                            )}

                            {(status === 'pickup_attempted') && (
                                <div className="flex flex-col gap-3 pt-2 mt-2">
                                    <Button
                                        className="w-full bg-[#42a053] hover:bg-[#368544] text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onUpdateStatus(returnRequest.id, 'pickup_completed')}
                                        disabled={updating}
                                    >
                                        <CheckCircle2 className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.markCompleted", "Record Pickup Completion")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        className="w-full bg-[#fdf4f4] hover:bg-[#fbe8e8] border-[#f0d5d5] text-red-700 rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onUpdateStatus(returnRequest.id, 'pickup_failed')}
                                        disabled={updating}
                                    >
                                        <XCircle className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.markPickupFailed", "Mark Pickup Failed")}
                                    </Button>
                                </div>
                            )}

                            {(status === 'pickup_completed') && (
                                <div className="pt-2">
                                    <Button
                                        className="w-full bg-[#1a6fc4] hover:bg-[#155ea0] text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onMarkPickedUp(returnRequest.id)}
                                        disabled={updating}
                                    >
                                        <Truck className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.markingPickedUp")}
                                    </Button>
                                </div>
                            )}

                            {(status === 'picked_up' || status === 'return_picked_up') && (
                                <div className="pt-2">
                                    <Button
                                        className="w-full bg-[#42a053] hover:bg-[#368544] text-white rounded-lg h-11 text-sm font-medium shadow-sm transition-colors flex items-center justify-center gap-2"
                                        onClick={() => onMarkReturned(returnRequest.id)}
                                        disabled={updating}
                                    >
                                        <RotateCcw className="w-4 h-4" />
                                        {t("admin.orders.detail.actions.markingItemReturned")}
                                    </Button>
                                </div>
                            )}

                            {status === 'qc_initiated' && (
                                <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-5 space-y-4">
                                    <div className="flex items-center gap-3 text-indigo-700">
                                        <div className="p-2 bg-white rounded-lg shadow-sm">
                                            <ClipboardCheck className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold">{t("admin.orders.detail.return.awaitingAudit")}</h4>
                                            <p className="text-[10px] opacity-70 font-medium">{t("admin.orders.detail.return.auditVerifyHint")}</p>
                                        </div>
                                    </div>
                                    <Button
                                        className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg h-11 text-sm font-bold shadow-lg shadow-indigo-200 transition-all flex items-center justify-center gap-2"
                                        onClick={() => setAuditingItemId(returnRequest.return_items?.[0]?.id || null)}
                                        disabled={updating}
                                    >
                                        <ZoomIn className="w-4 h-4" />
                                        {t("admin.orders.detail.audit.cta")}
                                    </Button>
                                </div>
                            )}

                            {['qc_failed', 'zero_refund', 'return_to_customer', 'dispose_liquidate'].includes(status) && (
                                <div className="flex items-center gap-3 bg-amber-50 border border-amber-100 rounded-xl p-4 text-amber-800">
                                    <AlertCircle className="w-5 h-5 shrink-0" />
                                    <p className="text-sm font-medium">
                                        {t(`orderStatus.${status}`, status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))}
                                    </p>
                                </div>
                            )}

                            {isRefundInitiated && (
                                <div className="flex items-center gap-3 bg-[#eaf1ea] border border-[#d2e4d5] rounded-xl p-4 text-[#358241]">
                                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                                    <p className="text-sm font-medium">{t("admin.orders.detail.return.statusMessages.refundProcessed")}</p>
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* NEW: Pickup Address Card for Admin Visibility */}
                    <PickupAddressCard order={order} />

                    {/* CARD 2: Returned Items */}
                    <Card className="border border-[#ebe1d5] shadow-sm bg-white rounded-2xl overflow-hidden">
                        <CardHeader className="p-6 pb-4 border-none">
                            <CardTitle className="text-base font-semibold text-slate-800">
                                {t("admin.orders.detail.orderItems.title")}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 pt-0 space-y-3">
                            {itemBreakdowns.length === 0 ? (
                                <div className="py-8 text-center text-xs text-slate-400 font-medium">
                                    {t("admin.orders.detail.return.noItems", "No items found in this return request.")}
                                </div>
                            ) : (
                                itemBreakdowns.map((bd, idx) => (
                                    <div key={idx} className="relative p-6 rounded-2xl border border-[#e6d0a7] bg-[#fbfaf6] space-y-4">
                                        {/* Golden bar */}
                                        <div className="absolute left-0 top-6 bottom-6 w-1 bg-[#cca036] rounded-r-md" />

                                        <div className="flex items-start justify-between gap-4 pl-3">
                                            <div className="flex items-start gap-4 flex-1 min-w-0">
                                                <div className="w-16 h-16 rounded-xl border border-slate-200 overflow-hidden bg-white shrink-0 shadow-sm">
                                                    {bd.displayImage ? (
                                                        <img src={bd.displayImage} className="w-full h-full object-cover" alt="Product" />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center">
                                                            <Package className="w-6 h-6 text-slate-300" />
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="space-y-1 min-w-0">
                                                    <div className="flex items-center gap-2 flex-wrap">
                                                        <h4 className="font-bold text-lg text-slate-800 leading-tight">{bd.itemTitle}</h4>
                                                        {bd.variantLabel && (
                                                            <Badge className="bg-[#42a053] hover:bg-[#42a053] text-white border-none rounded-full px-3 text-[10px] font-bold">
                                                                {bd.variantLabel}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-slate-500 font-medium">100 x 100 cm</div>
                                                    <div className="text-sm text-slate-700 font-medium pt-1">
                                                        {t("admin.orders.detail.orderItems.qty")}: {bd.qty} × ₹{bd.pricePerUnit.toFixed(2)} <span className="text-slate-400 font-normal">({t("admin.orders.detail.orderItems.incTax")})</span>
                                                    </div>
                                                    <div className="text-sm text-slate-500">
                                                        {t("admin.orders.detail.orderItems.basePrice")}: ₹{(bd.taxableAmountPerUnit * bd.qty).toFixed(2)} <span className="text-slate-400 font-normal">({t("admin.orders.detail.orderItems.excTax")})</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <div className="font-bold text-xl text-slate-900">₹{(bd.pricePerUnit * bd.qty).toFixed(2)}</div>
                                            </div>
                                        </div>

                                        <div className="pl-3 space-y-1">
                                            <div className="text-sm text-slate-600 flex items-center gap-2">
                                                GST: {bd.gstRate}% <span className="text-slate-400">(HSN: {bd.hsnCode})</span>
                                            </div>
                                            {bd.igstPerUnit > 0 ? (
                                                <div className="text-sm text-slate-600">IGST: ₹{(bd.igstPerUnit * bd.qty).toFixed(2)}</div>
                                            ) : (
                                                <div className="text-sm text-slate-600">
                                                    CGST: ₹{(bd.cgstPerUnit * bd.qty).toFixed(2)} | SGST: ₹{(bd.sgstPerUnit * bd.qty).toFixed(2)}
                                                </div>
                                            )}
                                        </div>

                                        {/* DELIVERY DETAILS BOX */}
                                        {(bd.deliveryCharge + bd.deliveryGst > 0) && (
                                            <div className="mx-3 p-4 rounded-xl border border-dashed border-[#e6d0a7] bg-white/50 space-y-3">
                                                <div className="flex items-center gap-2 text-[10px] font-bold text-orange-800 uppercase tracking-widest">
                                                    <Truck className="w-3.5 h-3.5" />
                                                    {t("admin.orders.detail.orderItems.deliveryDetails")}
                                                </div>
                                                <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">{t("admin.orders.detail.orderItems.method")}:</span>
                                                        <span className="font-bold text-slate-700 uppercase">{bd.deliveryMethod}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">{t("admin.orders.detail.orderItems.charge")}:</span>
                                                        <span className="font-bold text-slate-700">₹{bd.deliveryCharge.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center text-sm">
                                                        <span className="text-slate-500">GST (18%):</span>
                                                        <span className="font-bold text-slate-700">₹{bd.deliveryGst.toFixed(2)}</span>
                                                    </div>
                                                    <div className="flex justify-center md:justify-end items-center">
                                                        {bd.isDeliveryRefundable ? (
                                                            <span className="text-[11px] font-bold text-[#42a053] uppercase tracking-wider bg-green-50 px-2 py-1 rounded-md">{t("admin.orders.detail.tax.refundable")}</span>
                                                        ) : (
                                                            <span className="text-[11px] font-bold text-orange-600 uppercase tracking-wider bg-orange-50 px-2 py-1 rounded-md">{t("admin.orders.detail.taxAudit.nonRefundable")}</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        <div className="pl-3 flex items-center justify-between pt-2">
                                            <Badge className="bg-[#f7eed6] hover:bg-[#f7eed6] text-[#b89030] border-[#ecdcb0] text-[10px] font-bold uppercase px-3 py-1 shadow-none tracking-widest">
                                                {t("admin.orders.detail.return.refundInitiated")}
                                            </Badge>
                                            <div className="text-[11px] font-bold text-[#cca036] uppercase tracking-widest">{t("admin.orders.detail.return.pendingRefundApproval")}</div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* ── RIGHT COLUMN ── */}
                <div className="lg:col-span-4 space-y-5">

                    {/* FINANCIAL CARD — changes based on refund status */}
                    {isRefundInitiated ? (
                        /* AFTER refund: show "Refund Initiated" card */
                        <Card className="border border-[#e1d5c5] shadow-sm bg-[#f4ebe1] rounded-2xl overflow-hidden">
                            <CardHeader className="p-6 pb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-[#42a053] rounded-full text-white shadow-sm">
                                        <RotateCcw className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <CardTitle className="text-sm font-bold text-slate-800">{t("admin.orders.detail.return.refundInitiated")}</CardTitle>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <div className="text-[10px] font-medium text-slate-500 font-mono tracking-wide">
                                                ID: {linkedRefund?.razorpay_refund_id || "PROCESSING..."}
                                            </div>
                                            {linkedRefund?.status && (
                                                <Badge className={`text-[9px] h-4 px-1.5 font-bold uppercase tracking-tighter ${
                                                    normalizedLinkedRefundStatus === 'processed' 
                                                        ? 'bg-green-100 text-green-700 border-green-200' 
                                                        : 'bg-orange-100 text-orange-700 border-orange-200'
                                                }`}>
                                                    {normalizedLinkedRefundStatus || linkedRefund.status}
                                                </Badge>
                                            )}
                                            
                                            {/* Emergency Manual Sync */}
                                            {linkedRefund && normalizedLinkedRefundStatus !== 'processed' && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button 
                                                            className="text-slate-400 hover:text-[#cca036] transition-colors"
                                                            onClick={async () => {
                                                                try {
                                                                    // We call the order update status with the same status to trigger a backend re-aggregation/sync
                                                                    await onUpdateStatus(returnRequest.id, returnRequest.status);
                                                                    toast({ title: "Syncing with Gateway...", variant: "default" });
                                                                } catch (e) {
                                                                    toast({ title: "Sync failed", variant: "destructive" });
                                                                }
                                                            }}
                                                        >
                                                            <RotateCw className="w-3 h-3" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="right">
                                                        <p className="text-[10px]">{t("admin.orders.detail.return.emergencySync")}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="p-6 pt-3 space-y-4">
                                <div className="space-y-4">
                                    {/* Gross Value Section */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t("admin.orders.detail.return.breakdown.grossValue", "Gross Associated Value")}</div>
                                        
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">{t("admin.orders.detail.return.breakdown.productGross", "Product Amount (Incl. Tax)")}</span>
                                            <span className="font-semibold text-slate-800">₹{(totals.productSubtotal + totals.gstAmount).toFixed(2)}</span>
                                        </div>
                                        
                                        {/* Per-item delivery portion */}
                                        {(totals.deliveryCharge + totals.deliveryGst + totals.nonRefundableTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable)) > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">{t("admin.orders.detail.return.breakdown.itemDeliveryGross", "Per-Item Delivery Portion")}</span>
                                                <span className="font-semibold text-slate-800">₹{(totals.deliveryCharge + totals.deliveryGst + totals.nonRefundableTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable)).toFixed(2)}</span>
                                            </div>
                                        )}

                                        {/* Global/Standard portion */}
                                        {totals.globalTotal > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">{t("admin.orders.detail.return.breakdown.globalDeliveryGross", "Global Logistics Fee")}</span>
                                                <span className="font-semibold text-slate-800">₹{totals.globalTotal.toFixed(2)}</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between items-center text-sm pt-1 border-t border-[#e4dacb]/60 mt-1">
                                            <span className="font-bold text-slate-700">{t("admin.orders.detail.return.breakdown.subtotalPaid", "Total Amount Customer Paid")}</span>
                                            <span className="font-bold text-slate-900">₹{(totals.productSubtotal + totals.gstAmount + totals.deliveryCharge + totals.deliveryGst + totals.nonRefundableTotal + (totals.globalTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable))).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Deductions Section */}
                                    {(totals.nonRefundableTotal > 0 || (totals.globalTotal > 0 && !globalDeliveryInfo.isRefundable)) && (
                                        <div className="space-y-2 pt-2">
                                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">{t("admin.orders.detail.return.breakdown.deductions", "Non-Refundable Deductions")}</div>
                                            
                                            {totals.nonRefundableTotal > 0 && (
                                                <div className="flex justify-between items-center text-sm text-rose-600">
                                                    <span>{t("admin.orders.detail.return.breakdown.itemLogisticsDeduction", "Item Delivery Fees (Non-Ref.)")}</span>
                                                    <span className="font-bold">-₹{totals.nonRefundableTotal.toFixed(2)}</span>
                                                </div>
                                            )}

                                            {totals.globalTotal > 0 && !globalDeliveryInfo.isRefundable && (
                                                <div className="flex justify-between items-center text-sm text-rose-600">
                                                    <span>{t("admin.orders.detail.return.breakdown.globalLogisticsDeduction", "Global Logistics Fee (Non-Ref.)")}</span>
                                                    <span className="font-bold">-₹{totals.globalTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Final Return Note for Global Delivery */}
                                    {isFinalReturn && order?.delivery_charge > 0 && (
                                        <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex gap-2">
                                            <Info className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
                                            <p className="text-[10px] text-blue-800/80 font-medium leading-relaxed">
                                                {t("admin.orders.detail.return.breakdown.finalReturnGlobalIncl", { amount: (order.delivery_charge + (order.delivery_gst || 0)).toFixed(2) })}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Separator className="bg-[#e4dacb]" />

                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-base">{t("admin.orders.detail.payment.totalRefundAmount", "Total Refund Amount")}</span>
                                        <span className="text-[9px] text-slate-500 font-medium">{t("admin.orders.detail.return.breakdown.settlementNote", "Credited to original source")}</span>
                                    </div>
                                    <span className="text-2xl font-black text-[#2B8441]">₹{(refundAmount || totals.totalAmount).toFixed(2)}</span>
                                </div>

                                <div className="bg-[#eaf1ea] border border-[#d2e4d5] rounded-xl p-3.5 flex gap-3 text-[#358241]">
                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p className="text-[10px] leading-relaxed font-medium">
                                        {order.payment_method === 'cod'
                                            ? t("admin.orders.detail.payment.manualSettlementDesc", "Manual settlement required. Bank transfer to be processed separately.")
                                            : t("admin.orders.detail.payment.gatewayRefundDesc", "Razorpay payment settled to original source. Expected arrival in 3-5 business days.")}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : (
                        /* BEFORE refund: show full breakdown */
                        <Card className="border border-[#e1d5c5] shadow-sm bg-[#f4ebe1] rounded-2xl overflow-hidden">
                            <CardHeader className="p-6 pb-3">
                                <CardTitle className="text-sm font-bold text-slate-800">Refund Breakdown</CardTitle>
                                <p className="text-[10px] text-slate-500 font-medium mt-1">
                                    {t("admin.orders.detail.return.breakdown.subtitle", "Estimated refund based on current item condition and policies.")}
                                </p>
                            </CardHeader>
                            <CardContent className="p-6 pt-2 space-y-4">
                                <div className="space-y-4">
                                    {/* Gross Value Section */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">{t("admin.orders.detail.return.breakdown.grossValue", "Gross Associated Value")}</div>
                                        
                                        <div className="flex justify-between items-center text-sm">
                                            <span className="text-slate-600">{t("admin.orders.detail.return.breakdown.productGross", "Product Amount (Incl. Tax)")}</span>
                                            <span className="font-semibold text-slate-800">₹{(totals.productSubtotal + totals.gstAmount).toFixed(2)}</span>
                                        </div>
                                        
                                        {/* Per-item delivery portion */}
                                        {(totals.deliveryCharge + totals.deliveryGst + totals.nonRefundableTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable)) > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">{t("admin.orders.detail.return.breakdown.itemDeliveryGross", "Per-Item Delivery Portion")}</span>
                                                <span className="font-semibold text-slate-800">₹{(totals.deliveryCharge + totals.deliveryGst + totals.nonRefundableTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable)).toFixed(2)}</span>
                                            </div>
                                        )}

                                        {/* Global/Standard portion */}
                                        {totals.globalTotal > 0 && (
                                            <div className="flex justify-between items-center text-sm">
                                                <span className="text-slate-600">{t("admin.orders.detail.return.breakdown.globalDeliveryGross", "Global Logistics Fee")}</span>
                                                <span className="font-semibold text-slate-800">₹{totals.globalTotal.toFixed(2)}</span>
                                            </div>
                                        )}
                                        
                                        <div className="flex justify-between items-center text-sm pt-1 border-t border-[#e4dacb]/60 mt-1">
                                            <span className="font-bold text-slate-700">{t("admin.orders.detail.return.breakdown.subtotalPaid", "Total Amount Customer Paid")}</span>
                                            <span className="font-bold text-slate-900">₹{(totals.productSubtotal + totals.gstAmount + totals.deliveryCharge + totals.deliveryGst + totals.nonRefundableTotal + (totals.globalTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable))).toFixed(2)}</span>
                                        </div>
                                    </div>

                                    {/* Deductions Section */}
                                    {(totals.nonRefundableTotal > 0 || (totals.globalTotal > 0 && !isFinalReturn) || (totals.globalTotal > 0 && !globalDeliveryInfo.isRefundable)) && (
                                        <div className="space-y-2 pt-2">
                                            <div className="text-[10px] font-bold text-rose-500 uppercase tracking-wider mb-1">{t("admin.orders.detail.return.breakdown.deductions", "Non-Refundable Deductions")}</div>
                                            
                                            {/* Item-level deductions */}
                                            {totals.nonRefundableTotal > 0 && (
                                                <div className="flex justify-between items-center text-sm text-rose-600">
                                                    <span>{t("admin.orders.detail.return.breakdown.itemLogisticsDeduction", "Item Delivery Fees (Non-Ref.)")}</span>
                                                    <span className="font-bold">-₹{totals.nonRefundableTotal.toFixed(2)}</span>
                                                </div>
                                            )}

                                            {/* Global deduction (if not refundable or held) */}
                                            {(totals.globalTotal > 0 && (!isFinalReturn || !globalDeliveryInfo.isRefundable)) && (
                                                <div className="flex justify-between items-center text-sm text-rose-600">
                                                    <span>{t("admin.orders.detail.return.breakdown.globalLogisticsDeduction", "Global Logistics Fee (Non-Ref.)")}</span>
                                                    <span className="font-bold">-₹{(totals.globalTotal - (totals.globalDeliveryRefundable + totals.globalDeliveryGstRefundable)).toFixed(2)}</span>
                                                </div>
                                            )}

                                            {totals.globalTotal > 0 && !isFinalReturn && globalDeliveryInfo.isRefundable && (
                                                <div className="flex justify-between items-center text-[10px] text-slate-500 bg-white/40 p-2 rounded-lg border border-dashed border-slate-200 mt-1">
                                                    <div className="flex gap-2">
                                                        <Info className="w-3 h-3 shrink-0 mt-0.5" />
                                                        <span className="leading-tight">
                                                            {t("admin.orders.detail.return.breakdown.globalDeliveryHold", "Global Fee held until final return")}
                                                        </span>
                                                    </div>
                                                    <span className="font-semibold">₹{totals.globalTotal.toFixed(2)}</span>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Final Return Note for Global Delivery */}
                                    {isFinalReturn && totals.globalTotal > 0 && globalDeliveryInfo.isRefundable && (
                                        <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100 flex gap-2">
                                            <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0 mt-0.5">
                                                <CheckCircle2 className="w-2.5 h-2.5 text-white" />
                                            </div>
                                            <p className="text-[10px] text-emerald-800/80 font-medium leading-relaxed">
                                                {t("admin.orders.detail.return.breakdown.finalReturnGlobalIncl", { amount: totals.globalTotal.toFixed(2) })}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <Separator className="bg-[#e4dacb]" />

                                <div className="flex justify-between items-center">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-800 text-base">{t("admin.orders.detail.return.breakdown.expectedRefund", "Expected Refund Amount")}</span>
                                        <span className="text-[9px] text-slate-500 font-medium">{t("admin.orders.detail.return.breakdown.settlementNote", "To be credited to original source")}</span>
                                    </div>
                                    <span className="text-2xl font-black text-[#2B8441]">₹{totals.totalAmount.toFixed(2)}</span>
                                </div>

                                <div className={`rounded-xl p-3.5 flex gap-3 ${
                                    isRefundInitiated 
                                        ? "bg-green-50 border border-green-200 text-green-700" 
                                        : (status === 'approved' || status === 'return_approved' || status === 'picked_up' || status === 'return_picked_up')
                                            ? "bg-blue-50 border border-blue-200 text-blue-700"
                                            : "bg-amber-50 border border-amber-200 text-amber-700"
                                }`}>
                                    <Info className="w-4 h-4 shrink-0 mt-0.5" />
                                    <p className="text-[10px] leading-relaxed font-medium">
                                        {isRefundInitiated 
                                            ? t("admin.orders.detail.return.statusMessages.refundProcessed")
                                            : (status === 'approved' || status === 'return_approved' || status === 'picked_up' || status === 'return_picked_up')
                                                ? t("admin.orders.detail.return.statusMessages.returnApprovedSettlement")
                                                : t("admin.orders.detail.return.statusMessages.refundPendingApproval")}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* ORDER HISTORY */}
                    <ReturnTimeline 
                        history={history || []} 
                        returns={order.return_requests || []}
                        activeReturnId={returnRequest.id}
                        showOnlyActive={true}
                    />
                </div>
            </div>

            {/* Rejection Reason Dialog */}
            <Dialog open={isRejectDialogOpen} onOpenChange={(open) => {
                setIsRejectDialogOpen(open);
                if (!open) {
                    setSelectedRejectionKey("");
                    setRejectionReason("");
                }
            }}>
                <DialogContent className="sm:max-w-[480px] rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-red-600 flex items-center gap-2">
                            <XCircle className="w-5 h-5" />
                            {t("admin.orders.detail.return.rejectDialog.title", "Reject Return Request")}
                        </DialogTitle>
                        <DialogDescription className="text-xs font-medium text-slate-500 pt-2 leading-relaxed">
                            {t("admin.orders.detail.return.rejectDialog.description", "Select a structured reason for rejection. This ensures consistent policy enforcement and clear communication with the customer.")}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="py-4 space-y-5">
                        {/* Policy Highlight for Natural Variations */}
                        <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex gap-3">
                            <Sprout className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">Natural Variation Policy</span>
                                <p className="text-[10px] leading-relaxed text-amber-800 font-medium italic">
                                    Reminder: Natural variations in smell, color, and texture (e.g., grainy ghee) are expected characteristics of organic products and do not constitute defects.
                                </p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {t("admin.orders.detail.return.rejectDialog.reasonLabel", "Rejection Category & Reason")}
                                </label>
                                <Select value={selectedRejectionKey} onValueChange={setSelectedRejectionKey}>
                                    <SelectTrigger className="text-xs font-bold border-slate-200 h-11 rounded-xl">
                                        <SelectValue placeholder={t("admin.orders.detail.return.rejectDialog.selectPlaceholder", "Select a reason...")} />
                                    </SelectTrigger>
                                    <SelectContent className="max-h-[350px]">
                                        {RETURN_REJECTION_REASONS.map((category) => (
                                            <SelectGroup key={category.category}>
                                                <SelectLabel className="text-[10px] font-black uppercase tracking-widest text-slate-400 bg-slate-50/50 py-2 px-4 flex items-center gap-2">
                                                    {category.icon && <category.icon className="h-3 w-3 opacity-70" />}
                                                    <span>{category.category}</span>
                                                </SelectLabel>
                                                {category.reasons.map((reason) => (
                                                    <SelectItem 
                                                        key={reason.key} 
                                                        value={reason.key}
                                                        className="text-xs font-bold pl-8 py-2.5"
                                                    >
                                                        {reason.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectGroup>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                                    {selectedRejectionKey === 'other' 
                                        ? t("admin.orders.detail.return.rejectDialog.otherReason", "Specify Rejection Details")
                                        : t("admin.orders.detail.return.rejectDialog.notes", "Additional Notes (Optional)")}
                                </label>
                                <Textarea 
                                    placeholder={selectedRejectionKey === 'other'
                                        ? "Provide detailed reason for rejection..."
                                        : "Any additional context for the customer..."} 
                                    className="min-h-[100px] text-xs font-bold border-slate-200 focus:border-red-200 focus:ring-red-100 rounded-xl resize-none"
                                    value={rejectionReason}
                                    onChange={(e) => setRejectionReason(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-slate-50">
                        <Button 
                            variant="outline" 
                            onClick={() => setIsRejectDialogOpen(false)}
                            className="rounded-xl text-xs font-bold h-10 px-6"
                            disabled={updating}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button 
                            variant="destructive"
                            onClick={handleConfirmReject}
                            className="rounded-xl text-xs font-bold h-10 px-8 shadow-lg shadow-red-100"
                            disabled={!selectedRejectionKey || (selectedRejectionKey === 'other' && !rejectionReason.trim()) || updating}
                        >
                            {updating ? t("common.processing") : t("admin.orders.detail.return.rejectDialog.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* QC Audit Dialog */}
            <Dialog open={!!auditingItemId} onOpenChange={(open) => !open && setAuditingItemId(null)}>
                <DialogContent className="max-w-2xl bg-transparent border-none p-0 shadow-none">
                    {auditingItemId && (
                        <Suspense
                            fallback={
                                <div className="rounded-3xl border border-slate-200 bg-white/95 p-8 text-center shadow-2xl">
                                    <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-indigo-100" />
                                    <p className="text-sm font-bold text-slate-700">
                                        {t("admin.orders.detail.audit.loading", "Loading QC audit form")}
                                    </p>
                                    <p className="mt-1 text-xs text-slate-400">
                                        {t("admin.orders.detail.audit.loadingHint", "Fetching the detailed audit controls only when needed")}
                                    </p>
                                </div>
                            }
                        >
                            <QCAuditForm 
                                orderId={order.id}
                                returnId={returnRequest.id}
                                returnItemId={auditingItemId}
                                productPrice={itemBreakdowns.find(bd => bd.ri.id === auditingItemId)?.pricePerUnit || 0}
                                quantity={itemBreakdowns.find(bd => bd.ri.id === auditingItemId)?.qty || 1}
                                onCancel={() => setAuditingItemId(null)}
                                onAuditComplete={async (auditData) => {
                                    try {
                                        if (onQCComplete) {
                                            await onQCComplete(auditingItemId, auditData);
                                        } else {
                                            throw new Error('QC completion handler is unavailable');
                                        }
                                        setAuditingItemId(null);
                                    } catch (e) {
                                        // Error handling already done in parent or in onUpdateStatus
                                    }
                                }}
                            />
                        </Suspense>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
};
