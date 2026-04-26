import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { AdminTableSkeleton } from "@/shared/components/ui/page-skeletons";
import { useMyOrdersPage } from "../hooks/useMyOrdersPage";

// Sub-components
import { MyOrdersHero } from "./MyOrdersHero";
import { MyOrdersFilters } from "./MyOrdersFilters";
import { MyOrdersTable } from "./MyOrdersTable";

export const MyOrdersPage = () => {
    const { t } = useTranslation();
    const {
        orders,
        meta,
        loading,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        paymentStatusFilter,
        setPaymentStatusFilter,
        dateRange,
        setDateRange,
        handlePageChange,
        clearFilters,
    } = useMyOrdersPage();

    return (
        <div className="min-h-screen bg-[#FDFBF9]">
            <MyOrdersHero />

            <div className="container mx-auto px-4 -mt-10 pb-20 relative z-20">
                <MyOrdersFilters
                    searchQuery={searchQuery}
                    setSearchQuery={setSearchQuery}
                    statusFilter={statusFilter}
                    setStatusFilter={setStatusFilter}
                    paymentStatusFilter={paymentStatusFilter}
                    setPaymentStatusFilter={setPaymentStatusFilter}
                    dateRange={dateRange}
                    setDateRange={setDateRange}
                    onClearFilters={clearFilters}
                />

                {loading ? (
                    <AdminTableSkeleton columns={6} rows={5} />
                ) : (
                    <div className="space-y-6">
                        <MyOrdersTable orders={orders} />

                        {/* Pagination Controls */}
                        {meta.totalPages > 1 && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-6 bg-white rounded-[2rem] p-6 shadow-soft border border-border/40">
                                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                                    {t("myOrders.pagination", {
                                        start: ((meta.page - 1) * meta.limit) + 1,
                                        end: Math.min(meta.page * meta.limit, meta.total),
                                        total: meta.total
                                    })}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(meta.page - 1)}
                                        disabled={meta.page === 1}
                                        className="rounded-full h-10 px-4 border-border/60 text-muted-foreground hover:text-[#2C1810] hover:bg-muted/50 transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-30"
                                    >
                                        <ChevronLeft className="h-4 w-4 mr-1.5" />
                                        {t("myOrders.previous")}
                                    </Button>

                                    <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-full">
                                        {Array.from({ length: Math.min(meta.totalPages, 5) }, (_, i) => {
                                            const pageNum = i + 1;
                                            return (
                                                <Button
                                                    key={pageNum}
                                                    variant={pageNum === meta.page ? "default" : "ghost"}
                                                    size="sm"
                                                    className={`h-8 w-8 rounded-full p-0 font-bold text-[10px] ${pageNum === meta.page
                                                        ? "bg-[#B85C3C] text-white hover:bg-[#B85C3C] shadow-md shadow-[#B85C3C]/20"
                                                        : "text-muted-foreground hover:bg-[#B85C3C]/10 hover:text-[#B85C3C]"
                                                        }`}
                                                    onClick={() => handlePageChange(pageNum)}
                                                >
                                                    {pageNum}
                                                </Button>
                                            );
                                        })}
                                    </div>

                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handlePageChange(meta.page + 1)}
                                        disabled={meta.page === meta.totalPages}
                                        className="rounded-full h-10 px-4 border-border/60 text-muted-foreground hover:text-[#2C1810] hover:bg-muted/50 transition-all font-bold text-[10px] uppercase tracking-widest disabled:opacity-30"
                                    >
                                        {t("myOrders.next")}
                                        <ChevronRight className="h-4 w-4 ml-1.5" />
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};
