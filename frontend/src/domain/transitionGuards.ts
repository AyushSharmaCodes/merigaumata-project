import { PhysicalOrderState, ReturnOrderState } from "./orderStateMachine";

/**
 * Transition Guards for Order Lifecycle
 * Strictly business logic, no UI.
 */

/**
 * Check if order can be cancelled.
 * Lock cancellation once logic moves beyond PACKED stage.
 */
export const canCancelOrder = (status: string): boolean => {
  const allowed = [
    PhysicalOrderState.PENDING,
    PhysicalOrderState.CONFIRMED,
    PhysicalOrderState.PROCESSING,
    PhysicalOrderState.PACKED,
  ];
  return allowed.includes(status as PhysicalOrderState);
};

/**
 * Check if a return request can be cancelled by the customer.
 */
export const canCancelReturn = (status: string): boolean => {
  const allowed = [
    ReturnOrderState.RETURN_REQUESTED,
    ReturnOrderState.RETURN_APPROVED,
  ];
  return allowed.includes(status as ReturnOrderState);
};

/**
 * Check if a status update is allowed.
 * Used for backend validation (re-implemented here for parity).
 */
export const isValidPhysicalTransition = (from: string, to: string): boolean => {
  const transitions: Record<string, string[]> = {
    [PhysicalOrderState.PENDING]: [PhysicalOrderState.CONFIRMED, "cancelled_by_admin", "cancelled_by_customer"],
    [PhysicalOrderState.CONFIRMED]: [PhysicalOrderState.PROCESSING, "cancelled_by_admin", "cancelled_by_customer"],
    [PhysicalOrderState.PROCESSING]: [PhysicalOrderState.PACKED, "cancelled_by_admin", "cancelled_by_customer"],
    [PhysicalOrderState.PACKED]: [PhysicalOrderState.SHIPPED, "cancelled_by_admin", "cancelled_by_customer"],
    [PhysicalOrderState.SHIPPED]: [PhysicalOrderState.OUT_FOR_DELIVERY, "delivery_unsuccessful"],
    [PhysicalOrderState.OUT_FOR_DELIVERY]: [PhysicalOrderState.DELIVERED, "delivery_unsuccessful"],
    ["delivery_unsuccessful"]: ["returned", "partially_returned"],
  };

  return (transitions[from] || []).includes(to);
};

/**
 * Determines if a refund should be triggered based on terminal state
 */
export const shouldTriggerRefund = (status: string): boolean => {
  const refundTriggers = [
    "cancelled_by_admin",
    "cancelled_by_customer",
    "returned",
    "partially_returned",
  ];
  return refundTriggers.includes(status);
};
