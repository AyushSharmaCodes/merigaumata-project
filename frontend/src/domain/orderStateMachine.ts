/**
 * Order State Machine Logic
 * Strictly Aligned with User-Approved 5-Flow Domain Rules
 * Pure Domain Logic - NO UI COMPONENTS
 */

export enum PhysicalOrderState {
  PENDING = "pending",
  CONFIRMED = "confirmed",
  PROCESSING = "processing",
  PACKED = "packed",
  SHIPPED = "shipped",
  OUT_FOR_DELIVERY = "out_for_delivery",
  DELIVERED = "delivered",
}

export enum DeliveryRecoveryState {
  DELIVERY_UNSUCCESSFUL = "delivery_unsuccessful",
  DELIVERY_REATTEMPT_SCHEDULED = "delivery_reattempt_scheduled",
  RTO_IN_TRANSIT = "rto_in_transit",
  RETURNED_TO_ORIGIN = "returned_to_origin",
}

export enum TerminalOrderState {
  CANCELLED_BY_ADMIN = "cancelled_by_admin",
  CANCELLED_BY_CUSTOMER = "cancelled_by_customer",
  RETURNED = "returned",
  PARTIALLY_RETURNED = "partially_returned",
}

export enum ReturnOrderState {
  RETURN_REQUESTED = "return_requested",
  RETURN_APPROVED = "return_approved",
  PICKUP_SCHEDULED = "return_pickup_scheduled",
  PICKUP_ATTEMPTED = "pickup_attempted",
  PICKUP_COMPLETED = "pickup_completed",
  PICKED_UP = "picked_up",
  IN_TRANSIT_TO_WAREHOUSE = "in_transit_to_warehouse",
  QC_INITIATED = "qc_initiated",
  QC_PASSED = "qc_passed",
  QC_FAILED = "qc_failed",
  PARTIAL_REFUND = "partial_refund",
  ZERO_REFUND = "zero_refund",
  GATEWAY_PROCESSING = "gateway_processing",
  RETURN_TO_CUSTOMER = "return_to_customer",
  DISPOSE = "dispose_liquidate",
  RETURN_REJECTED = "return_rejected",
  RETURN_CANCELLED = "return_cancelled",
  PICKUP_FAILED = "pickup_failed",
}

export enum RefundState {
  REFUND_INITIATED = "refund_initiated",
  REFUNDED = "refunded",
  FAILED = "failed",
}

export const PHYSICAL_FLOW_SEQUENCE = [
  PhysicalOrderState.PENDING,
  PhysicalOrderState.CONFIRMED,
  PhysicalOrderState.PROCESSING,
  PhysicalOrderState.PACKED,
  PhysicalOrderState.SHIPPED,
  PhysicalOrderState.OUT_FOR_DELIVERY,
  PhysicalOrderState.DELIVERED,
];

/**
 * Strict Successful Return Sequence
 */
export const RETURN_FLOW_SEQUENCE = [
  ReturnOrderState.RETURN_REQUESTED,
  ReturnOrderState.RETURN_APPROVED,
  ReturnOrderState.PICKUP_SCHEDULED,
  ReturnOrderState.PICKUP_COMPLETED,
  ReturnOrderState.PICKED_UP,
  ReturnOrderState.IN_TRANSIT_TO_WAREHOUSE,
  ReturnOrderState.QC_INITIATED,
  ReturnOrderState.QC_PASSED,
  RefundState.REFUND_INITIATED,
  RefundState.REFUNDED,
];

export interface OrderItemFlags {
  is_returnable: boolean;
  is_returned: boolean;
  is_requested_for_return: boolean;
}

/**
 * Derives the macro physical state of an order based on item flags
 */
export const derivePhysicalState = (items: OrderItemFlags[]): TerminalOrderState | typeof PhysicalOrderState.DELIVERED => {
  const returnableItems = items.filter(i => i.is_returnable);
  const returnedItems = returnableItems.filter(i => i.is_returned);

  if (returnedItems.length === 0) return PhysicalOrderState.DELIVERED;
  if (returnedItems.length === returnableItems.length) return TerminalOrderState.RETURNED;
  return TerminalOrderState.PARTIALLY_RETURNED;
};
