import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  userEmail: string;
}

export function DeleteAccountDialog({
  open,
  onOpenChange,
  onConfirm,
  userEmail,
}: DeleteAccountDialogProps) {
  const { t } = useTranslation();
  const [confirmText, setConfirmText] = useState("");
  const [understood, setUnderstood] = useState(false);

  const handleConfirm = () => {
    if (confirmText === "DELETE" && understood) {
      onConfirm();
      setConfirmText("");
      setUnderstood(false);
    }
  };

  const handleCancel = () => {
    setConfirmText("");
    setUnderstood(false);
    onOpenChange(false);
  };

  const isValid = confirmText === (t("common.delete") || "DELETE") && understood;

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-destructive">
            {t("profile.deleteAccount.title")}
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-4">
            <div className="space-y-2">
              <p className="font-semibold text-foreground">
                {t("profile.deleteAccount.warning")}
              </p>
              <p>
                {t("profile.deleteAccount.description")}
              </p>
              <ul className="list-disc list-inside space-y-1 text-sm ml-2">
                <li>{t("profile.deleteAccount.list.profile")}</li>
                <li>{t("profile.deleteAccount.list.addresses")}</li>
                <li>{t("profile.deleteAccount.list.cart")}</li>
              </ul>
            </div>

            <div className="space-y-2 pt-2">
              <p className="text-sm">
                {t("profile.deleteAccount.emailLabel", { email: userEmail })}
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="confirm-text">
                  {t("profile.deleteAccount.confirmLabel", { confirmText: t("common.delete") || "DELETE" })}
                </Label>
                <Input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder={t("profile.deleteAccount.confirmPlaceholder")}
                  className="font-mono"
                />
              </div>

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="understood"
                  checked={understood}
                  onCheckedChange={(checked) =>
                    setUnderstood(checked as boolean)
                  }
                />
                <Label
                  htmlFor="understood"
                  className="text-sm font-normal leading-tight cursor-pointer"
                >
                  {t("profile.deleteAccount.understoodLabel")}
                </Label>
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t("common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isValid}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
          >
            {t("profile.deleteAccount.button")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
