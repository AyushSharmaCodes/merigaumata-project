import { useTranslation } from "react-i18next";
import { Badge } from "@/shared/components/ui/badge";
import { OrderStatus } from "@/shared/types";

interface OrderStatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export const OrderStatusBadge = ({ status, className = "" }: OrderStatusBadgeProps) => {
  const { t } = useTranslation();

  const statusConfig: Record<
    OrderStatus,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline"; className: string }
  > = {
    // Normal Flow
    pending: {
      label: t("admin.orders.status.pending"),
      variant: "outline",
      className: "bg-gray-100 text-gray-800",
    },
    confirmed: {
      label: t("admin.orders.status.confirmed"),
      variant: "default",
      className: "bg-yellow-500 text-white",
    },
    processing: {
      label: t("admin.orders.status.processing"),
      variant: "secondary",
      className: "bg-blue-400 text-white",
    },
    packed: {
      label: t("admin.orders.status.packed"),
      variant: "default",
      className: "bg-blue-500 text-white",
    },
    shipped: {
      label: t("admin.orders.status.shipped"),
      variant: "default",
      className: "bg-blue-600 text-white",
    },
    out_for_delivery: {
      label: t("admin.orders.status.outForDelivery"),
      variant: "default",
      className: "bg-indigo-500 text-white",
    },
    delivered: {
      label: t("admin.orders.status.delivered"),
      variant: "default",
      className: "bg-green-500 text-white",
    },
    // Cancellation & Refund
    cancelled: {
      label: t("admin.orders.status.cancelled"),
      variant: "destructive",
      className: "bg-red-500 text-white",
    },
    cancelled_by_admin: {
      label: t("admin.orders.status.cancelled", "Cancelled"),
      variant: "destructive",
      className: "bg-red-500 text-white",
    },
    cancelled_by_customer: {
      label: t("admin.orders.status.cancelled", "Cancelled"),
      variant: "destructive",
      className: "bg-red-400 text-white",
    },
    refunded: {
      label: t("admin.orders.status.refunded"),
      variant: "default",
      className: "bg-green-400 text-white",
    },
    // Return Flow
    return_requested: {
      label: t("admin.orders.status.returnRequested"),
      variant: "default",
      className: "bg-purple-400 text-white",
    },
    return_approved: {
      label: t("admin.orders.status.returnApproved"),
      variant: "default",
      className: "bg-purple-600 text-white",
    },
    pickup_scheduled: {
      label: t("admin.orders.status.pickup_scheduled", "Pickup Scheduled"),
      variant: "default",
      className: "bg-indigo-500 text-white",
    },
    pickup_attempted: {
      label: t("admin.orders.status.pickup_attempted", "Pickup Attempted"),
      variant: "default",
      className: "bg-indigo-400 text-white",
    },
    pickup_completed: {
      label: t("admin.orders.status.pickup_completed", "Pickup Completed"),
      variant: "default",
      className: "bg-indigo-600 text-white",
    },
    picked_up: {
      label: t("admin.orders.status.picked_up", "Picked Up"),
      variant: "default",
      className: "bg-indigo-700 text-white",
    },
    in_transit_to_warehouse: {
      label: t("admin.orders.status.in_transit_to_warehouse", "In Transit to Warehouse"),
      variant: "default",
      className: "bg-blue-700 text-white",
    },
    return_picked_up: {
      label: t("admin.orders.status.returnPickedUp", "Return Picked Up"),
      variant: "default",
      className: "bg-purple-500 text-white",
    },
    return_rejected: {
      label: t("admin.orders.status.returnRejected"),
      variant: "destructive",
      className: "bg-red-400 text-white",
    },
    returned: {
      label: t("admin.orders.status.returned"),
      variant: "default",
      className: "bg-purple-700 text-white",
    },
    partially_returned: {
      label: t("admin.orders.status.partially_returned"),
      variant: "default",
      className: "bg-purple-500 text-white",
    },
    partially_refunded: {
      label: t("admin.orders.status.partially_refunded"),
      variant: "default",
      className: "bg-teal-500 text-white",
    },
    partial_refunded: {
      label: t("admin.orders.status.partial_refunded", "Partially Refunded"),
      variant: "default",
      className: "bg-teal-500 text-white",
    },
    qc_initiated: {
      label: t("admin.orders.status.qc_initiated", "QC Initiated"),
      variant: "default",
      className: "bg-sky-700 text-white",
    },
    qc_passed: {
      label: t("admin.orders.status.qc_passed", "QC Passed"),
      variant: "default",
      className: "bg-emerald-700 text-white",
    },
    qc_failed: {
      label: t("admin.orders.status.qc_failed", "QC Failed"),
      variant: "default",
      className: "bg-amber-600 text-white",
    },
    partial_refund: {
      label: t("admin.orders.status.partial_refund", "Partial Refund"),
      variant: "default",
      className: "bg-teal-600 text-white",
    },
    zero_refund: {
      label: t("admin.orders.status.zero_refund", "Zero Refund"),
      variant: "default",
      className: "bg-amber-700 text-white",
    },
    return_back_to_customer: {
      label: t("admin.orders.status.return_back_to_customer", "Return Back to Customer"),
      variant: "default",
      className: "bg-amber-500 text-white",
    },
    dispose_liquidate: {
      label: t("admin.orders.status.dispose_liquidate", "Dispose / Liquidate"),
      variant: "default",
      className: "bg-slate-700 text-white",
    },
    delivery_unsuccessful: {
      label: t("admin.orders.status.delivery_unsuccessful"),
      variant: "default",
      className: "bg-orange-600 text-white",
    },
    delivery_reattempt_scheduled: {
      label: t("admin.orders.status.delivery_reattempt_scheduled", "Delivery Reattempt Scheduled"),
      variant: "default",
      className: "bg-indigo-400 text-white",
    },
    rto_in_transit: {
      label: t("admin.orders.status.rto_in_transit", "RTO In Transit"),
      variant: "default",
      className: "bg-violet-600 text-white",
    },
    returned_to_origin: {
      label: t("admin.orders.status.returned_to_origin", "Returned to Origin"),
      variant: "default",
      className: "bg-violet-800 text-white",
    },
  };

  const config = statusConfig[status] || {
    label: status,
    variant: "outline",
    className: "bg-gray-100 text-gray-800",
  };

  return (
    <Badge className={`${config.className} ${className}`} variant={config.variant}>
      {t(`admin.orders.status.${status}`, config.label)}
    </Badge>
  );
};
