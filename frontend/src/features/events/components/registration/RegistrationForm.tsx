import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Checkbox } from "@/shared/components/ui/checkbox";
import { PhoneInput } from "@/shared/components/ui/phone-input";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCurrency } from "@/app/providers/currency-provider";

interface RegistrationFormProps {
  formData: { fullName: string; email: string; phone: string };
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPhoneChange: (val: string) => void;
  agreedToTerms: boolean;
  onAgreedChange: (checked: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  errors: Record<string, string>;
  isChecking: boolean;
  eventData: any;
}

export const RegistrationForm = ({
  formData,
  onInputChange,
  onPhoneChange,
  agreedToTerms,
  onAgreedChange,
  onSubmit,
  errors,
  isChecking,
  eventData,
}: RegistrationFormProps) => {
  const { t } = useTranslation();
  const { formatAmount } = useCurrency();
  const registrationAmount = eventData.registrationAmount || 0;
  const isFree = registrationAmount === 0;

  return (
    <div className="p-6 bg-background">
      <h2 className="text-xl font-bold mb-5">{t("events.registration.bookSeat")}</h2>
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="fullName">{t("events.registration.fullName")}</Label>
          <Input id="fullName" name="fullName" value={formData.fullName} onChange={onInputChange} placeholder={t("events.registration.fullNamePlaceholder")} className={errors.fullName ? "border-destructive" : ""} />
          {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
        </div>

        <div className="space-y-2">
          <Label htmlFor="email">{t("events.registration.email")}</Label>
          <Input id="email" name="email" type="email" value={formData.email} onChange={onInputChange} placeholder={t("events.registration.emailPlaceholder")} className={errors.email ? "border-destructive" : ""} />
          {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-2">
          <PhoneInput id="phone" value={formData.phone} onChange={onPhoneChange} error={errors.phone} label={t("events.registration.phone")} required={true} />
        </div>

        <div className="space-y-2">
          <Label>{t("events.registration.amount")}</Label>
          <div className="bg-muted/50 p-4 rounded-lg border space-y-2">
            {!isFree && (
              <>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("events.registration.basePrice")}:</span>
                  <span className="font-medium">{formatAmount(registrationAmount / (1 + (eventData.gstRate || 0) / 100))}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{t("events.registration.gst")} ({eventData.gstRate || 0}%):</span>
                  <span className="font-medium">{formatAmount(registrationAmount - (registrationAmount / (1 + (eventData.gstRate || 0) / 100)))}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between pt-2 border-t mt-2">
              <span className="text-sm font-bold text-foreground">{t("events.registration.total")} {!isFree && t("events.registration.inclusiveTax")}:</span>
              <span className="text-lg font-black text-primary">{isFree ? t("events.registration.free") : formatAmount(registrationAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Checkbox id="terms" checked={agreedToTerms} onCheckedChange={(c) => onAgreedChange(c as boolean)} className={errors.terms ? "border-destructive" : ""} />
          <Label className="text-sm cursor-pointer">{t("events.registration.agreeTo")} <a href="/terms-and-conditions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline font-medium">{t("events.registration.terms")}</a></Label>
        </div>
        {errors.terms && <p className="text-sm text-destructive">{errors.terms}</p>}

        <Button type="submit" className="w-full" size="lg" disabled={isChecking}>
          {isChecking && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isChecking ? t("common.checking") : t("events.registration.confirm")}
        </Button>
      </form>
    </div>
  );
};
