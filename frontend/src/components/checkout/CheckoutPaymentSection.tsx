import { memo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Loader2, Lock, ShieldCheck } from "lucide-react";
import { CheckoutMessages } from "@/constants/messages/CheckoutMessages";
import { useCurrency } from "@/contexts/CurrencyContext";

interface CheckoutPaymentSectionProps {
  totalAmount: number;
  isProcessing: boolean;
  onPayment: () => void;
  statusMessage?: string;
}

export const CheckoutPaymentSection = memo(({
  totalAmount,
  isProcessing,
  onPayment,
  statusMessage
}: CheckoutPaymentSectionProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  return (
    <div className="space-y-4 pt-2">
      <Button
        className="w-full h-12 text-base font-bold shadow-lg hover:shadow-xl transition-all"
        onClick={onPayment}
        disabled={isProcessing}
      >
        {isProcessing ? (
          <>
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            {statusMessage || t(CheckoutMessages.PROCESSING)}
          </>
        ) : (
          <>
            <Lock className="mr-2 h-4 w-4" />
            {t(CheckoutMessages.PAY)} {formatAmount(totalAmount)}
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
