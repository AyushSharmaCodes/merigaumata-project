/**
 * Financial Event Logger Service
 * Immutable audit logging for GST compliance and financial traceability
 */

const supabase = require('../config/supabase');
const logger = require('../utils/logger');
const { getTraceContext } = require('../utils/async-context');
const { createModuleLogger } = require('../utils/logging-standards');

const log = createModuleLogger('FinancialEventLogger');

// Financial Event Types
const FINANCIAL_EVENTS = {
    // Order Events
    ORDER_CREATED: 'ORDER_CREATED',
    ORDER_UPDATED: 'ORDER_UPDATED',
    ORDER_CANCELLED: 'ORDER_CANCELLED',

    // Invoice Events
    INVOICE_GENERATED: 'INVOICE_GENERATED',
    INVOICE_FAILED: 'INVOICE_FAILED',
    INVOICE_RETRIED: 'INVOICE_RETRIED',

    // Refund Events
    REFUND_INITIATED: 'REFUND_INITIATED',
    REFUND_PROCESSED: 'REFUND_PROCESSED',
    REFUND_FAILED: 'REFUND_FAILED',

    // Credit Note Events
    CREDIT_NOTE_ISSUED: 'CREDIT_NOTE_ISSUED',

    // Return Events
    RETURN_REQUESTED: 'RETURN_REQUESTED',
    RETURN_APPROVED: 'RETURN_APPROVED',
    RETURN_REJECTED: 'RETURN_REJECTED',
    RETURN_RECEIVED: 'RETURN_RECEIVED',

    // Admin Actions
    ADMIN_STATUS_UPDATE: 'ADMIN_STATUS_UPDATE',
    ADMIN_PRICE_OVERRIDE: 'ADMIN_PRICE_OVERRIDE'
};

// Actor Types
const ACTOR_TYPES = {
    SYSTEM: 'SYSTEM',
    ADMIN: 'ADMIN',
    CUSTOMER: 'CUSTOMER'
};

// Entity Types
const ENTITY_TYPES = {
    ORDER: 'order',
    INVOICE: 'invoice',
    REFUND: 'refund',
    RETURN: 'return',
    PRODUCT: 'product',
    VARIANT: 'variant'
};

class FinancialEventLogger {
    /**
     * Log a financial event to the immutable audit log
     * @param {Object} params - Event parameters
     * @returns {Promise<string>} Audit log ID
     */
    static async log({
        eventType,
        actorType = ACTOR_TYPES.SYSTEM,
        actorId = null,
        entityType,
        entityId,
        diffSnapshot = null,
        metadata = {}
    }) {
        const traceContext = getTraceContext();

        try {
            const { data, error } = await supabase
                .from('audit_logs')
                .insert({
                    event_type: eventType,
                    actor_type: actorType,
                    actor_id: actorId,
                    entity_type: entityType,
                    entity_id: entityId,
                    correlation_id: traceContext.correlationId,
                    diff_snapshot: diffSnapshot,
                    metadata: {
                        ...metadata,
                        traceId: traceContext.traceId,
                        spanId: traceContext.spanId,
                        timestamp: new Date().toISOString()
                    }
                })
                .select('id')
                .maybeSingle();

            if (error) {
                log.operationError('LOG_FINANCIAL_EVENT', error, { eventType, entityId });
                // Don't throw - audit logging should not block business operations
                return null;
            }

            log.info('AUDIT_LOG_CREATED', `Financial event logged: ${eventType}`, {
                auditLogId: data.id,
                eventType,
                entityType,
                entityId
            });

            return data.id;
        } catch (err) {
            log.operationError('LOG_FINANCIAL_EVENT', err, { eventType, entityId });
            return null;
        }
    }

    // =========================================================================
    // ORDER EVENTS
    // =========================================================================

    /**
     * Log order creation with tax snapshot
     */
    static async logOrderCreated(order, taxSnapshot, userId = null) {
        return this.log({
            eventType: FINANCIAL_EVENTS.ORDER_CREATED,
            actorType: userId ? ACTOR_TYPES.CUSTOMER : ACTOR_TYPES.SYSTEM,
            actorId: userId,
            entityType: ENTITY_TYPES.ORDER,
            entityId: order.id,
            metadata: {
                orderNumber: order.order_number,
                totalAmount: order.total_amount,
                totalTaxableAmount: taxSnapshot?.totalTaxableAmount,
                totalCgst: taxSnapshot?.totalCgst,
                totalSgst: taxSnapshot?.totalSgst,
                totalIgst: taxSnapshot?.totalIgst,
                taxType: taxSnapshot?.taxType,
                itemCount: order.order_items?.length
            }
        });
    }

    /**
     * Log order status update
     */
    static async logOrderUpdated(orderId, previousStatus, newStatus, adminId = null) {
        return this.log({
            eventType: FINANCIAL_EVENTS.ORDER_UPDATED,
            actorType: adminId ? ACTOR_TYPES.ADMIN : ACTOR_TYPES.SYSTEM,
            actorId: adminId,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            diffSnapshot: {
                before: { status: previousStatus },
                after: { status: newStatus }
            }
        });
    }

    // =========================================================================
    // INVOICE EVENTS
    // =========================================================================

    /**
     * Log invoice generation
     */
    static async logInvoiceGenerated(orderId, invoiceId, invoiceNumber, invoiceUrl) {
        return this.log({
            eventType: FINANCIAL_EVENTS.INVOICE_GENERATED,
            actorType: ACTOR_TYPES.SYSTEM,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            metadata: {
                razorpayInvoiceId: invoiceId,
                invoiceNumber,
                invoiceUrl
            }
        });
    }

