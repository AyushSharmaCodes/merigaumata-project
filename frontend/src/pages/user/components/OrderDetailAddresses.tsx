import React from "react";
import { useTranslation } from "react-i18next";
import { MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Address } from "@/types";

interface OrderDetailAddressesProps {
    address: Address | any;
    title: string;
}

export const OrderDetailAddresses: React.FC<OrderDetailAddressesProps> = ({ 
    address,
    title
}) => {
    const { t } = useTranslation();

    if (!address) return null;

    return (
        <Card className="rounded-2xl border border-slate-100 shadow-sm bg-white overflow-hidden h-full">
            <CardContent className="p-6 space-y-4">
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#2B8441] flex items-center justify-center">
                        <MapPin className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
                    </div>
                    {title}
                </h4>

                <div className="space-y-1.5">
                    <p className="text-base font-black text-slate-900">
                        {address.full_name || address.name}
                    </p>
                    <div className="text-sm text-slate-500 font-medium leading-relaxed">
                        <p>{address.address_line1 || address.addressLine}</p>
                        {(address.address_line2 || address.addressLine2) && (
                            <p>{address.address_line2 || address.addressLine2}</p>
                        )}
                        <p>{address.city}, {address.state} - {address.postal_code || address.pincode}</p>
                        <p>{address.country || "India"}</p>
                    </div>
                    <p className="text-sm font-bold text-[#2B8441] pt-1">
                        {address.phone}
                    </p>
                </div>
            </CardContent>
        </Card>
    );
};
