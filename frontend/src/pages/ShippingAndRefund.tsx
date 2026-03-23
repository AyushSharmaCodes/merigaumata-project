import { PolicyViewer } from "@/components/PolicyViewer";
import { useTranslation } from "react-i18next";

export default function ShippingAndRefund() {
    const { t } = useTranslation();
    return (
        <PolicyViewer
            type="shipping-refund"
            fallbackContent={
                <div className="text-center py-10">
                    <h1 className="text-3xl font-bold mb-4">{t("policy.shippingTitle")}</h1>
                    <p className="text-muted-foreground">{t("policy.shippingFallback")}</p>
                </div>
            }
        />
    );
}
