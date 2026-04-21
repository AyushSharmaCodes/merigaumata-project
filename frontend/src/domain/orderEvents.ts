/**
 * Order Domain Events
 */

export enum OrderEventType {
  STATE_CHANGED = "order.state_changed",
  REFUND_REQUIRED = "order.refund_required",
  INVENTORY_RESTORE_REQUIRED = "order.inventory_restore_required",
  DELIVERY_FAILED = "order.delivery_failed",
}

export interface OrderEvent {
  type: OrderEventType;
  order_id: string;
  payload: any;
  timestamp: string;
}

/**
 * Maps a state transition to an event type
 */
export const mapStatusToEvent = (newStatus: string): OrderEventType | null => {
  const refundStatuses = ["cancelled_by_admin", "cancelled_by_customer", "returned", "returned_to_origin", "partially_returned"];
  
  if (refundStatuses.includes(newStatus)) {
    return OrderEventType.REFUND_REQUIRED;
  }

  if (newStatus === "delivery_unsuccessful") {
    return OrderEventType.DELIVERY_FAILED;
  }

  return OrderEventType.STATE_CHANGED;
};