    /**
     * Log invoice generation failure
     */
    static async logInvoiceFailed(orderId, error, retryCount = 0) {
        return this.log({
            eventType: FINANCIAL_EVENTS.INVOICE_FAILED,
            actorType: ACTOR_TYPES.SYSTEM,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            metadata: {
                errorMessage: error.message || error,
                retryCount,
                severity: retryCount >= 3 ? 'CRITICAL' : 'WARN'
            }
        });
    }

    // =========================================================================
    // REFUND EVENTS
    // =========================================================================

    /**
     * Log refund initiation
     */
    static async logRefundInitiated(orderId, refundDetails, adminId = null) {
        return this.log({
            eventType: FINANCIAL_EVENTS.REFUND_INITIATED,
            actorType: adminId ? ACTOR_TYPES.ADMIN : ACTOR_TYPES.SYSTEM,
            actorId: adminId,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            metadata: {
                totalRefund: refundDetails.totalRefund,
                taxableRefund: refundDetails.taxableRefund,
                cgstRefund: refundDetails.cgstRefund,
                sgstRefund: refundDetails.sgstRefund,
                igstRefund: refundDetails.igstRefund,
                razorpayPaymentId: refundDetails.paymentId
            }
        });
    }

    /**
     * Log refund completion
     */
    static async logRefundProcessed(orderId, refundId, amount) {
        return this.log({
            eventType: FINANCIAL_EVENTS.REFUND_PROCESSED,
            actorType: ACTOR_TYPES.SYSTEM,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            metadata: {
                razorpayRefundId: refundId,
                refundAmount: amount
            }
        });
    }

    /**
     * Log refund failure
     */
    static async logRefundFailed(orderId, error, paymentId) {
        return this.log({
            eventType: FINANCIAL_EVENTS.REFUND_FAILED,
            actorType: ACTOR_TYPES.SYSTEM,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            metadata: {
                errorMessage: error.message || error,
                razorpayPaymentId: paymentId,
                severity: 'CRITICAL'
            }
        });
    }

    /**
     * Log credit note issued
     */
    static async logCreditNoteIssued(orderId, creditNoteRef, amount) {
        return this.log({
            eventType: FINANCIAL_EVENTS.CREDIT_NOTE_ISSUED,
            actorType: ACTOR_TYPES.SYSTEM,
            entityType: ENTITY_TYPES.ORDER,
            entityId: orderId,
            metadata: {
                creditNoteReference: creditNoteRef,
                amount
            }
        });
    }

    // =========================================================================
    // RETURN EVENTS
    // =========================================================================

    /**
     * Log return request
     */
    static async logReturnRequested(orderId, returnId, items, customerId) {
        return this.log({
            eventType: FINANCIAL_EVENTS.RETURN_REQUESTED,
            actorType: ACTOR_TYPES.CUSTOMER,
            actorId: customerId,
            entityType: ENTITY_TYPES.RETURN,
            entityId: returnId,
            metadata: {
                orderId,
                itemCount: items.length,
                items: items.map(i => ({
                    orderItemId: i.orderItemId,
                    quantity: i.quantity
                }))
            }
        });
    }

    /**
     * Log return approval
     */
    static async logReturnApproved(returnId, orderId, adminId, estimatedRefund) {
        return this.log({
            eventType: FINANCIAL_EVENTS.RETURN_APPROVED,
            actorType: ACTOR_TYPES.ADMIN,
            actorId: adminId,
            entityType: ENTITY_TYPES.RETURN,
            entityId: returnId,
            metadata: {
                orderId,
                estimatedRefund
            }
        });
    }

    /**
     * Log return rejection
     */
    static async logReturnRejected(returnId, orderId, adminId, reason) {
        return this.log({
            eventType: FINANCIAL_EVENTS.RETURN_REJECTED,
            actorType: ACTOR_TYPES.ADMIN,
            actorId: adminId,
            entityType: ENTITY_TYPES.RETURN,
            entityId: returnId,
            metadata: {
                orderId,
                rejectionReason: reason
            }
        });
    }

    // =========================================================================
    // ADMIN ACTIONS
    // =========================================================================

    /**
     * Log admin status update
     */
    static async logAdminStatusUpdate(entityType, entityId, previousStatus, newStatus, adminId, notes = null) {
        return this.log({
            eventType: FINANCIAL_EVENTS.ADMIN_STATUS_UPDATE,
            actorType: ACTOR_TYPES.ADMIN,
            actorId: adminId,
            entityType,
            entityId,
            diffSnapshot: {
                before: { status: previousStatus },
                after: { status: newStatus }
            },
            metadata: {
                notes
            }
        });
    }

    // =========================================================================
    // QUERY METHODS
    // =========================================================================

    /**
     * Get audit trail for an entity
     */
    static async getAuditTrail(entityType, entityId) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .eq('entity_type', entityType)
            .eq('entity_id', entityId)
            .order('created_at', { ascending: false });

        if (error) {
            log.operationError('GET_AUDIT_TRAIL', error, { entityType, entityId });
            throw error;
        }

        return data;
    }

    /**
     * Get all financial events for an order (including returns, refunds)
     */
    static async getOrderFinancialHistory(orderId) {
        const { data, error } = await supabase
            .from('audit_logs')
            .select('*')
            .or(`entity_id.eq.${orderId},metadata->orderId.eq.${orderId}`)
            .order('created_at', { ascending: true });

        if (error) {
            log.operationError('GET_ORDER_HISTORY', error, { orderId });
            throw error;
        }

        return data;
    }
}

module.exports = {
    FinancialEventLogger,
    FINANCIAL_EVENTS,
    ACTOR_TYPES,
    ENTITY_TYPES
};
