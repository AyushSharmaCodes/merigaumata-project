import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { CheckCircle2, XCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/app/providers/currency-provider";

interface RegistrationStatusDialogProps {
  statusDialog: {
    open: boolean;
    title: string;
    message: string;
    type: "success" | "error" | "loading";
    data?: {
      registrationNumber: string;
      eventTitle: string;
      amount: string | number;
      email: string;
    };
    onClose?: () => void;
  };
  onOpenChange: (open: boolean) => void;
}

export const RegistrationStatusDialog = ({
  statusDialog,
  onOpenChange,
}: RegistrationStatusDialogProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();

  return (
    <AlertDialog
      open={statusDialog.open && statusDialog.type !== "loading"}
      onOpenChange={(open) => {
        if (statusDialog.type === "loading") return;
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle
            className={statusDialog.type === "error" ? "text-destructive" : "text-primary"}
          >
            {statusDialog.title}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="w-full">
              {statusDialog.type === "error" && (
                <div className="space-y-6 pt-2">
                  <div className="flex justify-center">
                    <div className="h-20 w-20 bg-red-100 rounded-full flex items-center justify-center">
                      <XCircle className="h-12 w-12 text-destructive" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-lg font-semibold text-foreground">{t("events.registration.failedTitle")}</p>
                    <p className="whitespace-pre-line text-muted-foreground">{statusDialog.message}</p>
                  </div>
                </div>
              )}

              {statusDialog.type === "success" && statusDialog.data && (
                <div className="space-y-6 pt-2">
                  <div className="flex justify-center">
                    <div className="h-20 w-20 bg-green-100 rounded-full flex items-center justify-center">
                      <CheckCircle2 className="h-12 w-12 text-green-600" />
                    </div>
                  </div>
                  <div className="text-center space-y-2">
                    <p className="text-muted-foreground">{t("events.registration.successDesc")}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("events.registration.emailSent", { email: statusDialog.data.email })}
                    </p>
                  </div>
                  <div className="bg-muted/30 rounded-xl border p-4 space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{t("events.registration.registrationId")}</span>
                      <span className="font-mono font-medium">{statusDialog.data.registrationNumber}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">{t("events.registration.event")}</span>
                      <span className="font-medium text-right w-1/2">{statusDialog.data.eventTitle}</span>
                    </div>
                    <div className="border-t pt-3 flex justify-between items-center">
                      <span className="font-medium text-primary">{t("events.registration.amountPaid")}</span>
                      <span className="font-bold text-lg text-primary">
                        {typeof statusDialog.data.amount === "number"
                          ? formatAmount(statusDialog.data.amount)
                          : statusDialog.data.amount}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        {statusDialog.type !== "loading" && (
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                onOpenChange(false);
              }}
            >
              {t("events.registration.ok")}
            </AlertDialogAction>
          </AlertDialogFooter>
        )}
      </AlertDialogContent>
    </AlertDialog>
  );
};
