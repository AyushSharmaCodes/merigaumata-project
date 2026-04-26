import React from "react";
import { format } from "date-fns";
import { 
    Package, 
    Calendar, 
    MessageSquare, 
    ImageIcon, 
    MapPin, 
    UserCircle,
    CheckCircle2,
    XCircle,
    RotateCcw,
    ReceiptIndianRupee,
    Truck,
    Undo2
} from "lucide-react";
import { Badge } from "@/shared/components/ui/badge";
import { ReturnRequest, Order } from "@/shared/types";
import { useTranslation } from "react-i18next";

export const PickupInformationCard = React.memo(({ returnRequest, order }: { returnRequest: ReturnRequest, order: Order }) => {
    if (!['pickup_scheduled', 'pickup_attempted', 'pickup_completed', 'picked_up'].includes(returnRequest.status)) {
        return null;
    }

    const pickupStatuses = ['pickup_scheduled', 'pickup_attempted', 'pickup_completed', 'picked_up'];
    const latestPickupEvent = [...(order.order_status_history || [])]
        .filter((historyItem: any) => pickupStatuses.includes(String(historyItem.status || '').toLowerCase()))
        .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];

    const currentStatusLabel = returnRequest.status.replace(/_/g, ' ');

    return (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col gap-8">
            <div className="flex items-center gap-3 text-slate-800">
                <Truck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-lg tracking-tight">Pickup Information</h3>
            </div>

            <div className="bg-[#fcfaf5] rounded-2xl p-6 border border-[#f3ead8] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Latest Pickup Update</span>
                    <span className="text-base font-bold text-slate-800">
                        {latestPickupEvent?.created_at
                            ? format(new Date(latestPickupEvent.created_at), "MMM d, yyyy")
                            : "Awaiting logistics update"}
                    </span>
                    <span className="text-sm font-bold text-emerald-600 uppercase tracking-wide">
                        {currentStatusLabel}
                    </span>
                </div>
                {latestPickupEvent?.notes && (
                    <div className="max-w-sm text-xs font-medium text-slate-600 leading-relaxed">
                        {latestPickupEvent.notes}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-2">
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        Pickup Address
                    </span>
                    <div className="text-sm text-slate-600 font-medium leading-relaxed">
                        <p>{order.shipping_address?.addressLine || (order.shipping_address as any)?.address_line1}</p>
                        {(order.shipping_address as any)?.address_line2 && <p>{(order.shipping_address as any)?.address_line2}</p>}
                        <p>{order.shipping_address?.city}, {order.shipping_address?.state} {order.shipping_address?.pincode || (order.shipping_address as any)?.postal_code}</p>
                        <p className="mt-1">{order.shipping_address?.phone || order.customer_phone}</p>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        Tracking Status
                    </span>
                    <div className="bg-[#fcfaf5] border border-[#f3ead8] rounded-xl px-4 py-3 text-sm font-bold text-slate-800 uppercase tracking-wide w-fit">
                        {currentStatusLabel}
                    </div>
                </div>
            </div>
        </div>
    );
});

export const ReturnOverviewCard = React.memo(({ returnRequest }: { returnRequest: ReturnRequest }) => {
    return (
        <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 flex flex-col gap-8">
            <div className="flex items-center gap-3 text-slate-800">
                <div className="w-8 h-8 rounded-lg bg-[#fcfaf5] border border-[#f3ead8] flex items-center justify-center text-[#cca036]">
                   <Undo2 className="w-4 h-4" />
                </div>
                <h3 className="font-bold text-lg tracking-tight">Return Request Overview</h3>
            </div>

            <div className="flex flex-col gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reason for Return</span>
                <div className="inline-flex">
                    <span className="bg-[#fcfaf5] text-slate-700 px-4 py-2 rounded-lg text-sm font-bold border border-[#f3ead8]">
                        {returnRequest.reason || "Wrong item delivered"}
                    </span>
                </div>
            </div>

            {returnRequest.return_items?.[0]?.reason && (
                <div className="flex flex-col gap-2">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Customer Comments</span>
                    <div className="bg-[#fcfaf5] border border-[#f3ead8] rounded-2xl p-6 text-sm text-slate-600 italic leading-relaxed">
                        "{returnRequest.return_items[0].reason}"
                    </div>
                </div>
            )}

            {returnRequest.return_items?.some(item => item.images && item.images.length > 0) && (
                <div className="flex flex-col gap-3">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                        Customer Uploaded Images
                    </span>
                    <div className="flex flex-wrap gap-4">
                        {returnRequest.return_items.flatMap(item => item.images || []).map((img, idx) => (
                            <div key={idx} className="w-24 h-24 rounded-xl overflow-hidden border border-[#f3ead8] bg-[#fcfaf5] relative group shadow-sm transition-transform hover:scale-105">
                                <img src={img} alt="Return proof" className="w-full h-full object-cover" />
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
});

export const ReturnInventoryCard = React.memo(({ returnRequest, order }: { returnRequest: ReturnRequest, order: Order }) => {
    return (
        <div className="space-y-6">
            <h3 className="font-bold text-lg text-slate-800 tracking-tight">Items to Pickup</h3>
            <div className="flex flex-col gap-4">
                {returnRequest.return_items?.map((item, idx) => {
                    const orderItem = order?.items?.find(oi => oi.id === item.order_item_id);
                    const displayImage = 
                        orderItem?.variant?.variant_image_url || 
                        orderItem?.product?.images?.[0] || 
                        orderItem?.product_snapshot?.main_image;
                    
                    const displayName = 
                        item.product_name || 
                        orderItem?.title || 
                        orderItem?.product_snapshot?.name || 
                        "Premium Product";

                    return (
                        <div key={item.id || idx} className="bg-[#fcfaf5] border border-[#f3ead8] rounded-2xl p-6 flex flex-col sm:flex-row gap-6 items-center justify-between group transition-all hover:shadow-md">
                            <div className="flex items-center gap-6 w-full">
                                <div className="w-20 h-20 rounded-xl bg-white border border-[#f3ead8] flex items-center justify-center shadow-sm overflow-hidden shrink-0">
                                    {displayImage ? (
                                        <img src={displayImage} alt={displayName} className="w-full h-full object-cover" />
                                    ) : (
                                        <Package className="w-10 h-10 text-slate-200" />
                                    )}
                                </div>
                                <div className="flex flex-col gap-1 flex-1 min-w-0">
                                    <span className="font-bold text-base text-slate-800 line-clamp-1">{displayName}</span>
                                    <span className="text-xs text-slate-500 font-bold">
                                        Expected: {orderItem?.product_snapshot?.name || displayName}
                                    </span>
                                    <span className="text-xs text-slate-800 font-black mt-1 uppercase tracking-widest">Qty: {item.quantity}</span>
                                </div>
                                <div className="hidden sm:block">
                                    <Badge className="bg-[#f3ead8] text-[#cca036] hover:bg-[#f3ead8] border-none px-4 py-1.5 text-[10px] uppercase font-black tracking-[0.1em] rounded-md">
                                        Return Requested
                                    </Badge>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
});

export const RefundSettlementCard = React.memo(({ returnRequest, order }: { returnRequest: ReturnRequest, order: Order }) => {
    const { t } = useTranslation();
    
    // Only show for refunded states
    if (!['partial_refund', 'refunded', 'partially_refunded', 'zero_refund'].includes(returnRequest.status) && returnRequest.refund_amount <= 0) {
        return null;
    }

    const matchingRefund = order.refunds?.find(r => 
        r.notes?.includes(returnRequest.id) || 
        r.return_id === returnRequest.id || 
        Number(r.amount) === returnRequest.refund_amount
    );

    return (
        <div className="bg-gradient-to-br from-emerald-50/50 to-white rounded-[24px] p-6 shadow-sm border border-emerald-100 flex flex-col gap-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-5">
                <ReceiptIndianRupee className="w-32 h-32" />
            </div>

            <div className="flex items-center gap-3 text-emerald-800 relative z-10">
                <ReceiptIndianRupee className="w-5 h-5" />
                <h3 className="font-bold">Refund Settlement</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
                <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-emerald-600/70 uppercase tracking-widest">Total Refundable</span>
                    <div className="flex items-center gap-2">
                        <span className="text-3xl font-black text-emerald-700 tracking-tight">₹{returnRequest.refund_amount?.toFixed(2) || "0.00"}</span>
                        {returnRequest.refund_amount > 0 && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
                    </div>
                </div>
                <div className="flex flex-col gap-1 justify-end">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Refund Destination</span>
                    <span className="text-sm font-bold text-slate-800">Original Source Payment</span>
                </div>
            </div>

            {matchingRefund && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-emerald-100/50 relative z-10">
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Transaction Reference</span>
                        <span className="inline-flex bg-white border border-slate-200 px-3 py-1 rounded-md text-xs font-mono font-bold text-slate-600 w-fit">
                            {matchingRefund.razorpay_refund_id || matchingRefund.id || 'Pending'}
                        </span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing Date</span>
                        <span className="text-sm font-bold text-slate-800">
                            {format(new Date(matchingRefund.created_at || new Date()), "MMMM d, yyyy 'at' HH:mm 'IST'")}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
});export const PickupAddressCard = React.memo(({ order }: { order: Order }) => {
    // Robustly find the shipping address from standard field or alias
    const shipping = order.shipping_address || order.shippingAddress || (order as any).shipping_address;
    
    if (!shipping) return null;

    const name = shipping.name || (shipping as any).full_name || order.customer_name;
    const address1 = shipping.addressLine || (shipping as any).address_line1;
    const address2 = (shipping as any).address_line2 || (shipping as any).addressLine2;
    const city = shipping.city;
    const state = shipping.state;
    const pincode = shipping.pincode || (shipping as any).postal_code;
    const phone = shipping.phone || order.customer_phone;

    return (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 flex flex-col gap-6">
            <div className="flex items-center gap-3 text-slate-800">
                <MapPin className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-base tracking-tight">Pickup Address</h3>
            </div>

            <div className="text-sm text-slate-600 font-medium leading-relaxed bg-[#fcfaf5] p-5 rounded-xl border border-[#f3ead8]">
                <p className="text-slate-900 font-bold mb-2">{name}</p>
                <p>{address1}</p>
                {address2 && <p>{address2}</p>}
                <p>{city}, {state} {pincode}</p>
                
                <div className="mt-4 pt-4 border-t border-slate-200/60 flex flex-col gap-1">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Number</span>
                    <p className="text-slate-800 font-bold">{phone}</p>
                </div>
            </div>
            
            <p className="text-[10px] text-slate-400 font-medium italic px-1">
                * This address will be used by our logistics partner for the pickup attempt.
            </p>
        </div>
    );
});
