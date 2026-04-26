import { useAdminOrdersPage } from "../hooks/useAdminOrdersPage";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/shared/components/ui/pagination";
import {
  Download,
} from "lucide-react";
import { OrderStatsCards } from "./OrderStatsCards";
import { AdminTableSkeleton } from "@/shared/components/ui/page-skeletons";

// Sub-components
import { AdminOrdersFilters } from "./AdminOrdersFilters";
import { AdminOrdersTable } from "./AdminOrdersTable";
import { OrderDetailsDialog } from "./OrderDetailsDialog";

export function OrdersManagement() {

  const controller = useAdminOrdersPage();
  const {
    t,
    navigate,
    basePath,
    searchQuery,
    setSearchQuery,
    selectedOrder,
    setSelectedOrder,
    detailsOpen,
    setDetailsOpen,
    currentPage,
    setCurrentPage,
    totalPages,
    totalOrders,
    statusFilter,
    setStatusFilter,
    paymentFilter,
    setPaymentFilter,
    allOrders,
    isLoading,
    isFetching,
    refetch,
    handleExport
  } = controller;

  const handleViewDetails = (orderId: string) => {
    navigate(`${basePath}/orders/${orderId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">{t("admin.orders.title")}</h2>
          <p className="text-muted-foreground">
            {t("admin.orders.subtitle")}
          </p>
        </div>
      </div>

      <OrderStatsCards 
        activeStatus={statusFilter}
        onFilterChange={(status) => {
          setStatusFilter(status);
        }} 
      />

      <AdminOrdersFilters
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
        isFetching={isFetching}
        onRefresh={refetch}
      />

      <Card>
        <CardContent className="pt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">{t("admin.orders.title")}</h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport(allOrders, "orders")}
            >
              <Download className="h-4 w-4 mr-2" />
              {t("admin.orders.export.button")}
            </Button>
          </div>
          
          <div className="relative min-h-[400px]">
             {isLoading ? (
              <AdminTableSkeleton columns={7} rows={10} />
            ) : (
              <AdminOrdersTable 
                orders={allOrders} 
                onViewDetails={handleViewDetails}
              />
            )}
            
            {!isLoading && isFetching && (
              <div className="absolute top-2 right-2 animate-pulse">
                <div className="h-2 w-2 bg-primary rounded-full" />
              </div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-4">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage > 1) setCurrentPage(p => p - 1);
                      }}
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                    const pageNum = i + 1;
                    return (
                      <PaginationItem key={i}>
                        <PaginationLink
                          href="#"
                          isActive={currentPage === pageNum}
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(pageNum);
                          }}
                        >
                          {pageNum}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      onClick={(e) => {
                        e.preventDefault();
                        if (currentPage < totalPages) setCurrentPage(p => p + 1);
                      }}
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>

              <p className="text-sm text-muted-foreground text-center mt-2">
                {t("admin.orders.pagination.pageInfo", { current: currentPage, total: totalPages, count: totalOrders })}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <OrderDetailsDialog 
        order={selectedOrder}
        open={detailsOpen}
        onOpenChange={setDetailsOpen}
      />
    </div>
  );
}
