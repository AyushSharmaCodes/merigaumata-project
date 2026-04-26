import { format } from "date-fns";
import { enIN, hi } from "date-fns/locale";
import { ChevronRight, ShoppingBag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/shared/components/ui/button";
import { Badge } from "@/shared/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Card, CardContent } from "@/shared/components/ui/card";
import { useCurrency } from "@/app/providers/currency-provider";
import { Order } from "@/shared/types";

interface MyOrdersTableProps {
  orders: Order[];
}

export const MyOrdersTable = ({ orders }: MyOrdersTableProps) => {
  const { t, i18n } = useTranslation();
  const { formatAmount } = useCurrency();
  const navigate = useNavigate();

  const getStatusColor = (status: string) => {
    switch (status) {
      case "confirmed": return "bg-blue-50 text-blue-700 border-blue-200/50";
      case "processing": return "bg-amber-50 text-amber-700 border-amber-200/50";
      case "packed": return "bg-indigo-50 text-indigo-700 border-indigo-200/50";
      case "shipped": return "bg-purple-50 text-purple-700 border-purple-200/50";
      case "delivered": return "bg-emerald-50 text-emerald-700 border-emerald-200/50";
      case "cancelled": return "bg-rose-50 text-rose-700 border-rose-200/50";
      case "return_requested": return "bg-orange-50 text-orange-700 border-orange-200/50";
      case "returned": return "bg-slate-50 text-slate-700 border-slate-200/50";
      default: return "bg-slate-50 text-slate-700 border-slate-200/50";
    }
  };

  if (orders.length === 0) {
    return (
      <Card className="text-center py-24 bg-white rounded-[2.5rem] border-none shadow-elevated overflow-hidden">
        <CardContent className="flex flex-col items-center gap-6">
          <div className="h-24 w-24 bg-[#FDFBF9] rounded-full flex items-center justify-center shadow-soft border border-border/40">
            <ShoppingBag className="h-10 w-10 text-[#B85C3C] opacity-40" />
          </div>
          <div className="space-y-2">
            <h3 className="text-2xl font-playfair font-bold text-[#2C1810]">{t("myOrders.noOrdersTitle")}</h3>
            <p className="text-muted-foreground text-sm max-w-sm mx-auto italic">
              {t("myOrders.noOrdersDesc")}
            </p>
          </div>
          <Button
            onClick={() => navigate("/shop")}
            className="mt-4 bg-[#2C1810] hover:bg-[#B85C3C] text-white rounded-full font-bold text-xs uppercase tracking-widest px-10 h-12 shadow-lg transition-all"
          >
            {t("myOrders.shopCollection")}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="rounded-[2rem] shadow-elevated overflow-hidden border-none bg-white">
      <Table>
        <TableHeader className="bg-muted/30">
          <TableRow className="border-border/40 hover:bg-transparent">
            <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6 pl-8">{t("myOrders.table.info")}</TableHead>
            <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6">{t("myOrders.table.timeline")}</TableHead>
            <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6">{t("myOrders.table.status")}</TableHead>
            <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6">{t("myOrders.table.payment")}</TableHead>
            <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6 text-right">{t("myOrders.table.investment")}</TableHead>
            <TableHead className="font-bold text-[#2C1810] uppercase tracking-widest text-[10px] py-6 text-right pr-8">{t("myOrders.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id} className="border-border/40 hover:bg-[#FDFBF9]/50 transition-colors group">
              <TableCell className="py-6 pl-8">
                <div className="flex flex-col">
                  <span className="font-bold text-[#2C1810] group-hover:text-[#B85C3C] transition-colors">
                    #{order.order_number || order.id.substring(0, 8).toUpperCase()}
                  </span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{t("myOrders.table.standard")}</span>
                </div>
              </TableCell>
              <TableCell className="py-6">
                <span className="text-sm font-medium text-muted-foreground">
                  {(() => {
                    const dateStr = order.created_at || order.createdAt || "";
                    const date = dateStr ? new Date(dateStr) : new Date();
                    return !isNaN(date.getTime()) ? format(date, "MMM d, yyyy", { locale: i18n.language === "hi" ? hi : enIN }) : "N/A";
                  })()}
                </span>
              </TableCell>
              <TableCell className="py-6">
                <Badge variant="outline" className={`rounded-full px-3 py-1 font-bold text-[10px] tracking-widest uppercase border-transparent shadow-sm ${getStatusColor(order.status)}`}>
                  {t(`myOrders.statuses.${order.status}`, { defaultValue: (order.status && typeof order.status === 'string' ? order.status.replace(/_/g, " ") : 'Processing') })}
                </Badge>
              </TableCell>
              <TableCell className="py-6">
                <div className="flex items-center gap-1.5">
                  <Badge variant="secondary" className="rounded-full bg-[#2C1810]/5 text-[#2C1810] hover:bg-[#2C1810]/5 font-bold text-[10px] tracking-widest py-0.5 px-2 uppercase shadow-none border-none">
                    {t(`myOrders.paymentStatuses.${order.payment_status}`, { defaultValue: order.payment_status })}
                  </Badge>
                </div>
              </TableCell>
              <TableCell className="py-6 text-right">
                <span className="text-sm font-bold text-[#2C1810]">
                  {formatAmount(order.total_amount ?? order.total ?? 0)}
                </span>
              </TableCell>
              <TableCell className="py-6 text-right pr-8">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/my-orders/${order.id}`)}
                  className="rounded-full hover:bg-[#B85C3C] hover:text-white font-bold text-[10px] uppercase tracking-widest h-9 px-4 transition-all"
                >
                  {t("myOrders.table.unveilDetails")} <ChevronRight className="ml-1.5 h-3.5 w-3.5" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
