import { useTranslation } from "react-i18next";
import { IndianRupee, Info, FileText } from "lucide-react";

interface TaxTotalSectionProps {
  role: 'admin' | 'customer';
  totalAmount: number;
  showInvoiceLink?: boolean;
  invoiceUrl?: string;
  onDownloadInvoice: () => void;
}

export const TaxTotalSection = ({
  role,
  totalAmount,
  showInvoiceLink,
  invoiceUrl,
  onDownloadInvoice,
}: TaxTotalSectionProps) => {
  const { t } = useTranslation();

  return (
    <>
      <div className="border-t-2 border-primary/20 pt-4 mt-2">
        <div className="flex justify-between items-end">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground block">
              {role === 'admin' ? t("tax.finalAmount") : t("tax.grandTotal")}
            </span>
            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
              <Info size={10} />
              {role === 'admin' ? t("tax.taxableValueGST") : t("tax.includesTaxes")}
            </span>
          </div>
          <div className="text-right">
            <div className="text-2xl font-black text-primary flex items-center justify-end leading-none">
              <IndianRupee size={22} className="mr-0.5" />
              {totalAmount.toFixed(2)}
            </div>
          </div>
        </div>
      </div>

      {showInvoiceLink && invoiceUrl && (
        <div className="pt-2">
          <button
            type="button"
            onClick={onDownloadInvoice}
            className="text-sm font-bold text-white bg-primary hover:bg-primary/90 transition-all flex items-center gap-2 justify-center w-full py-3 rounded-lg shadow-sm"
          >
            <FileText size={16} />
            {t("tax.downloadInvoice")}
          </button>
        </div>
      )}
    </>
  );
};
