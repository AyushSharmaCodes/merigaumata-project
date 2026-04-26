import { useState } from "react";
import { Tag, CheckCircle2, X, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CartTotals } from "@/shared/types";
import { Input } from "@/shared/components/ui/input";
import { Button } from "@/shared/components/ui/button";

interface CouponSectionProps {
  totals: CartTotals | null;
  isLoading: boolean;
  onApplyCoupon: (code: string) => Promise<boolean>;
  onRemoveCoupon: () => Promise<void>;
}

export const CouponSection = ({
  totals,
  isLoading,
  onApplyCoupon,
  onRemoveCoupon,
}: CouponSectionProps) => {
  const { t } = useTranslation();
  const [couponCode, setCouponCode] = useState("");
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);

  const handleApply = async (codeOverride?: string) => {
    const code = codeOverride || couponCode;
    if (!code.trim()) return;

    setIsApplyingCoupon(true);
    try {
      await onApplyCoupon(code);
      setCouponCode("");
    } finally {
      setIsApplyingCoupon(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted-foreground/80">
        <Tag className="w-3.5 h-3.5 text-primary" />
        {t("cart.summary.applyPromotion")}
      </div>

      {totals?.coupon ? (
        <div className="relative group">
          <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 rounded-2xl animate-in zoom-in-95 duration-300">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="bg-emerald-600 text-white text-xs font-black px-2.5 py-1 rounded-lg shadow-sm uppercase tracking-tight">
                    {totals.coupon.code}
                  </div>
                  <div className="flex items-center gap-1 text-emerald-700 text-xs font-bold">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {t("cart.summary.couponApplied")}
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-emerald-900">
                    {totals.coupon.type === 'free_delivery'
                      ? t("cart.summary.unlockedFreeDelivery")
                      : t("cart.summary.discountApplied", { percentage: totals.coupon.discount_percentage })}
                  </p>
                  {totals.couponDiscount > 0 && (
                    <p className="text-xs text-emerald-700 font-semibold">
                      {t("cart.summary.youSaved", { amount: totals.couponDiscount.toFixed(2) })}
                    </p>
                  )}
                </div>
              </div>
              <button
                onClick={onRemoveCoupon}
                disabled={isLoading}
                className="p-2 hover:bg-emerald-100 rounded-lg transition-colors group-hover:opacity-100 opacity-60"
                title={t("cart.summary.removeCoupon")}
              >
                <X className="w-4 h-4 text-emerald-700" />
              </button>
            </div>
          </div>
          <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-400 to-teal-400 rounded-2xl opacity-20 blur-sm -z-10 group-hover:opacity-30 transition-opacity" />
        </div>
      ) : (
        <div className="relative">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="cart-coupon-code"
                name="cart-coupon-code"
                aria-label={t("cart.summary.enterCouponPlaceholder")}
                placeholder={t("cart.summary.enterCouponPlaceholder")}
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && couponCode.trim()) {
                    handleApply();
                  }
                }}
                disabled={isLoading || isApplyingCoupon}
                className="h-12 px-4 pr-10 rounded-xl border-2 border-border/60 focus:border-primary/50 font-mono text-sm font-bold uppercase tracking-wider placeholder:normal-case placeholder:tracking-normal placeholder:font-normal transition-all"
              />
              {couponCode && (
                <button
                  onClick={() => setCouponCode('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-muted-foreground" />
                </button>
              )}
            </div>
            <Button
              onClick={() => handleApply()}
              disabled={!couponCode || isLoading || isApplyingCoupon}
              className="h-12 px-6 rounded-xl font-black uppercase tracking-widest text-xs bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl transition-all disabled:opacity-50"
            >
              {isApplyingCoupon ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="hidden sm:inline">{t("cart.summary.applying")}</span>
                </div>
              ) : (
                t("cart.summary.apply")
              )}
            </Button>
          </div>
          {isApplyingCoupon && (
            <div className="absolute inset-0 bg-background/50 backdrop-blur-[2px] rounded-xl animate-in fade-in duration-200" />
          )}
        </div>
      )}
    </div>
  );
};
