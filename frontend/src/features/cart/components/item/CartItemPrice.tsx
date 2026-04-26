import { useTranslation } from "react-i18next";
import { useCurrency } from "@/app/providers/currency-provider";

interface CartItemPriceProps {
  price: number;
  mrp: number;
  isDiscounted: boolean;
  isTaxApplicable: boolean;
  priceIncludesTax: boolean;
  gstRate: number;
  taxAmount: number;
}

export const CartItemPrice = ({
  price,
  mrp,
  isDiscounted,
  isTaxApplicable,
  priceIncludesTax,
  gstRate,
  taxAmount,
}: CartItemPriceProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline gap-2.5">
        <span className="text-2xl font-black text-foreground tracking-tighter">
          {formatAmount(price)}
        </span>
        {isDiscounted && (
          <span className="text-sm text-muted-foreground/60 line-through font-medium">
            {formatAmount(mrp)}
          </span>
        )}
      </div>
      {isTaxApplicable && (
        <div className="flex flex-col">
          <span className="text-[10px] text-muted-foreground/60 font-medium">
            {priceIncludesTax ? t("products.inclusiveTax") : t("products.exclusiveTaxShort")}
          </span>
          {gstRate > 0 && (
            <span className="text-[9px] text-muted-foreground/40 font-bold italic">
              ({priceIncludesTax ? t("products.includes") : "+"} {formatAmount(taxAmount)} {gstRate}% GST)
            </span>
          )}
        </div>
      )}
    </div>
  );
};
