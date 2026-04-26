import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { User, Mail, Phone, Calendar, Ticket, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/app/providers/currency-provider";

interface RegistrationConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: { fullName: string; email: string; phone: string };
  eventData: any;
  isProcessing: boolean;
  onConfirm: () => void;
}

export const RegistrationConfirmDialog = ({
  open,
  onOpenChange,
  formData,
  eventData,
  isProcessing,
  onConfirm,
}: RegistrationConfirmDialogProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const registrationAmount = eventData.registrationAmount || 0;
  const isFree = registrationAmount === 0;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("events.registration.confirm")}</AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-6 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <User className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.fullName")}</p>
                    <p className="font-medium text-foreground">{formData.fullName}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Mail className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.email")}</p>
                    <p className="font-medium text-foreground break-all">{formData.email}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Phone className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.phone")}</p>
                    <p className="font-medium text-foreground">{formData.phone}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30">
                  <Calendar className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{t("events.registration.event")}</p>
                    <p className="font-medium text-foreground">{eventData.title}</p>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 space-y-2">
                {!isFree && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("events.registration.basePrice")}</span>
                    <span>{formatAmount(registrationAmount / (1 + (eventData.gstRate || 0) / 100))}</span>
                  </div>
                )}
                {!isFree && (
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">{t("events.registration.gst")} ({eventData.gstRate || 0}%)</span>
                    <span>{formatAmount(registrationAmount - (registrationAmount / (1 + (eventData.gstRate || 0) / 100)))}</span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-5 h-5 text-primary" />
                    <span className="font-bold">{t("events.registration.amountPaid")}</span>
                  </div>
                  <span className="text-2xl font-black text-primary">
                    {isFree ? t("events.registration.free") : formatAmount(registrationAmount)}
                  </span>
                </div>
              </div>

              {!isFree && isProcessing && (
                <p className="text-xs text-center text-muted-foreground">
                  {t("events.registration.redirecting")}
                </p>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("events.registration.cancel")}</AlertDialogCancel>
          <AlertDialogAction onClick={(e) => {
            if (isProcessing) {
              e.preventDefault();
              return;
            }
            e.preventDefault();
            onConfirm();
          }} disabled={isProcessing}>
            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isFree ? t("events.registration.confirm") : t("events.registration.proceedPayment")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
