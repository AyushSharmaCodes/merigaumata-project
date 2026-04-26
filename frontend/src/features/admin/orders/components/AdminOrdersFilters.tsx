import { Search, Filter, CreditCard, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface AdminOrdersFiltersProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  isFetching: boolean;
  onRefresh: () => void;
}

export const AdminOrdersFilters = ({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  isFetching,
  onRefresh,
}: AdminOrdersFiltersProps) => {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
      <div className="relative flex-1 w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          id="order-admin-search"
          name="search"
          placeholder={t("admin.orders.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-[180px]">
            <Filter className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t("admin.orders.filterStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.orders.filterStatus")}</SelectItem>
            <SelectItem value="pending,confirmed">{t("admin.orders.stats.new", "New Orders")}</SelectItem>
            <SelectItem value="processing,packed,shipped,out_for_delivery,delivery_reattempt_scheduled,rto_in_transit,return_approved,return_picked_up">{t("admin.orders.stats.processing", "Orders in Process")}</SelectItem>
            <SelectItem value="cancelled_flow">{t("admin.orders.stats.cancelled", "Cancelled Orders")}</SelectItem>
            <SelectItem value="returned_flow">{t("admin.orders.stats.returned", "Returned Orders")}</SelectItem>
            <SelectItem value="failed_flow">{t("admin.orders.stats.failed", "Failed Orders")}</SelectItem>
            {/* Normal Flow */}
            <SelectItem value="pending">{t("admin.orders.status.pending")}</SelectItem>
            <SelectItem value="confirmed">{t("admin.orders.status.confirmed")}</SelectItem>
            <SelectItem value="processing">{t("admin.orders.status.processing")}</SelectItem>
            <SelectItem value="packed">{t("admin.orders.status.packed")}</SelectItem>
            <SelectItem value="shipped">{t("admin.orders.status.shipped")}</SelectItem>
            <SelectItem value="out_for_delivery">{t("admin.orders.status.outForDelivery")}</SelectItem>
            <SelectItem value="delivery_unsuccessful">{t("admin.orders.status.delivery_unsuccessful", "Delivery Unsuccessful")}</SelectItem>
            <SelectItem value="delivery_reattempt_scheduled">{t("admin.orders.status.delivery_reattempt_scheduled", "Delivery Reattempt Scheduled")}</SelectItem>
            <SelectItem value="rto_in_transit">{t("admin.orders.status.rto_in_transit", "RTO In Transit")}</SelectItem>
            <SelectItem value="returned_to_origin">{t("admin.orders.status.returned_to_origin", "Returned to Origin")}</SelectItem>
            <SelectItem value="delivered">{t("admin.orders.status.delivered")}</SelectItem>
            {/* Cancellation & Refund */}
            <SelectItem value="cancelled">{t("admin.orders.status.cancelled")}</SelectItem>
            <SelectItem value="refunded">{t("admin.orders.status.refunded")}</SelectItem>
            {/* Returns */}
            <SelectItem value="return_requested">{t("admin.orders.status.returnRequested")}</SelectItem>
            <SelectItem value="return_approved">{t("admin.orders.status.returnApproved")}</SelectItem>
            <SelectItem value="return_rejected">{t("admin.orders.status.returnRejected")}</SelectItem>
            <SelectItem value="returned">{t("admin.orders.status.returned")}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={paymentFilter} onValueChange={onPaymentFilterChange}>
          <SelectTrigger className="w-[180px]">
            <CreditCard className="mr-2 h-4 w-4" />
            <SelectValue placeholder={t("admin.orders.filterPayment")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.orders.filterPayment")}</SelectItem>
            <SelectItem value="pending">{t("admin.orders.status.pending")}</SelectItem>
            <SelectItem value="paid">{t("admin.orders.status.paid")}</SelectItem>
            <SelectItem value="failed">{t("admin.orders.status.failed")}</SelectItem>
            <SelectItem value="refund_initiated">{t("admin.orders.status.refundInitiated")}</SelectItem>
            <SelectItem value="refund_in_progress">{t("admin.orders.status.refundInProgress")}</SelectItem>
            <SelectItem value="refunded">{t("admin.orders.status.refunded")}</SelectItem>
            <SelectItem value="partially_refunded">{t("admin.orders.status.partiallyRefunded")}</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="icon"
          onClick={onRefresh}
          disabled={isFetching}
          title={t("admin.orders.refresh")}
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  );
};
