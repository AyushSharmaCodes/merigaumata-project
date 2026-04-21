const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/logger');
const appEmitter = require('../utils/events');
const { QC_STATUS, QC_TERMINAL } = require('../domain/qcStatus');
const TransitionGuards = require('../domain/transitionGuards');

/**
 * QC Domain Constants
 */
const QC_REASONS = {
    CUSTOMER_DAMAGE: 'customer_damage',
    USED_OR_WORN: 'used_or_worn',
    MISSING_ACCESSORIES: 'missing_accessories',
    WRONG_ITEM_RETURNED: 'wrong_item_returned',
    NON_RESELLABLE: 'non_resellable'
};

const SEVERE_REASONS = [
    QC_REASONS.WRONG_ITEM_RETURNED,
    QC_REASONS.MISSING_ACCESSORIES
];

/**
 * calculateReverseLogistics
 */
const calculateReverseLogistics = async (productId, quantity = 1) => {
    try {
        const SettingsService = require('./settings.service');
        const [settings, { data: product }] = await Promise.all([
            SettingsService.getPublicSettings(),
            supabaseAdmin
                .from('products')
                .select('weight_grams, return_logistics_fee')
                .eq('id', productId)
                .single()
        ]);

        const flatFee = Number(settings.return_logistics_flat_fee || 0);
        if (!product) return flatFee;

        const itemFee = Number(product.return_logistics_fee || 0);
        const weightFee = (Number(product.weight_grams || 0) / 1000) * 50; 

        return flatFee + (itemFee || weightFee) * quantity;

    } catch (error) {
        log.error('QC_LOGISTICS_CALC_FAILED', error.message);
        return 0;
    }
};

/**
 * submitQCAudit
 * Mandatory post-return processing layer.
 */
const submitQCAudit = async (auditData, adminId) => {
    log.operationStart('SUBMIT_QC_AUDIT', { returnItemId: auditData.return_item_id });

    try {
        const {
            return_id,
            return_item_id,
            order_id,
            status, // 'passed' or 'failed'
            reason_code,
            severity,
            deduction_amount,
            reverse_logistics_cost,
            action_taken,
            inventory_action,
            is_fraud_flagged = false,
            notes,
            userId = null
        } = auditData;

        // 1. ATOMIC GUARD: Check if audit already exists for this item
        const { data: existingAudit } = await supabaseAdmin
            .from('qc_audits')
            .select('id')
            .eq('return_item_id', return_item_id)
            .maybeSingle();

        if (existingAudit) {
            throw new Error(`QC_ALREADY_COMPLETED: Item ${return_item_id} has already been audited.`);
        }

        // 2. Fetch Context for Guards
        const [{ data: order }, { data: returnObj }] = await Promise.all([
            supabaseAdmin.from('orders').select('status, user_id').eq('id', order_id).single(),
            supabaseAdmin.from('returns').select('qc_status, version').eq('id', return_id).single()
        ]);

        if (!order || !returnObj) throw new Error('CONTEXT_NOT_FOUND: Order or Return object missing');

        // 3. PHYSICAL GUARD: Ensure logistics completed
        if (!TransitionGuards.canInitiateQC(order, returnObj)) {
            throw new Error(`INVALID_STAGE: QC cannot be initiated for order in status [${order.status}]`);
        }

        // 4. PERSISTENCE: Save Audit
        const { data: audit, error: auditError } = await supabaseAdmin
            .from('qc_audits')
            .insert({
                return_id,
                return_item_id,
                order_id,
                status,
                reason_code,
                severity,
                deduction_amount,
                reverse_logistics_cost,
                action_taken,
                inventory_action,
                auditor_id: adminId,
                notes
            })
            .select('id, return_id, return_item_id, status, deduction_amount')
            .single();

        if (auditError) throw auditError;

        // 5. UPDATE PARENT: Transitions the return status domain
        // Check if all items in this return are now audited
        const { data: allReturnItems } = await supabaseAdmin
            .from('return_items')
            .select('id')
            .eq('return_id', return_id);

        const { data: allAudits } = await supabaseAdmin
            .from('qc_audits')
            .select('id, status, action_taken')
            .eq('return_id', return_id);

        const allItemsDone = (allAudits?.length || 0) >= (allReturnItems?.length || 0);

        if (allItemsDone) {
            const finalQCStatus = (allAudits || []).every((auditRow) => auditRow.status === 'passed')
                ? QC_STATUS.QC_PASSED
                : QC_STATUS.QC_FAILED;
            
            const { error: updateError } = await supabaseAdmin
                .from('returns')
                .update({ 
                    qc_status: finalQCStatus,
                    version: returnObj.version + 1,
                    updated_at: new Date()
                })
                .eq('id', return_id)
                .eq('version', returnObj.version); // OPTIMISTIC LOCK

            if (updateError) throw updateError;

            const usesManualOutcomes = (allAudits || []).some((auditRow) => Boolean(auditRow.action_taken));

            // 6. EMIT EVENT: Only for legacy automated refund orchestration.
            // The newer processQCResult flow handles financial outcomes directly.
            if (!usesManualOutcomes) {
                appEmitter.emit('QC_COMPLETED', { return_id, order_id, qc_status: finalQCStatus });
                log.info('QC_COMPLETED_EVENT_EMITTED', { return_id });
            } else {
                log.info('QC_COMPLETED_EVENT_SKIPPED', { return_id, reason: 'manual_qc_outcomes' });
            }
        }

        // 7. Automated Fraud Detection
        const shouldFlag = is_fraud_flagged || SEVERE_REASONS.includes(reason_code);
        if (shouldFlag) {
            const userToFlag = userId || order.user_id;
            if (userToFlag) {
                await supabaseAdmin.from('profiles').update({ is_flagged: true }).eq('id', userToFlag);
                log.warn('USER_FRAUD_FLAGGED', `User ${userToFlag} flagged due to severe QC failure`, { order_id });
            }
        }

        return audit;

    } catch (error) {
        log.operationError('SUBMIT_QC_AUDIT_ERROR', error);
        throw error;
    }
};

/**
 * unflagUser
 */
const unflagUser = async (userId, adminId) => {
    try {
        await supabaseAdmin.from('profiles').update({ is_flagged: false }).eq('id', userId);
        log.info('USER_UNFLAGGED', `Manager ${adminId} unflagged user ${userId}`);
        return { success: true };
    } catch (error) {
        log.error('UNFLAG_USER_ERROR', error.message);
        throw error;
    }
};

module.exports = {
    QC_REASONS,
    calculateReverseLogistics,
    submitQCAudit,
    unflagUser
};
