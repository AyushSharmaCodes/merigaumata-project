import { ShieldCheck, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CartTotals } from "@/shared/types";
import { useCurrency } from "@/app/providers/currency-provider";
import { Button } from "@/shared/components/ui/button";

interface FinalTotalSectionProps {
  totals: CartTotals | null;
  itemsCount: number;
  isLoading: boolean;
  isCalculating: boolean;
  onCheckout: () => void;
}

export const FinalTotalSection = ({
  totals,
  itemsCount,
  isLoading,
  isCalculating,
  onCheckout,
}: FinalTotalSectionProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  const freeDeliverySavings = totals?.coupon?.type === 'free_delivery' ? (totals?.deliverySettings?.charge || 0) : 0;
  const totalSavings = (totals?.discount || 0) + (totals?.couponDiscount || 0) + freeDeliverySavings;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
        <span className="text-sm font-bold text-muted-foreground/60 tracking-tight">{t("cart.summary.totalPay")}</span>
        <div className="text-right">
          <span className="text-3xl font-black text-primary block leading-none tracking-tight font-playfair">
            {formatAmount(totals?.finalAmount || 0)}
          </span>
          <span className="text-[10px] text-muted-foreground/40 font-medium tracking-wide mt-1 block">
            {t("cart.summary.includingGst")}
          </span>
        </div>
      </div>

      {totals && totalSavings > 0 && (
        <div className="bg-[#F0FDFA] border border-[#CCFBF1] text-[#0D9488] text-[11px] p-3 rounded-xl text-center font-bold animate-in zoom-in-95">
          {t("cart.summary.savingsMessage", { amount: totalSavings.toFixed(2) })}
        </div>
      )}

      <div className="bg-amber-100 border border-amber-200 rounded-lg p-3 mb-4">
        <p className="text-amber-900 text-[10px] font-bold flex items-center gap-2 m-0">
          <ShieldCheck className="h-3.5 w-3.5" />
          {t("checkout.codNotSupported", "Note: Cash on Delivery (COD) is not currently supported.")}
        </p>
      </div>

      <Button
        size="lg"
        className="w-full h-14 text-lg font-bold shadow-lg rounded-2xl bg-[#BA5C3C] hover:bg-[#A54B2D] transition-all duration-300"
        onClick={onCheckout}
        disabled={isLoading || isCalculating || itemsCount === 0}
      >
        {isLoading ? <Loader2 className="animate-spin mr-2" /> : t("cart.summary.checkoutSecurely")}
      </Button>
    </div>
  );
};
