import { Sparkles, Gift } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Coupon } from "@/shared/types";

interface AvailableOffersProps {
  coupons: Coupon[];
  onApplyCoupon: (code: string) => void;
}

export const AvailableOffers = ({ coupons, onApplyCoupon }: AvailableOffersProps) => {
  const { t } = useTranslation();

  if (coupons.length === 0) return null;

  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-700">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary/80">
        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
        {t("cart.summary.availableOffers")}
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none snap-x">
        {coupons.map((coupon) => (
          <button
            key={coupon.id}
            onClick={() => onApplyCoupon(coupon.code)}
            className="relative p-3.5 bg-gradient-to-br from-white to-primary/5 hover:from-primary/5 hover:to-primary/10 border border-primary/10 hover:border-primary/30 rounded-xl flex-shrink-0 w-44 transition-all hover:shadow-md active:scale-[0.98] text-left group snap-center overflow-hidden"
          >
            {/* Decorative gradient overlay */}
            <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-primary/10 to-transparent rounded-bl-full opacity-50 group-hover:opacity-70 transition-opacity" />

            <div className="relative z-10 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="bg-gradient-to-r from-primary to-primary/80 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-tight">
                  {coupon.code}
                </div>
                <Gift className="w-4 h-4 text-primary opacity-60 group-hover:opacity-100 group-hover:scale-110 transition-all" />
              </div>

              <div className="space-y-1">
                <p className="text-sm font-black text-foreground uppercase tracking-tight leading-tight">
                  {coupon.type === 'free_delivery'
                    ? `🚚 ${t("products.freeShipping")}`
                    : `💰 ${t("products.off", { percent: coupon.discount_percentage || 0 })}`}
                </p>
                <p className="text-[10px] text-muted-foreground font-semibold">
                  {coupon.min_purchase_amount
                    ? t("cart.summary.minPurchase", { amount: coupon.min_purchase_amount })
                    : t("cart.summary.noMinPurchase")}
                </p>
              </div>

              <div className="pt-1 border-t border-border/40">
                <p className="text-[9px] text-primary font-bold uppercase tracking-wider">
                  {t("cart.summary.tapToApply")}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};
