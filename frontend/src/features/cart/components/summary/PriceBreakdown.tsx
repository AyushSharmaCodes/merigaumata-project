import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CartTotals } from "@/shared/types";
import { useCurrency } from "@/app/providers/currency-provider";

interface PriceBreakdownProps {
  totals: CartTotals | null;
}

export const PriceBreakdown = ({ totals }: PriceBreakdownProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  return (
    <div className="space-y-3">
      <div className="flex justify-between text-muted-foreground font-medium">
        <span>{t("cart.summary.itemsTotal")}</span>
        <span className="text-foreground">{formatAmount(totals?.totalMrp || 0)}</span>
      </div>

      {totals && totals.discount > 0 && (
        <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold">
          <span className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            {t("cart.summary.productDiscounts")}
          </span>
          <span>-{formatAmount(totals.discount)}</span>
        </div>
      )}

      <div className="flex justify-between items-center pt-2 border-t border-dashed border-border/40">
        <span className="text-muted-foreground font-medium">{t("cart.summary.sellingPrice")}</span>
        <span className="font-bold text-foreground">
          {formatAmount(totals?.totalPrice || ((totals?.totalMrp || 0) - (totals?.discount || 0)))}
        </span>
      </div>
    </div>
  );
};
