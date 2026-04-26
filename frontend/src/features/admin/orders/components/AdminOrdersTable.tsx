import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { Eye, ShoppingCart } from "lucide-react";
import { Button } from "@/shared/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import { Order } from "@/shared/types";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface AdminOrdersTableProps {
  orders: Order[];
  onViewDetails: (orderId: string) => void;
}

export const AdminOrdersTable = ({ orders, onViewDetails }: AdminOrdersTableProps) => {
  const { t } = useTranslation();

  if (orders.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <ShoppingCart className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>{t("admin.orders.empty")}</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("admin.orders.table.id")}</TableHead>
            <TableHead>{t("admin.orders.table.date")}</TableHead>
            <TableHead>{t("admin.orders.table.customer")}</TableHead>
            <TableHead>{t("admin.orders.table.items")}</TableHead>
            <TableHead>{t("admin.orders.table.total")}</TableHead>
            <TableHead>{t("admin.orders.table.status")}</TableHead>
            <TableHead>{t("admin.orders.table.payment")}</TableHead>
            <TableHead className="text-right">{t("admin.orders.table.actions")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => (
            <TableRow key={order.id}>
              <TableCell className="font-medium font-mono text-xs">
                {order.order_number || order.id}
              </TableCell>
              <TableCell>
                {format(new Date(order.createdAt || order.created_at || Date.now()), "MMM d, yyyy")}
              </TableCell>
              <TableCell>
                <div className="flex flex-col">
                  <span className="font-medium">
                    {order.customer_name || t("admin.orders.table.guest")}
                  </span>
                  <span className="text-xs text-muted-foreground">{order.customer_email}</span>
                </div>
              </TableCell>
              <TableCell>{order.items?.length || 0} items</TableCell>
              <TableCell className="font-medium">
                ₹{(order.total || order.total_amount || 0).toFixed(2)}
              </TableCell>
              <TableCell>
                <OrderStatusBadge status={order.status} />
              </TableCell>
              <TableCell>
                <Badge
                  variant={
                    (order.paymentStatus || order.payment_status) === "paid"
                      ? "default"
                      : (order.paymentStatus || order.payment_status) === "failed"
                        ? "destructive"
                        : "secondary"
                  }
                >
                  {(() => {
                    const rawStatus = order.paymentStatus || order.payment_status || "pending";
                    const normalized = rawStatus.toLowerCase().replace('status.', '').trim().replace(/ /g, '_');
                    return t(`admin.orders.status.${normalized}`, rawStatus);
                  })()}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onViewDetails(order.id)}
                  title={t("admin.orders.toasts.viewOrderDetails")}
                >
                  <Eye className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
};
