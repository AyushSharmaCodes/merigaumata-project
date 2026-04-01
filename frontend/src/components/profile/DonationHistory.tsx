import { useMemo, useRef, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, Heart, Loader2, Repeat } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TransactionCard } from "./TransactionCard";
import { donationService, type DonationHistoryItem } from "@/services/donation.service";
import { useCurrency } from "@/contexts/CurrencyContext";

const DONATIONS_PER_PAGE = 10;

export function DonationHistory() {
    const { t } = useTranslation();
    const { formatAmount } = useCurrency();
    const [currentPage, setCurrentPage] = useState(1);
    const cardRef = useRef<HTMLDivElement>(null);

    const { data, isLoading } = useQuery({
        queryKey: ["myDonationHistory"],
        queryFn: donationService.getHistory,
    });

    const donations = data?.donations ?? [];
    const totalPages = Math.max(1, Math.ceil(donations.length / DONATIONS_PER_PAGE));

    const paginatedDonations = useMemo(() => {
        const startIndex = (currentPage - 1) * DONATIONS_PER_PAGE;
        return donations.slice(startIndex, startIndex + DONATIONS_PER_PAGE);
    }, [currentPage, donations]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    useEffect(() => {
        if (cardRef.current) {
            cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
        }
    }, [currentPage]);

    const totalDonated = donations.reduce((sum, donation) => sum + Number(donation.amount), 0);
    const recurringDonations = donations.filter((donation) => donation.type === "monthly").length;

    const getBadge = (donation: DonationHistoryItem) => ({
        label: donation.type === "monthly" ? t("donate.monthly") : t("donation.oneTime"),
        color: donation.type === "monthly" ? "bg-blue-500 text-white" : "bg-slate-500 text-white",
    });

    return (
        <div className="space-y-4">
            <Card ref={cardRef}>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Heart className="h-5 w-5 text-red-500" />
                        {t("profile.donationHistory")}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : donations.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Heart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p>{t("profile.noDonations")}</p>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-4">
                                {paginatedDonations.map((donation) => (
                                    <TransactionCard
                                        key={donation.id}
                                        id={donation.donation_reference_id}
                                        date={donation.created_at}
                                        total={Number(donation.amount)}
                                        idLabel={t("donate.history.donationId")}
                                        dateLabel={t("donate.history.donated")}
                                        detailsLabel={t("donate.history.details")}
                                        badge={getBadge(donation)}
                                        items={[
                                            {
                                                name: `${t("profile.recurringDonations.status")}: ${donation.payment_status}`,
                                                price: Number(donation.amount),
                                            },
                                        ]}
                                    />
                                ))}
                            </div>

                            {totalPages > 1 && (
                                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                                    <div className="text-sm text-muted-foreground">
                                        {t("donate.history.showing", {
                                            start: (currentPage - 1) * DONATIONS_PER_PAGE + 1,
                                            end: Math.min(currentPage * DONATIONS_PER_PAGE, donations.length),
                                            total: donations.length,
                                        })}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="h-4 w-4" />
                                            {t("common.previous")}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            {t("common.next")}
                                            <ChevronRight className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t("profile.yourImpact")}</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold text-primary">{formatAmount(totalDonated)}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t("profile.totalDonated")}</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <p className="text-3xl font-bold text-primary">{donations.length}</p>
                            <p className="text-sm text-muted-foreground mt-1">{t("profile.donationsMade")}</p>
                        </div>
                        <div className="text-center p-4 bg-muted rounded-lg">
                            <div className="flex items-center justify-center gap-2">
                                <Repeat className="h-5 w-5 text-primary" />
                                <p className="text-3xl font-bold text-primary">{recurringDonations}</p>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">{t("donate.monthly")}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
