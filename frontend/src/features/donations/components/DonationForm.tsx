import { Trans } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs";
import { Heart, ShieldCheck, Lock, Gift, CalendarHeart, Loader2 } from "lucide-react";
import { PhoneInput } from "@/shared/components/ui/phone-input";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";
import { cn } from "@/core/utils/utils";
import { useDonationForm } from "../hooks/useDonationForm";

export const DonationForm = () => {
    const {
        t,
        donationType,
        setDonationType,
        amount,
        customAmount,
        formData,
        setFormData,
        fieldErrors,
        setFieldErrors,
        recurringConsent,
        setRecurringConsent,
        loading,
        statusDialog,
        setStatusDialog,
        handleAmountSelect,
        handleCustomAmountChange,
        handleDonate,
        amounts,
        navigate
    } = useDonationForm();

    return (
        <>
            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm overflow-hidden">
                <CardHeader className="text-center pb-2 pt-8 bg-gradient-to-b from-primary/5 to-transparent">
                    <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-primary">
                        <Heart className="w-8 h-8 fill-current animate-pulse [animation-duration:2000ms]" />
                    </div>
                    <CardTitle className="text-3xl font-bold">{t("donation.makeDonation")}</CardTitle>
                    <p className="text-muted-foreground max-w-sm mx-auto">
                        {t("donation.smallContribution")}
                    </p>
                </CardHeader>

                <CardContent className="p-4 sm:p-8 space-y-8">
                    <Tabs value={donationType} onValueChange={(v) => setDonationType(v as "one_time" | "monthly")} className="w-full">
                        <TabsList className="grid w-full grid-cols-2 p-1.5 h-auto bg-muted/60 rounded-xl">
                            <TabsTrigger
                                value="one_time"
                                className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm h-10 rounded-lg transition-all"
                            >
                                <Gift className="w-4 h-4 mr-2" />
                                {t("donation.oneTime")}
                            </TabsTrigger>
                            <TabsTrigger
                                value="monthly"
                                className="data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm h-10 rounded-lg transition-all"
                            >
                                <CalendarHeart className="w-4 h-4 mr-2" />
                                {t("donation.monthly")}
                            </TabsTrigger>
                        </TabsList>

                        <div className="mt-6 space-y-4">
                            <div className="flex items-center justify-between">
                                <Label className="text-base font-medium">{t("donation.selectAmount")}</Label>
                                {donationType === "monthly" && (
                                    <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
                                        {t("donation.recurringNotice")}
                                    </span>
                                )}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                {amounts.map((opt) => (
                                    <button
                                        key={opt.value}
                                        onClick={() => handleAmountSelect(opt.value)}
                                        className={cn(
                                            "relative flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all hover:border-primary/50 hover:bg-primary/5",
                                            amount === opt.value
                                                ? "border-primary bg-primary/5 shadow-inner"
                                                : "border-border bg-card"
                                        )}
                                    >
                                        {opt.popular && (
                                            <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-[10px] uppercase font-bold px-2 py-0.5 rounded-full shadow-sm">
                                                {t("donation.popular")}
                                            </span>
                                        )}
                                        <span className="text-lg font-bold">{opt.label}</span>
                                        <span className="text-xs text-muted-foreground text-center mt-1">{opt.desc}</span>
                                    </button>
                                ))}
                            </div>

                            <div className="relative mt-2">
                                <Label htmlFor="custom-amount" className="sr-only">{t("donation.customAmount")}</Label>
                                <div className="relative group">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold group-focus-within:text-primary transition-colors">₹</span>
                                    <Input
                                        id="custom-amount"
                                        name="customAmount"
                                        placeholder={t("donation.customAmountPlaceholder")}
                                        className="pl-8 h-12 text-lg font-medium transition-all focus-visible:ring-offset-0 focus-visible:border-primary"
                                        value={customAmount}
                                        onChange={handleCustomAmountChange}
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                        </div>
                    </Tabs>

                    <div className="space-y-4 pt-6 border-t border-dashed">
                        <h3 className="font-semibold text-lg flex items-center gap-2">
                            {t("donation.userDetails")}
                        </h3>

                        <div className="grid gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">{t("donation.fullName")}</Label>
                                <Input
                                    id="fullName"
                                    name="fullName"
                                    value={formData.fullName}
                                    onChange={(e) => {
                                        setFormData({ ...formData, fullName: e.target.value });
                                        if (fieldErrors.fullName) setFieldErrors(prev => ({ ...prev, fullName: "" }));
                                    }}
                                    placeholder={t("donation.fullNamePlaceholder")}
                                    className={cn("h-11", fieldErrors.fullName && "border-destructive")}
                                    autoComplete="name"
                                />
                                {fieldErrors.fullName && <p className="text-xs text-destructive">{fieldErrors.fullName}</p>}
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="email">{t("donation.emailAddress")}</Label>
                                <Input
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={(e) => {
                                        setFormData({ ...formData, email: e.target.value });
                                        if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: "" }));
                                    }}
                                    placeholder={t("donation.emailPlaceholder")}
                                    type="email"
                                    className={cn("h-11", fieldErrors.email && "border-destructive")}
                                    autoComplete="email"
                                />
                                {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
                            </div>
                            <div className="space-y-2">
                                <PhoneInput
                                    id="phone"
                                    value={formData.phone}
                                    onChange={(val) => {
                                        setFormData({ ...formData, phone: val });
                                        if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: "" }));
                                    }}
                                    label={t("donation.phone")}
                                    className={cn("h-11 w-full", fieldErrors.phone && "border-destructive")}
                                />
                                {fieldErrors.phone && <p className="text-xs text-destructive">{fieldErrors.phone}</p>}
                            </div>
                        </div>
                    </div>

                    {donationType === "monthly" && (
                        <div className="pt-2">
                            <label className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20 cursor-pointer group hover:bg-primary/10 transition-colors">
                                <input
                                    type="checkbox"
                                    name="recurringConsent"
                                    id="recurringConsent"
                                    className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                    checked={recurringConsent}
                                    onChange={(e) => setRecurringConsent(e.target.checked)}
                                />
                                <span className="text-sm leading-snug text-muted-foreground group-hover:text-foreground transition-colors">
                                    <Trans i18nKey="donation.autoDonateLabel" values={{ amount: amount || "0" }}>
                                        I would like to automatically donate rupees <span className="font-bold text-primary">₹{amount || "0"}</span> once a month until I cancel or pause for monthly recurring payments.
                                    </Trans>
                                </span>
                            </label>
                        </div>
                    )}

                    <div className="space-y-4 pt-4">
                        <Button
                            size="lg"
                            className="w-full text-lg h-14 font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all hover:-translate-y-0.5"
                            onClick={handleDonate}
                            disabled={loading || (donationType === "monthly" && !recurringConsent)}
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    {t("donation.processing")}
                                </>
                            ) : t("donation.donateNow", { amount: amount || "0" })}
                        </Button>

                        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg border border-border/40">
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3.5 h-3.5 text-green-600" />
                                <span>{t("donation.securePayment")}</span>
                            </div>
                            <span className="hidden sm:inline text-border">|</span>
                            <div className="flex items-center gap-1.5">
                                <Lock className="w-3.5 h-3.5 text-blue-600" />
                                <span>{t("donation.secureSSL")}</span>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <AlertDialog open={statusDialog.open} onOpenChange={(open) => !open && setStatusDialog(prev => ({ ...prev, open: false }))}>
                <AlertDialogContent className="rounded-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className={cn("text-xl flex items-center gap-2", statusDialog.type === "error" ? "text-destructive" : "text-primary")}>
                            {statusDialog.type === "success" && <Heart className="w-5 h-5 fill-current" />}
                            {statusDialog.title}
                        </AlertDialogTitle>
                        <AlertDialogDescription className="text-base pt-2">
                            {statusDialog.message}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogAction onClick={() => {
                            const shouldRedirectToLogin = !!statusDialog.redirectToLogin;

                            setStatusDialog(prev => ({ ...prev, open: false }));

                            if (shouldRedirectToLogin) {
                                navigate("/auth");
                            }
                        }}>
                            {t("donation.close")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    );
};
