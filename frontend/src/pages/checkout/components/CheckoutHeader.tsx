import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import { BackButton } from "@/components/ui/BackButton";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";

export const CheckoutHeader = memo(() => {
    const { t } = useTranslation();

    return (
        <section className="bg-[#2C1810] text-white py-12 relative overflow-hidden shadow-2xl mb-8">
            <div className="absolute top-0 right-0 p-8 opacity-5 pointer-events-none">
                <ShoppingBag className="h-48 w-48 text-[#B85C3C]" />
            </div>
            <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-[#B85C3C]/10 rounded-full blur-[100px]" />

            <div className="container mx-auto px-4 relative z-10">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <BackButton 
                        to="/cart" 
                        label={t(CheckoutMessages.BACK_TO_CART)} 
                        className="text-white/80 hover:text-white hover:bg-white/10" 
                    />
                    <div className="space-y-1">
                        <h1 className="text-3xl md:text-4xl font-bold font-playfair">
                            {t(CheckoutMessages.SECURE)} <span className="text-[#B85C3C]">{t(CheckoutMessages.TITLE)}</span>
                        </h1>
                        <p className="text-white/60 text-sm font-light">
                            {t(CheckoutMessages.SECURE_CHECKOUT_SUB)}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
});

CheckoutHeader.displayName = "CheckoutHeader";
