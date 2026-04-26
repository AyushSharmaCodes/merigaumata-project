import { Filter, Search, Package, CreditCard, Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select";

interface MyOrdersFiltersProps {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  statusFilter: string;
  setStatusFilter: (value: string) => void;
  paymentStatusFilter: string;
  setPaymentStatusFilter: (value: string) => void;
  dateRange: { start: string; end: string };
  setDateRange: (range: { start: string; end: string }) => void;
  onClearFilters: () => void;
}

export const MyOrdersFilters = ({
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  paymentStatusFilter,
  setPaymentStatusFilter,
  dateRange,
  setDateRange,
  onClearFilters,
}: MyOrdersFiltersProps) => {
  const { t } = useTranslation();

  const hasActiveFilters = searchQuery || statusFilter !== "all" || paymentStatusFilter !== "all" || dateRange.start || dateRange.end;

  return (
    <Card className="rounded-[2.5rem] border-none shadow-elevated overflow-hidden bg-white mb-8">
      <div className="bg-muted/30 p-4 border-b border-border/40">
        <div className="flex items-center gap-2 text-[#2C1810] px-2">
          <Filter className="h-4 w-4 text-[#B85C3C]" />
          <span className="text-xs font-bold uppercase tracking-widest">{t("myOrders.refineSearch")}</span>
        </div>
      </div>
      <CardContent className="p-6 md:p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative group col-span-1 md:col-span-2 lg:col-span-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-[#B85C3C] transition-colors" />
            <Input
              id="order-search"
              name="order-search"
              placeholder={t("myOrders.orderPlaceholder")}
              className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger aria-label={t("myOrders.status")} className="h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-[#B85C3C]" />
                <SelectValue placeholder={t("myOrders.status")} />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-elevated">
              <SelectItem value="all">{t("myOrders.allStatuses")}</SelectItem>
              <SelectItem value="pending">{t("myOrders.statuses.pending")}</SelectItem>
              <SelectItem value="confirmed">{t("myOrders.statuses.confirmed")}</SelectItem>
              <SelectItem value="processing">{t("myOrders.statuses.processing")}</SelectItem>
              <SelectItem value="packed">{t("myOrders.statuses.packed")}</SelectItem>
              <SelectItem value="shipped">{t("myOrders.statuses.shipped")}</SelectItem>
              <SelectItem value="out_for_delivery">{t("myOrders.statuses.outForDelivery")}</SelectItem>
              <SelectItem value="delivered">{t("myOrders.statuses.delivered")}</SelectItem>
              <SelectItem value="return_requested">{t("myOrders.statuses.returnRequested")}</SelectItem>
              <SelectItem value="returned">{t("myOrders.statuses.returned")}</SelectItem>
              <SelectItem value="cancelled">{t("myOrders.statuses.cancelled")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={paymentStatusFilter} onValueChange={setPaymentStatusFilter}>
            <SelectTrigger aria-label={t("myOrders.payment")} className="h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C]">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-[#B85C3C]" />
                <SelectValue placeholder={t("myOrders.payment")} />
              </div>
            </SelectTrigger>
            <SelectContent className="rounded-2xl border-none shadow-elevated">
              <SelectItem value="all">{t("myOrders.allPayments")}</SelectItem>
              <SelectItem value="paid">{t("myOrders.paymentStatuses.paid")}</SelectItem>
              <SelectItem value="pending">{t("myOrders.paymentStatuses.pending")}</SelectItem>
              <SelectItem value="failed">{t("myOrders.paymentStatuses.failed")}</SelectItem>
              <SelectItem value="refund_initiated">{t("myOrders.paymentStatuses.refundInitiated")}</SelectItem>
              <SelectItem value="partially_refunded">{t("myOrders.paymentStatuses.partiallyRefunded")}</SelectItem>
              <SelectItem value="refunded">{t("myOrders.paymentStatuses.refunded")}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="start-date"
              name="start-date"
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
              className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] text-xs"
            />
          </div>
          <div className="relative">
            <Calendar className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              id="end-date"
              name="end-date"
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
              className="pl-10 h-11 rounded-xl border-border/60 bg-white/50 focus:ring-[#B85C3C]/20 focus:border-[#B85C3C] text-xs"
            />
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-6 pt-6 border-t border-dashed border-border/60 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className="text-muted-foreground hover:text-[#B85C3C] hover:bg-[#B85C3C]/5 font-bold text-[10px] uppercase tracking-widest px-4 h-9 rounded-full"
            >
              {t("myOrders.clearFilters")}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
