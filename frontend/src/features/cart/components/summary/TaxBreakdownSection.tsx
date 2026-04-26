import { Sparkles } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CartTotals } from "@/shared/types";
import { useCurrency } from "@/app/providers/currency-provider";

interface TaxBreakdownSectionProps {
  totals: CartTotals | null;
  items: any[];
}

export const TaxBreakdownSection = ({ totals, items }: TaxBreakdownSectionProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  if (!totals || (totals.tax?.totalTax ?? 0) <= 0 || !totals.tax) {
    return null;
  }

  return (
    <div className="pt-3 border-t border-dashed border-border/40 space-y-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px] font-bold uppercase tracking-wider mb-1">
        <Sparkles className="w-3 h-3 text-primary/70" />
        {t("cart.summary.taxBreakdown")}
      </div>

      <div className="flex justify-between items-center px-1 pt-1 border-t border-border/5">
        <span className="text-[10px] text-muted-foreground font-medium italic">
          {t("cart.summary.taxDisclaimerInclusive")}
        </span>
        <span className="text-[10px] text-muted-foreground/80 font-bold">
          {formatAmount(totals.tax.totalTax)}
        </span>
      </div>

      <details className="group mt-1 px-1">
        <summary className="text-[9px] text-primary cursor-pointer hover:opacity-80 transition-opacity mb-1 list-none flex items-center gap-1 font-bold uppercase tracking-wider">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/30 group-open:bg-primary transition-colors animate-pulse" />
          <span>{t("cart.summary.viewProductTax")}</span>
        </summary>
        <div className="bg-muted/30 rounded-xl p-3 space-y-2.5 mt-2 max-h-[160px] overflow-y-auto custom-scrollbar border border-border/10 shadow-inner">
          {/* Product Tax */}
          {(items || []).map((item, idx) => {
            const taxBreakdown = item.tax_breakdown;
            const taxRate = taxBreakdown?.gst_rate ?? item.variant?.gst_rate ?? item.product?.default_gst_rate ?? 0;
            const itemTax = taxBreakdown?.total_tax ?? 0;
            const taxableAmount = taxBreakdown?.taxable_amount ?? 0;

            if (taxRate <= 0 && itemTax <= 0) return null;

            return (
              <div key={`tax-${idx}`} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                  <span className="truncate max-w-[140px]">{item.product?.title || t("cart.item")}</span>
                  <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">{taxRate}% GST</span>
                </div>
                <div className="flex justify-between pl-1 opacity-80">
                  <span>{t("cart.summary.taxableAmount")}</span>
                  <span>{formatAmount(taxableAmount)}</span>
                </div>
                <div className="flex justify-between pl-1 font-bold text-foreground/60">
                  <span>{t("cart.summary.taxAmount")}</span>
                  <span>{formatAmount(itemTax)}</span>
                </div>
              </div>
            );
          })}

          {/* Delivery Tax */}
          {(() => {
            const delTaxLines = [];
            const globalDeliveryGST = totals?.globalDeliveryGST ?? totals?.global_delivery_gst ?? 0;
            if (globalDeliveryGST > 0) {
              delTaxLines.push({ label: t("products.standardDeliveryGst"), amount: globalDeliveryGST });
            }
            let surchargeGST = 0;
            (items || []).forEach(it => { if (it.delivery_meta?.source !== 'global') surchargeGST += (it.delivery_gst || 0); });
            if (surchargeGST > 0) {
              delTaxLines.push({ label: t("products.surchargeGst"), amount: surchargeGST });
            }

            return delTaxLines.map((line, lidx) => (
              <div key={`del-tax-${lidx}`} className="flex flex-col text-[10px] text-muted-foreground border-b border-dashed border-border/40 last:border-0 pb-2 last:pb-0">
                <div className="flex justify-between font-bold text-foreground/80 mb-0.5">
                  <span>{line.label}</span>
                  <span className="text-[9px] bg-primary/5 px-1.5 py-0.5 rounded text-primary">{t("common.tax.gstLabel", { rate: "18%" })}</span>
                </div>
                <div className="flex justify-between pl-1 font-bold text-foreground/60">
                  <span>{t("cart.summary.taxAmount")}</span>
                  <span>{formatAmount(line.amount)}</span>
                </div>
              </div>
            ));
          })()}
        </div>
      </details>
    </div>
  );
};
