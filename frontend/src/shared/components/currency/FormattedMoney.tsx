import { useCurrency } from "@/app/providers/currency-provider";

interface FormattedMoneyProps {
  amount: number | null | undefined;
  className?: string;
  options?: Intl.NumberFormatOptions;
}

export function FormattedMoney({ amount, className, options }: FormattedMoneyProps) {
  const { formatAmount } = useCurrency();
  return <span className={className}>{formatAmount(amount, options)}</span>;
}
