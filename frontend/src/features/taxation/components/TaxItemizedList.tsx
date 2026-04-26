import { useTranslation } from "react-i18next";

interface TaxItemizedListProps {
  role: 'admin' | 'customer';
  items: any[];
  deliveryCharge: number;
  deliveryGST: number;
  formatAmount: (amount: number) => string;
}

export const TaxItemizedList = ({
  role,
  items,
  deliveryCharge,
  deliveryGST,
  formatAmount,
}: TaxItemizedListProps) => {
  const { t } = useTranslation();

  return (
    <div className="border rounded-md overflow-hidden text-xs shadow-sm">
      <div className="bg-muted/50 px-3 py-2 font-medium flex justify-between items-center border-b">
        <span>{role === 'admin' ? t("tax.itemizedBreakdown") : t("tax.productDetails")}</span>
        {role === 'admin' && (
          <span className="text-[9px] text-muted-foreground uppercase bg-white px-1 rounded border">
            {t("tax.auditLog")}
          </span>
        )}
      </div>
      <div className="divide-y max-h-[250px] overflow-y-auto bg-white">
        {items.map((item, idx) => {
          const qty = item.quantity || 1;
          const taxRate = item.variant?.gst_rate ?? item.gst_rate ?? item.product?.gst_rate ?? item.product?.default_gst_rate ?? 0;
          const hsn = item.variant?.hsn_code ?? item.variant_snapshot?.hsn_code ?? item.product?.hsn_code ?? item.hsn_code ?? 'N/A';

          const itemTaxable = item.taxable_amount ?? ((item.total_amount || ((item.price_per_unit || item.product?.price || 0) * qty)) / (1 + (taxRate / 100)));
          const totalItemTaxSnapshot = (item.cgst || 0) + (item.sgst || 0) + (item.igst || 0);
          const itemTax = totalItemTaxSnapshot > 0 ? totalItemTaxSnapshot : ((item.total_amount || (item.price_per_unit * qty)) - itemTaxable);

          return (
            <div key={idx} className="px-3 py-2.5 hover:bg-muted/5 transition-colors">
              <div className="flex justify-between items-start mb-1">
                <div className="space-y-0.5">
                  <div className="font-medium truncate max-w-[200px]" title={item.title || item.product?.title}>
                    {item.title || item.product?.title || t("products.defaultTitle") || 'Product'}
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>{t("tax.hsn")}: {hsn}</span>
                    <span>•</span>
                    <span>{t("products.qty") || "Qty"}: {qty}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-primary">{taxRate}% GST</div>
                  <div className="text-[9px] text-muted-foreground">
                    {formatAmount(itemTax)} {t("tax.taxesGST").split(' ')[0]}
                  </div>
                </div>
              </div>
              <div className="flex justify-between items-center text-[10px] bg-muted/20 px-2 py-1 rounded mt-1">
                <span className="text-muted-foreground">{t("tax.netValue")}</span>
                <span className="font-mono">{formatAmount(itemTaxable)}</span>
              </div>
            </div>
          );
        })}

        {((deliveryCharge ?? 0) > 0 || (deliveryGST ?? 0) > 0) && (
          <div className="px-3 py-2.5 bg-amber-50/30 border-t border-dashed transition-all">
            <div className="flex justify-between items-start mb-1">
              <div className="space-y-0.5">
                <div className="font-medium text-amber-900">{t("tax.shippingCharges")}</div>
                <div className="text-[9px] text-amber-700 font-mono">{t("tax.hsn")}: 996812</div>
              </div>
              <div className="text-right">
                <div className="font-semibold text-amber-600">{t("common.tax.gstLabel", { rate: "18%" })}</div>
                <div className="text-[9px] text-amber-700">{formatAmount(deliveryGST)} {t("tax.taxesGST").split(' ')[0]}</div>
              </div>
            </div>
            <div className="flex justify-between items-center text-[10px] bg-white/50 px-2 py-1 rounded mt-1 border border-amber-200">
              <span className="text-muted-foreground">{t("tax.taxableValue")}</span>
              <span className="font-mono">{formatAmount(deliveryCharge)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
