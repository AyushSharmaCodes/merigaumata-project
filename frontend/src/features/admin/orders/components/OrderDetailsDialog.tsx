import { format } from "date-fns";
import { useTranslation } from "react-i18next";
import { RotateCcw, X as XIcon } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/shared/components/ui/dialog";
import { Label } from "@/shared/components/ui/label";
import { Badge } from "@/shared/components/ui/badge";
import { ScrollArea } from "@/shared/components/ui/scroll-area";
import { Order } from "@/shared/types";
import { OrderStatusBadge } from "./OrderStatusBadge";

interface OrderDetailsDialogProps {
  order: Order | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const OrderDetailsDialog = ({ order, open, onOpenChange }: OrderDetailsDialogProps) => {
  const { t } = useTranslation();

  if (!order) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl max-h-[90vh]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>{t("admin.orders.dialog.title")} - {order.id}</DialogTitle>
        </DialogHeader>
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6">
            {/* Order Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4">
              <div>
                <Label className="text-muted-foreground">{t("admin.orders.dialog.date")}</Label>
                <p className="text-sm font-medium">
                  {format(new Date(order.createdAt || order.created_at || Date.now()), "PPpp")}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">
                  {t("admin.orders.dialog.amount")}
                </Label>
                <p className="text-sm font-semibold">
                  ₹{order.total || order.total_amount}
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">{t("admin.orders.dialog.customerInfo")}</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-muted-foreground">{t("common.status")}</Label>
                    <div className="mt-1">
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </div>
                  <div>
                    <Label className="text-muted-foreground">
                      Payment Status
                    </Label>
                    <div className="mt-1">
                      <Badge
                        variant={
                          (order.paymentStatus || order.payment_status) === "paid"
                            ? "default"
                            : (order.paymentStatus || order.payment_status) === "failed"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {order.paymentStatus || order.payment_status}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cancel Request Details */}
              {(order.cancelReason || order.cancel_reason) && (
                <div className="border rounded-lg p-4 bg-amber-50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <XIcon className="h-4 w-4" />
                    {t("admin.orders.dialog.cancellationRequest")}
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground">{t("admin.orders.dialog.reason")}</Label>
                      <p className="text-sm">{order.cancelReason || order.cancel_reason}</p>
                    </div>
                    {(order.cancelComments || order.cancel_comments) && (
                      <div>
                        <Label className="text-muted-foreground">
                          {t("admin.orders.dialog.comments")}
                        </Label>
                        <p className="text-sm">
                          {order.cancelComments || order.cancel_comments}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Return Request Details */}
              {(order.returnReason || order.return_reason) && (
                <div className="border rounded-lg p-4 bg-purple-50">
                  <h4 className="font-semibold mb-3 flex items-center gap-2">
                    <RotateCcw className="h-4 w-4" />
                    {t("admin.orders.dialog.returnRequest")}
                  </h4>
                  <div className="space-y-2">
                    <div>
                      <Label className="text-muted-foreground">{t("admin.orders.dialog.reason")}</Label>
                      <p className="text-sm">{order.returnReason || order.return_reason}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Shipping Address */}
              <div className="border rounded-lg p-4">
                <Label className="text-muted-foreground">
                  {t("admin.orders.dialog.shippingAddress")}
                </Label>
                <div className="text-sm mt-2 space-y-1">
                  <p>{order.shippingAddress?.addressLine || order.shipping_address?.addressLine}</p>
                  <p>
                    {order.shippingAddress?.city || order.shipping_address?.city},{" "}
                    {order.shippingAddress?.state || order.shipping_address?.state}
                  </p>
                  <p>
                    {order.shippingAddress?.country || order.shipping_address?.country} -{" "}
                    {order.shippingAddress?.pincode || order.shipping_address?.pincode}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            <div className="border rounded-lg p-4">
              <Label className="text-muted-foreground mb-3 block">
                {t("admin.orders.dialog.orderItems")} ({order.items?.length || 0})
              </Label>
              <div className="space-y-3">
                {order.items?.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-2 bg-muted rounded"
                  >
                    {item.product?.images?.[0] && (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        className="h-12 w-12 object-cover rounded"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.product?.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.quantity} x ₹{item.price_per_unit || item.price}
                      </p>
                    </div>
                    <div className="text-sm font-semibold">
                      ₹{(item.quantity * (item.price_per_unit || item.price)).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
