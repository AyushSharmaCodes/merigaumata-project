import { memo } from "react";
import { useTranslation } from "react-i18next";
import { ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { OrderSummary } from "./OrderSummary";
import { CheckoutMessages } from "@/shared/constants/messages/CheckoutMessages";

interface CheckoutItemsSummaryProps {
    items: any[];
}

export const CheckoutItemsSummary = memo(({ items }: CheckoutItemsSummaryProps) => {
    const { t } = useTranslation();

    return (
        <Card className="border-none shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
            <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex items-center gap-3">
                    <ShoppingBag className="w-5 h-5 text-primary" />
                    {t(CheckoutMessages.ITEMS_IN_ORDER)}
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <OrderSummary items={items} />
            </CardContent>
        </Card>
    );
});

CheckoutItemsSummary.displayName = "CheckoutItemsSummary";
