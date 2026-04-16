import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CheckoutPaymentSectionProps {
  finalAmount: number;
  processing: boolean;
  onPayment: () => void;
}

export const CheckoutPaymentSection = memo(({
  finalAmount,
  processing,
  onPayment
}: CheckoutPaymentSectionProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  return (
    <div className="space-y-4 pt-2">
      <Button
        className="w-full h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all"
        onClick={onPayment}
        disabled={processing}
      >
        {processing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {t(CheckoutMessages.PROCESSING)}
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            {t(CheckoutMessages.PAY)} {formatAmount(finalAmount)}
          </>
        )}
      </Button>

      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground bg-muted/30 py-1.5 rounded-full">
        <ShieldCheck className="h-4 w-4 text-emerald-600" />
        <span>{t(CheckoutMessages.SECURE_GATEWAY)}</span>
      </div>
    </div>
  );
});

CheckoutPaymentSection.displayName = "CheckoutPaymentSection";
