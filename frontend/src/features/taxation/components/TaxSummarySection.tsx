import { useTranslation } from "react-i18next";

interface TaxSummarySectionProps {
  role: 'admin' | 'customer';
  effectiveTaxable: number;
  displayTotalTax: number;
  productTaxableFromItems: number;
  deliveryCharge: number;
  isInterState: boolean;
  displayIgst: number;
  displayCgst: number;
  displaySgst: number;
  formatAmount: (amount: number) => string;
}

export const TaxSummarySection = ({
  role,
  effectiveTaxable,
  displayTotalTax,
  productTaxableFromItems,
  deliveryCharge,
  isInterState,
  displayIgst,
  displayCgst,
  displaySgst,
  formatAmount,
}: TaxSummarySectionProps) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-4">
      {/* Primary Taxable & Tax Split */}
      <div className="grid grid-cols-2 gap-4 bg-muted/30 p-3 rounded-lg border border-muted">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            {role === 'admin' ? t("tax.totalTaxable") : t("tax.subtotalBeforeTax")}
          </span>
          <span className="text-sm font-semibold">{formatAmount(effectiveTaxable)}</span>
        </div>
        <div className="space-y-1 text-right">
          <span className="text-[10px] uppercase font-bold text-muted-foreground block">
            {role === 'admin' ? t("tax.totalGST") : t("tax.taxesGST")}
          </span>
          <span className="text-sm font-semibold text-primary">{formatAmount(displayTotalTax)}</span>
        </div>
      </div>

      {/* Detailed Breakdown */}
      <div className="space-y-2 px-1">
        <div className="flex justify-between text-xs">
          <span className="text-muted-foreground">
            {role === 'admin' ? t("tax.netTaxable") : t("tax.itemsTotal")}
          </span>
          <span>{formatAmount(productTaxableFromItems)}</span>
        </div>
        {deliveryCharge > 0 && (
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground italic">
              {role === 'admin' ? t("tax.shippingCharges") : t("orderDetail.delivery")}
            </span>
            <span>{formatAmount(deliveryCharge)}</span>
          </div>
        )}
        <div className="h-[1px] bg-muted my-1" />

        {isInterState ? (
          <div className="flex justify-between text-sm font-medium">
            <span className="text-muted-foreground">
              {role === 'admin' ? t("tax.igstLabel") : t("tax.igstLabelShort")}
            </span>
            <span className="text-primary">{formatAmount(displayIgst)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {role === 'admin' ? t("tax.cgstLabel") : t("tax.cgstLabelShort")}
              </span>
              <span>{formatAmount(displayCgst)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">
                {role === 'admin' ? t("tax.sgstLabel") : t("tax.sgstLabelShort")}
              </span>
              <span>{formatAmount(displaySgst)}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
