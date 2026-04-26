import { Link } from "react-router-dom";
import { RotateCcw, Package, Truck, Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/app/providers/currency-provider";

interface CartItemInfoProps {
  productId: string;
  title: string;
  category: string;
  sizeLabel?: string;
  isOutOfStock: boolean;
  isReturnable: boolean;
  returnDays: number;
  deliveryCharge: number;
  deliveryGst: number;
  deliveryMeta: any;
  couponDiscount: number;
}

export const CartItemInfo = ({
  productId,
  title,
  category,
  sizeLabel,
  isOutOfStock,
  isReturnable,
  returnDays,
  deliveryCharge,
  deliveryGst,
  deliveryMeta,
  couponDiscount,
}: CartItemInfoProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  return (
    <div className="space-y-1.5 flex-1 min-w-0 pt-1">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="text-[10px] uppercase tracking-widest font-black text-[#A16207] bg-[#FEF9C3] px-2.5 py-1 rounded-md">
          {category}
        </span>
        {sizeLabel && (
          <span className="text-[10px] uppercase tracking-widest font-black text-[#A16207] bg-[#FFEDD5] px-2.5 py-1 rounded-md">
            {sizeLabel}
          </span>
        )}
        {isOutOfStock ? (
          <span className="text-[9px] font-black uppercase text-destructive flex items-center gap-1.5 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-destructive animate-pulse" />
            {t("products.outOfStock")}
          </span>
        ) : (
          <span className="text-[9px] font-black uppercase text-[#059669] flex items-center gap-1.5 ml-1 bg-[#ECFDF5] px-2 py-1 rounded-md">
            <div className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            {t("products.inStock")}
          </span>
        )}
      </div>

      <Link
        to={`/product/${productId}`}
        className="block font-bold text-lg sm:text-xl hover:text-primary transition-all duration-300 line-clamp-1 leading-tight tracking-tight mb-2"
      >
        {title}
      </Link>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
        {isReturnable ? (
          <div className="flex items-center gap-1.5 text-muted-foreground/80">
            <RotateCcw className="w-3.5 h-3.5 text-emerald-500" />
            <span className="text-[10px] font-medium">{t("products.daysReturnShort", { count: returnDays })}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-muted-foreground/60">
            <Package className="w-3.5 h-3.5" />
            <span className="text-[10px] font-medium">{t("products.noReturns")}</span>
          </div>
        )}

        {deliveryCharge > 0 && deliveryMeta?.source !== 'global' ? (
          <div className="flex flex-col items-start gap-1 w-full">
            <div className="flex items-center gap-1.5 font-black text-[10px] uppercase tracking-wider text-[#9A3412] bg-[#FFF7ED] px-2.5 py-1 rounded-full border border-[#FDBA74]">
              <Truck className="w-3 h-3" />
              <span>
                +{formatAmount(deliveryCharge + deliveryGst)} {t("products.surcharge")}
              </span>
            </div>
            {deliveryMeta && (
              <div className="flex flex-col pl-1 space-y-0.5">
                <span className="text-[10px] text-muted-foreground/70 font-bold italic leading-tight">
                  {deliveryMeta.calculation_type === 'PER_ITEM' && `(${formatAmount(deliveryMeta.base_charge)} / ${t("products.perItem")})`}
                  {deliveryMeta.calculation_type === 'PER_PACKAGE' && `(${formatAmount(deliveryMeta.base_charge)} / ${t("products.perPackage")})`}
                  {deliveryMeta.calculation_type === 'WEIGHT_BASED' && `(${t("products.heavyItemSurcharge")})`}
                  {deliveryMeta.calculation_type === 'FLAT_PER_ORDER' && `(${t("products.flatProductCharge")})`}
                </span>
                {deliveryGst > 0 && (
                  <span className="text-[9px] text-muted-foreground/50 font-medium">
                    ({t("products.includes")} {formatAmount(deliveryGst)} GST)
                  </span>
                )}
              </div>
            )}
          </div>
        ) : null}

        {couponDiscount > 0 && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-primary/5 rounded-md text-[10px] font-black text-primary border border-primary/20">
            <Tag className="w-3 h-3" />
            <span>-{formatAmount(couponDiscount)} {t("products.saved")}</span>
          </div>
        )}
      </div>
    </div>
  );
};
