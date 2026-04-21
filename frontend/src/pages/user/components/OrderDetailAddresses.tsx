import React from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { OrderMessages } from "@/constants/messages/OrderMessages";
import { Address } from "@/types";

interface OrderDetailAddressesProps {
    shippingAddress: Address | any;
    billingAddress?: Address | any;
}

export const OrderDetailAddresses: React.FC<{ shippingAddress: any }> = ({ 
    shippingAddress 
}) => {
    const { t } = useTranslation();

    if (!shippingAddress) return null;

    return (
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden">
            <CardContent className="p-6 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#2B8441] flex items-center justify-center">
                        <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </div>
                    {t(OrderMessages.SHIPPING, "Shipping Address")}
                </h4>

                <div className="space-y-1.5">
                    <p className="text-base font-black text-slate-900">
                        {shippingAddress.full_name || shippingAddress.name}
                    </p>
                    <div className="text-sm text-slate-500 font-medium leading-relaxed">
                        <p>{shippingAddress.address_line1 || shippingAddress.addressLine}</p>
                        {(shippingAddress.address_line2 || shippingAddress.addressLine2) && (
                            <p>{shippingAddress.address_line2 || shippingAddress.addressLine2}</p>
                        )}
                        <p>{shippingAddress.city}, {shippingAddress.state} - {shippingAddress.postal_code || shippingAddress.pincode}</p>
                        <p>{shippingAddress.country || "India"}</p>
                    </div>
                    <p className="text-sm font-bold text-[#2B8441] pt-1">
                        {shippingAddress.phone}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
