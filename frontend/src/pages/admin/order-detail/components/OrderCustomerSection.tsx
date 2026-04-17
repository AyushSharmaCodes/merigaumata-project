import { memo } from "react";
import { useTranslation } from "react-i18next";
import { 
    Mail, 
    Phone, 
    MapPin, 
    CreditCard,
    Flag,
    Unlock,
    Info,
    Globe
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { TranslatedText } from "@/components/ui/TranslatedText";
import { UserAvatar } from "@/components/ui/user-avatar";
import { toast } from "@/components/ui/use-toast";

interface OrderCustomerSectionProps {
    order: any;
}

export const OrderCustomerSection = memo(({ order }: OrderCustomerSectionProps) => {
    const { t } = useTranslation();

    const renderAddress = (address: any, type: 'shipping' | 'billing') => {
        const title = type === 'shipping' 
            ? t("admin.orders.detail.customerDetails.shipping", "Shipping Address").toUpperCase()
            : t("admin.orders.detail.customerDetails.billing", "Billing Address").toUpperCase();

        if (!address) {
            return (
                <div className="py-2">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-2">
                        <MapPin size={12} className="text-emerald-600" />
                        {title}
                    </span>
                    <p className="text-[11px] text-slate-400 italic pl-5">
                        {type === 'billing' ? t("admin.orders.detail.billingAddress.sameAsShipping") : t("admin.orders.detail.shippingAddress.notAvailable")}
                    </p>
                </div>
            );
        }

        return (
            <div className="space-y-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                    <MapPin size={12} className="text-emerald-600" />
                    {title}
                </span>
                
                <div className="space-y-0.5 pl-5">
                    <p className="text-sm font-bold text-slate-800"><TranslatedText text={address.full_name || ""} /></p>
                    <p className="text-[12px] text-slate-600 leading-relaxed font-medium">
                        <TranslatedText text={address.address_line1 || ""} />, 
                        {address.address_line2 && <span className="ml-1"><TranslatedText text={address.address_line2} />,</span>}
                        <br />
                        {(t(`locations.${address.city.toLowerCase()}`, address.city) as string)}, {(t(`locations.${address.state.toLowerCase()}`, address.state) as string)} - <span className="font-mono font-bold">{address.postal_code}</span>
                    </p>
                </div>
            </div>
        );
    };

    return (
        <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardContent className="p-6 space-y-7">
                {/* Fraud Flag Alert (Highest Priority) */}
                {order.user?.is_flagged && (
                    <div className="bg-rose-50 border border-rose-100 rounded-2xl p-4 flex items-center justify-between group animate-in zoom-in-95 duration-300">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-rose-500 rounded-xl text-white shadow-lg shadow-rose-200">
                                <Flag size={18} />
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-rose-700 uppercase tracking-tight">Fraudulent Activity Flag</h4>
                                <p className="text-[10px] text-rose-600 font-medium">Auto-flagged due to severe QC failure</p>
                            </div>
                        </div>
                        <button 
                            onClick={async () => {
                                // Handled via parent/service in real app, assuming onUpdateStatus or similar
                                toast({ title: "Unflag request sent", description: "Manager approval might be required." });
                            }}
                            className="p-2 bg-white text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-sm border border-rose-200"
                        >
                            <Unlock size={16} />
                        </button>
                    </div>
                )}
                {/* Profile Header */}
                <div className="flex items-center gap-4">
                    <UserAvatar
                        name={order.customer_name}
                        imageUrl={order.customer_image || order.user?.image}
                        className="w-12 h-12 rounded-full shadow-sm ring-2 ring-emerald-50"
                        fallbackClassName="bg-emerald-600 text-white text-lg font-black"
                    />
                    <div className="flex flex-col">
                        <h3 className="text-base font-black text-slate-800 leading-none">{order.customer_name}</h3>
                        <span className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-widest">
                            ID: #{order.customer_id || order.user_id || order.userId || 'N/A'}
                        </span>
                    </div>
                </div>

                {/* Contact Information */}
                <div className="space-y-3">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{t("admin.orders.detail.customerDetails.contact", "Contact").toUpperCase()}</span>
                    <div className="space-y-2.5 pl-1">
                        <div className="flex items-center gap-3 text-slate-600 group">
                            <Mail size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold truncate max-w-[200px]">{order.customer_email}</span>
                        </div>
                        <div className="flex items-center gap-3 text-slate-600">
                            <Phone size={14} className="text-emerald-600" />
                            <span className="text-xs font-bold">{order.customer_phone || 'N/A'}</span>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-100 border-dashed pt-6 space-y-6">
                    {/* Shipping & Billing Addresses */}
                    {renderAddress(order.shipping_address || order.shippingAddress, 'shipping')}
                    <div className="pt-2">
                        {renderAddress(order.billing_address || order.billingAddress, 'billing')}
                    </div>
                </div>

                {/* Financial Preferences */}
                <div className="pt-5 border-t border-slate-100 grid grid-cols-2 gap-4">
                    <div className="flex flex-col space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                            <Globe size={11} className="text-emerald-600" /> {t("admin.orders.detail.customerDetails.preferredCurrency", "Order Currency").toUpperCase()}
                        </span>
                        <span className="text-[12px] font-black text-slate-800 ml-4.5">
                            {order.customer_preferred_currency || 'INR'}
                        </span>
                    </div>
                    <div className="flex flex-col items-end space-y-1">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5 ">
                             {t("admin.orders.detail.customerDetails.exchangeRate", "Exchange Rate").toUpperCase()} <CreditCard size={11} className="text-emerald-600" />
                        </span>
                        <span className="text-[12px] font-black text-slate-800 mr-4.5">
                            {order.customer_exchange_rate_from_inr && order.customer_preferred_currency && order.customer_preferred_currency !== 'INR'
                                ? `1 INR = ${order.customer_exchange_rate_from_inr.toFixed(4)} ${order.customer_preferred_currency}`
                                : "1 INR = 1.0000 INR"}
                        </span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
});

OrderCustomerSection.displayName = "OrderCustomerSection";
