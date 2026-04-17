import { useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { TicketPercent, Loader2, Sparkles, X } from "lucide-react";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import type { Coupon, CheckoutSummary } from "@/types";

interface CheckoutCouponSectionProps {
  appliedCoupon?: any;
  availableCoupons: Coupon[];
  isLoading: boolean;
  onApply: (code: string) => Promise<void>;
  onRemove: () => Promise<void>;
  isBuyNow?: boolean;
}

export const CheckoutCouponSection = memo(({
  appliedCoupon,
  availableCoupons,
  isLoading,
  onApply,
  onRemove,
  isBuyNow = true
}: CheckoutCouponSectionProps) => {
  const { t } = useTranslation();
  const [localCode, setLocalCode] = useState("");

  if (!isBuyNow && !appliedCoupon) return null;

  return (
    <div className="rounded-2xl border border-border/60 bg-muted/20 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <div className="rounded-full bg-primary/10 p-2">
          <TicketPercent className="h-4 w-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">{t("profile.coupon")}</p>
          <p className="text-xs text-muted-foreground">
            {isBuyNow ? t(ProductMessages.BUY_NOW) : t(CheckoutMessages.TITLE)}
          </p>
        </div>
      </div>

      {appliedCoupon ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                {appliedCoupon.code}
              </p>
              <p className="text-sm text-emerald-900">
                {appliedCoupon.type === "free_delivery"
                  ? t("products.freeShipping")
                  : t("products.off", { percent: appliedCoupon.discount_percentage || 0 })}
              </p>
            </div>
            {isBuyNow && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-900"
                onClick={onRemove}
                disabled={isLoading}
                aria-label={t("success.cart.couponRemoved")}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        isBuyNow && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <Input
                value={localCode}
                onChange={(e) => setLocalCode(e.target.value.toUpperCase())}
                placeholder={t("cart.summary.enterCoupon")}
                className="h-11 bg-background"
                disabled={isLoading}
              />
              <Button
                type="button"
                className="h-11 px-4"
                onClick={() => onApply(localCode)}
                disabled={isLoading || !localCode.trim()}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("cart.summary.apply")}
              </Button>
            </div>

                {availableCoupons.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  <Sparkles className="h-3.5 w-3.5 text-amber-500" />
                  {t("cart.summary.availableOffers")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableCoupons.map((coupon) => (
                    <button
                      key={coupon.id}
                      type="button"
                      onClick={() => onApply(coupon.code)}
                      className="rounded-full border border-primary/20 bg-background px-3 py-1.5 text-left transition-colors hover:border-primary/40 hover:bg-primary/5"
                      disabled={isLoading}
                    >
                      <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                        {coupon.code}
                      </span>
                      <span className="block text-[11px] text-muted-foreground">
                        {coupon.type === "free_delivery"
                          ? t("products.freeShipping")
                          : t("products.off", { percent: coupon.discount_percentage || 0 })}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {isLoading && (
              <p className="text-xs text-muted-foreground">
                {t("common.loading", "Loading...")}
              </p>
            )}
          </div>
        )
      )}
    </div>
  );
});

CheckoutCouponSection.displayName = "CheckoutCouponSection";
