import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Heart, Download, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useMemo, useRef, useEffect } from "react";
import { TransactionCard } from "./TransactionCard";

// Mock donation data - Extended for pagination
const mockDonations = [
  {
    id: "DON-001",
    date: "2024-01-10",
    amount: 5000,
    type: "one-time",
    campaign: "Winter Shelter Fund",
    receiptUrl: "#",
  },
  {
    id: "DON-002",
    date: "2024-01-15",
    amount: 1000,
    type: "monthly",
    campaign: "General Support",
    receiptUrl: "#",
  },
  {
    id: "DON-003",
    date: "2024-01-20",
    amount: 2500,
    type: "one-time",
    campaign: "Medical Care Fund",
    receiptUrl: "#",
  },
  {
    id: "DON-004",
    date: "2024-02-05",
    amount: 3000,
    type: "one-time",
    campaign: "Feed Program",
    receiptUrl: "#",
  },
  {
    id: "DON-005",
    date: "2024-02-10",
    amount: 1500,
    type: "monthly",
    campaign: "General Support",
    receiptUrl: "#",
  },
  {
    id: "DON-006",
    date: "2024-02-15",
    amount: 4000,
    type: "one-time",
    campaign: "Emergency Care",
    receiptUrl: "#",
  },
  {
    id: "DON-007",
    date: "2024-02-20",
    amount: 2000,
    type: "one-time",
    campaign: "Shelter Renovation",
    receiptUrl: "#",
  },
  {
    id: "DON-008",
    date: "2024-02-25",
    amount: 1200,
    type: "monthly",
    campaign: "General Support",
    receiptUrl: "#",
  },
  {
    id: "DON-009",
    date: "2024-03-01",
    amount: 5500,
    type: "one-time",
    campaign: "Medical Care Fund",
    receiptUrl: "#",
  },
  {
    id: "DON-010",
    date: "2024-03-05",
    amount: 3500,
    type: "one-time",
    campaign: "Winter Shelter Fund",
    receiptUrl: "#",
  },
  {
    id: "DON-011",
    date: "2024-03-10",
    amount: 1800,
    type: "monthly",
    campaign: "General Support",
    receiptUrl: "#",
  },
  {
    id: "DON-012",
    date: "2024-03-15",
    amount: 2700,
    type: "one-time",
    campaign: "Feed Program",
    receiptUrl: "#",
  },
];

const DONATIONS_PER_PAGE = 10;

export function DonationHistory() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const cardRef = useRef<HTMLDivElement>(null);

  const totalPages = Math.ceil(mockDonations.length / DONATIONS_PER_PAGE);

  const paginatedDonations = useMemo(() => {
    const startIndex = (currentPage - 1) * DONATIONS_PER_PAGE;
    const endIndex = startIndex + DONATIONS_PER_PAGE;
    return mockDonations.slice(startIndex, endIndex);
  }, [currentPage]);

  useEffect(() => {
    if (cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [currentPage]);

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
          {mockDonations.length === 0 ? (
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
                    id={donation.id}
                    date={donation.date}
                    total={donation.amount}
                    idLabel={t("donate.history.donationId")}
                    dateLabel={t("donate.history.donated")}
                    detailsLabel={t("donate.history.campaign")}
                    badge={{
                      label:
                        donation.type === "monthly"
                          ? t("donate.monthly")
                          : t("oneTime"),
                      color:
                        donation.type === "monthly"
                          ? "bg-blue-500"
                          : "bg-gray-500",
                    }}
                    items={[
                      {
                        name: donation.campaign,
                        price: donation.amount,
                      },
                    ]}
                    action={{
                      label: t("profile.downloadReceipt"),
                      icon: <Download className="h-4 w-4 mr-2" />,
                      onClick: () => {
                        window.open(donation.receiptUrl, "_blank");
                      },
                      show: true,
                    }}
                  />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-6 pt-4 border-t">
                  <div className="text-sm text-muted-foreground">
                    {t("donate.history.showing", {
                      start: (currentPage - 1) * DONATIONS_PER_PAGE + 1,
                      end: Math.min(
                        currentPage * DONATIONS_PER_PAGE,
                        mockDonations.length
                      ),
                      total: mockDonations.length,
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.max(1, prev - 1))
                      }
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("common.previous")}
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                        (page) => (
                          <Button
                            key={page}
                            variant={
                              currentPage === page ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => setCurrentPage(page)}
                            className="w-9 h-9 p-0"
                          >
                            {page}
                          </Button>
                        )
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                      }
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

      {/* Total Impact Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t("profile.yourImpact")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold text-primary">
                ₹{mockDonations.reduce((sum, d) => sum + d.amount, 0)}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("profile.totalDonated")}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {mockDonations.length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("profile.donationsMade")}
              </p>
            </div>
            <div className="text-center p-4 bg-muted rounded-lg">
              <p className="text-3xl font-bold text-primary">
                {mockDonations.filter((d) => d.type === "monthly").length}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {t("profile.activeRecurring")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
