import React from "react";
import { useTranslation } from "react-i18next";
import { Package, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface OrderDetailItemsProps {
    items: any[];
}

export const OrderDetailItems: React.FC<OrderDetailItemsProps> = ({ items }) => {
    const { t, i18n } = useTranslation();
    const { formatAmount } = useCurrency();
    const lang = i18n.language;

    return (
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            <CardHeader className="px-6 pt-6 pb-4">
                <CardTitle className="text-base font-black text-slate-800 tracking-tight flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#2B8441] flex items-center justify-center">
                        <ShoppingBag className="h-4 w-4 text-white" strokeWidth={2.5} />
                    </div>
                    {t(OrderMessages.ITEMS, "Items in this Order")}
                </CardTitle>
            </CardHeader>

            {/* Table header */}
            <div className="px-6 pb-2 grid grid-cols-[1fr_80px_100px] text-[10px] font-bold uppercase tracking-widest text-slate-400">
                <span>PRODUCT</span>
                <span className="text-center">QUANTITY</span>
                <span className="text-right">SUBTOTAL</span>
            </div>

            <CardContent className="px-6 pb-6 pt-0">
                <div className="divide-y divide-slate-50">
                    {items?.map((item, index) => {
                        const sizeLabel = item.variant?.size_label_i18n?.[lang] || item.variant?.size_label || item.size_label;
                        const displayImage = item.variant?.variant_image_url || item.product?.images?.[0];
                        const unitPrice = item.price_per_unit || item.product?.price || 0;
                        const description = item.variant?.description_i18n?.[lang] || item.variant?.description;

                        return (
                            <div key={index} className="grid grid-cols-[1fr_80px_100px] items-center gap-4 py-4">
                                {/* Product info */}
                                <div className="flex items-center gap-4">
                                    <div className="w-16 h-16 rounded-xl bg-slate-50 overflow-hidden shrink-0 border border-slate-100">
                                        {displayImage ? (
                                            <img src={displayImage} alt="" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <Package className="h-7 w-7 text-slate-200" />
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-bold text-slate-900 leading-tight">
                                            {getLocalizedContent(item.product, lang, 'title') || item.title}
                                        </h4>
                                        <p className="text-xs text-slate-400 font-medium mt-0.5">
                                            {sizeLabel}{description && ` • ${description}`}
                                        </p>
                                        <p className="text-xs font-bold text-[#2B8441] mt-1">{formatAmount(unitPrice)}</p>
                                    </div>
                                </div>

                                {/* Quantity */}
                                <div className="text-center">
                                    <span className="text-sm font-bold text-slate-700">{item.quantity}</span>
                                </div>

                                {/* Subtotal */}
                                <div className="text-right">
                                    <span className="text-sm font-bold text-slate-900">
                                        {formatAmount(item.quantity * unitPrice)}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};
