/**
 * QC (Quality Check) Domain Service
 * Frontend mirrored constants and types for post-return processing.
 */

export const QC_REASONS = {
    CUSTOMER_DAMAGE: 'CUSTOMER_DAMAGE',
    USED_OR_WORN: 'USED_OR_WORN',
    MISSING_ACCESSORIES: 'MISSING_ACCESSORIES',
    WRONG_ITEM_RETURNED: 'WRONG_ITEM_RETURNED',
    NON_RESELLABLE: 'NON_RESELLABLE',
    FRAUD_DETECTED: 'FRAUD_DETECTED'
} as const;

export const QC_SEVERITY = {
    LOW: 25,
    MEDIUM: 50,
    HIGH: 75,
    CRITICAL: 100
} as const;

export const QC_STATUS = {
    PENDING: 'pending',
    PASSED: 'passed',
    FAILED: 'failed'
} as const;

export const QC_OUTCOME_ACTIONS = {
    FULL_REFUND: 'FULL_REFUND',
    PARTIAL_REFUND: 'PARTIAL_REFUND',
    ZERO_REFUND: 'ZERO_REFUND',
    RETURN_TO_CUSTOMER: 'RETURN_TO_CUSTOMER',
    DISPOSE: 'DISPOSE'
} as const;

export const QC_INVENTORY_ROUTING = {
    SELLABLE: 'SELLABLE',
    DAMAGED: 'DAMAGED',
    SCRAP: 'SCRAP',
    REFURBISHABLE: 'REFURBISHABLE',
    BLOCKED: 'BLOCKED'
} as const;

export type QCReason = keyof typeof QC_REASONS;
export type QCSeverity = typeof QC_SEVERITY[keyof typeof QC_SEVERITY];
export type QCStatus = typeof QC_STATUS[keyof typeof QC_STATUS];
export type QCOutcomeAction = keyof typeof QC_OUTCOME_ACTIONS;
export type QCInventoryRoute = keyof typeof QC_INVENTORY_ROUTING;

export interface QCAuditData {
    id?: string;
    return_id: string;
    return_item_id: string;
    order_id: string;
    status: QCStatus;
    reason_code?: QCReason;
    severity?: number;
    deduction_amount?: number;
    reverse_logistics_cost?: number;
    action_taken?: QCOutcomeAction;
    inventory_action?: QCInventoryRoute;
    is_fraud_flagged?: boolean;
    evidence_urls?: string[];
    notes?: string;
    auditor_name?: string;
    scanned_at?: string;
}
