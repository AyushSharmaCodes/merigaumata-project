import { Truck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CartTotals } from "@/shared/types";
import { useCurrency } from "@/app/providers/currency-provider";

interface DeliveryHandlingSectionProps {
  totals: CartTotals | null;
  items: any[];
}

export const DeliveryHandlingSection = ({ totals, items }: DeliveryHandlingSectionProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  const globalCharge = totals?.globalDeliveryCharge ?? totals?.global_delivery_charge ?? 0;
  const globalGST = totals?.globalDeliveryGST ?? totals?.global_delivery_gst ?? 0;
  const globalTotal = globalCharge + globalGST;
  const isFreeDelivery = totals?.coupon?.type === 'free_delivery';

  // Calculate surcharges
  let refundableBase = 0;
  let refundableGst = 0;
  let nonRefundableBase = 0;
  let nonRefundableGst = 0;

  (items || []).forEach(item => {
    const meta = item.delivery_meta || {};
    const base = item.delivery_charge || 0;
    const gst = item.delivery_gst || 0;

    if (meta.source !== 'global') {
      if (meta.delivery_refund_policy === 'REFUNDABLE') {
        refundableBase += base;
        refundableGst += gst;
      } else if (meta.delivery_refund_policy === 'PARTIAL') {
        const nonRefBase = meta.non_refundable_delivery_charge || 0;
        const nonRefGst = meta.non_refundable_delivery_gst || 0;
        refundableBase += Math.max(0, base - nonRefBase);
        refundableGst += Math.max(0, gst - nonRefGst);
        nonRefundableBase += nonRefBase;
        nonRefundableGst += nonRefGst;
      } else {
        nonRefundableBase += base;
        nonRefundableGst += gst;
      }
    }
  });

  const refundableTotal = refundableBase + refundableGst;
  const nonRefundableTotal = nonRefundableBase + nonRefundableGst;

  if (globalTotal <= 0 && !isFreeDelivery && refundableTotal <= 0 && nonRefundableTotal <= 0) {
    return null;
  }

  return (
    <div className="pt-2 border-t border-dashed border-border/40 space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
        <Truck className="w-3.5 h-3.5" />
        {t("cart.summary.deliveryHandling")}
      </div>

      {(globalTotal > 0 || isFreeDelivery) && (
        <div className="flex justify-between items-center group/del">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
            {t("cart.summary.standardDelivery")}
            {!isFreeDelivery && (
              <>
                <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef")})</span>
                {globalGST > 0 && (
                  <span className="text-[8px] uppercase tracking-wider text-emerald-600 bg-emerald-50/50 border border-emerald-100/50 px-1 py-0 rounded-sm font-bold">
                    {t("cart.summary.inclTax")}
                  </span>
                )}
              </>
            )}
          </span>
          <span className="font-bold text-xs flex items-center gap-2">
            {isFreeDelivery ? (
              <>
                <span className="text-muted-foreground/40 line-through">
                  {formatAmount(globalTotal)}
                </span>
                <span className="text-emerald-600 font-black">{t("cart.summary.free")}</span>
              </>
            ) : (
              <span className="text-foreground">
                {formatAmount(globalTotal)}
              </span>
            )}
          </span>
        </div>
      )}

      {refundableTotal > 0 && (
        <div className="flex justify-between items-center pl-1 group/sur">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            {t("products.refundableSurcharge")}
            {refundableGst > 0 && (
              <span className="text-[8px] uppercase tracking-wider text-blue-600 bg-blue-50/50 border border-blue-100/50 px-1 py-0 rounded-sm font-bold">
                {t("cart.summary.inclTax")}
              </span>
            )}
          </span>
          <span className="font-bold text-xs text-blue-600/90">
            {formatAmount(refundableTotal)}
          </span>
        </div>
      )}

      {nonRefundableTotal > 0 && (
        <div className="flex justify-between items-center pl-1 group/sur">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs font-medium">
            <div className="w-1.5 h-1.5 rounded-full bg-[#F97316]" />
            {t("products.additionalProcessing")}
            <span className="text-[10px] text-orange-600/70 font-semibold bg-orange-50 px-1 py-0.5 rounded-sm">({t("products.nonRef")})</span>
            {nonRefundableGst > 0 && (
              <span className="text-[8px] uppercase tracking-wider text-orange-600 bg-orange-50/50 border border-orange-100/50 px-1 py-0 rounded-sm font-bold">
                {t("cart.summary.inclTax")}
              </span>
            )}
          </span>
          <span className="font-bold text-xs text-orange-600/90">
            {formatAmount(nonRefundableTotal)}
          </span>
        </div>
      )}
    </div>
  );
};
