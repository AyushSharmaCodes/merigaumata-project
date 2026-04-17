import { PhysicalOrderState, ReturnOrderState } from "./orderStateMachine";

/**
 * State Reversion Logic
 * Used to calculate the target state when a return is rejected or cancelled.
 */

export interface OrderSnapshot {
  current_status: string;
  previous_status?: string | null;
  status_history: Array<{ status: string; created_at: string }>;
}

/**
 * Calculates the appropriate state to revert to.
 * Primary target is finding the last successful delivery or physical state.
 */
export const calculateReversionState = (order: OrderSnapshot): string => {
  // If we have an explicit previous_status, use it.
  if (order.previous_status) {
    return order.previous_status;
  }

  // Fallback: search history for the most recent non-return state
  const physicalStates = Object.values(PhysicalOrderState) as string[];
  
  const lastPhysical = [...order.status_history]
    .reverse()
    .find(h => physicalStates.includes(h.status));

  return lastPhysical ? lastPhysical.status : PhysicalOrderState.DELIVERED;
};

/**
 * Checks if a status indicates a reversion branch
 */
export const isReversionStatus = (status: string): boolean => {
  return [
    ReturnOrderState.RETURN_REJECTED,
    ReturnOrderState.RETURN_CANCELLED,
  ].includes(status as ReturnOrderState);
};
