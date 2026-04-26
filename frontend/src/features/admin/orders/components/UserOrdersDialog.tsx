import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table";
import { Badge } from "@/shared/components/ui/badge";
import type { Order } from "@/shared/types";
import { format } from "date-fns";
import { orderService } from "@/domains/order";
import { useTranslation } from 'react-i18next';

interface UserOrdersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
}

export function UserOrdersDialog({
  open,
  onOpenChange,
  userId,
}: UserOrdersDialogProps) {
  const { t } = useTranslation();
  const { data: orders = [], isLoading } = useQuery<Order[]>({
    queryKey: ["user-orders", userId],
    queryFn: async () => {
      if (!userId) return [];
      const response = await orderService.getAll({ userId: userId || undefined });
      return response.data || [];
    },
    enabled: open && !!userId,
  });

  const getStatusColor = (status: Order["status"]) => {
    const defaultColor = "secondary";
    switch (status) {
      case "confirmed":
      case "shipped":
      case "delivered":
        return "default";
      case "cancelled":
        return "destructive";
      default:
        return defaultColor;
    }
  };

  const getPaymentStatusColor = (status: Order["paymentStatus"]) => {
    const colors: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      paid: "default",
      failed: "destructive",
      refunded: "secondary",
    };
    return colors[status] || "secondary";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('admin.users.ordersDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('admin.users.ordersDialog.description', { defaultValue: 'View all orders placed by this user' })}
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.loading')}
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('admin.users.ordersDialog.noOrders', { defaultValue: 'No orders found for this user.' })}
            </div>
          ) : (
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('admin.users.ordersDialog.orderId')}</TableHead>
                    <TableHead>{t('common.date')}</TableHead>
                    <TableHead>{t('admin.users.ordersDialog.items')}</TableHead>
                    <TableHead>{t('admin.users.ordersDialog.total')}</TableHead>
                    <TableHead>{t('admin.users.ordersDialog.status')}</TableHead>
                    <TableHead>{t('admin.users.ordersDialog.payment')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow key={order.id}>
                      <TableCell className="font-medium">{order.id}</TableCell>
                      <TableCell>
                        {order.createdAt
                          ? format(new Date(order.createdAt), "MMM dd, yyyy")
                          : "N/A"}
                      </TableCell>
                      <TableCell>{order.items?.length || 0} items</TableCell>
                      <TableCell>₹{order.total.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(order.status)}>
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={getPaymentStatusColor(order.paymentStatus)}
                        >
                          {order.paymentStatus}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
