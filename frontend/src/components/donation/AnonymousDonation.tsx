import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, ShieldCheck, Zap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { donationService } from "@/services/donation.service";
import { bankDetailsService } from "@/services/bank-details.service";

const QrCodeDisplay = () => {
    const { t } = useTranslation();
    const { data, isLoading, error } = useQuery({
        queryKey: ['donationQrCode'],
        queryFn: donationService.getQrCode,
        staleTime: 1000 * 60 * 60, // Cache for 1 hour
    });

    if (isLoading) {
        return (
            <div className="w-48 h-48 flex items-center justify-center bg-muted/50 rounded-xl">
                <Loader2 className="w-8 h-8 animate-spin text-primary/60" />
            </div>
        );
    }

    if (error || !data?.qr_code_url) {
        return (
            <div className="w-48 h-48 flex items-center justify-center bg-muted/50 text-muted-foreground text-xs text-center p-4 rounded-xl border border-dashed border-border">
                {t("donation.anonymous.qrUnavailable")}
            </div>
        );
    }

    return (
        <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-tr from-primary via-accent to-secondary rounded-xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>
            <div className="relative bg-white p-2 rounded-xl">
                <img
                    src={data.qr_code_url}
                    alt={t("donation.anonymous.qrAlt")}
                    className="w-48 h-48 object-contain rounded-lg"
                />
            </div>
        </div>
    );
};

const UpiIdDisplay = () => {
    const { t } = useTranslation();
    const { data: bankDetails, isLoading } = useQuery({
        queryKey: ['bankDetails'],
        queryFn: () => bankDetailsService.getAll(),
        staleTime: 1000 * 60 * 60,
    });

    const donationAccount = bankDetails?.find(b => b.type === 'donation' && b.is_active);
    const upiId = donationAccount?.upi_id;

    if (isLoading) {
        return (
            <div className="w-full h-12 flex items-center justify-center bg-background/50 animate-pulse rounded-lg border border-border/50">
                <Loader2 className="w-4 h-4 animate-spin text-primary/40" />
            </div>
        );
    }

    if (!upiId) return null;

    return (
        <div className="w-full bg-background/50 backdrop-blur-sm rounded-lg p-3 border border-border/50 text-center">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                {t("donation.anonymous.upiId")}
            </p>
            <p className="font-mono text-sm select-all cursor-pointer hover:text-primary transition-colors">
                {upiId}
            </p>
        </div>
    );
};

export const AnonymousDonation = () => {
    const { t } = useTranslation();
    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-700 delay-200">
            <Card className="bg-gradient-to-br from-primary/5 via-primary/10 to-accent/5 border-primary/20 shadow-lg overflow-hidden relative">
                <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-3xl -mr-12 -mt-12"></div>

                <CardHeader className="text-center pb-2 relative z-10">
                    <CardTitle className="text-xl font-playfair flex items-center justify-center gap-2">
                        <Zap className="w-5 h-5 text-amber-500 fill-amber-500" />
                        {t("donation.anonymous.title")}
                    </CardTitle>
                    <p className="text-sm text-balance text-muted-foreground">
                        {t("donation.anonymous.subtitle")}
                    </p>
                </CardHeader>

                <CardContent className="flex flex-col items-center gap-6 relative z-10 pt-4">
                    <QrCodeDisplay />

                    <div className="text-center space-y-2 max-w-xs">
                        <p className="text-sm font-medium text-foreground">
                            {t("donation.anonymous.scanPrompt")}
                        </p>
                        <p className="text-xs text-muted-foreground/80">
                            {t("donation.anonymous.impactMsg")}
                        </p>
                    </div>

                    <UpiIdDisplay />
                </CardContent>
            </Card>

            <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-primary" />
                        {t("donation.anonymous.whyTitle")}
                    </CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2.5">
                    <div className="flex gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        <p>{t("donation.anonymous.skipForms")}</p>
                    </div>
                    <div className="flex gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        <p>{t("donation.anonymous.directTransfer")}</p>
                    </div>
                    <div className="flex gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary/60 mt-1.5 shrink-0" />
                        <p>{t("donation.anonymous.privacyMsg")}</p>
                    </div>
                    <p className="text-xs text-muted-foreground/60 italic pt-1 pl-4 border-l-2 border-primary/20">
                        {t("donation.anonymous.taxNotice")}
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};
