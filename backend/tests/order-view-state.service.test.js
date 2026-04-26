const { buildOrderViewState } = require('../services/order-view-state.service');

describe('buildOrderViewState', () => {
    test('derives customer-visible actions and documents for a pre-shipment paid order', () => {
        const order = {
            status: 'packed',
            items: [
                {
                    id: 'item-1',
                    quantity: 2,
                    returned_quantity: 0,
                    is_returnable: true
                }
            ],
            invoices: [
                { id: 'rzp-1', type: 'RAZORPAY', public_url: 'https://rzp.example/receipt' }
            ],
            return_requests: []
        };

        const result = buildOrderViewState(order, { role: 'customer' });

        expect(result.actions.can_cancel_order).toBe(true);
        expect(result.actions.can_request_return).toBe(false);
        expect(result.documents.can_download_receipt).toBe(true);
        expect(result.documents.receipt_invoice_id).toBe('rzp-1');
        expect(result.documents.can_download_invoice).toBe(false);
        expect(result.lifecycle.current_flow).toBe('normal');
        expect(result.sync.poll_interval_ms).toBe(8000);
    });

    test('derives return availability and latest return controls for delivered orders', () => {
        const order = {
            status: 'delivered',
            items: [
                {
                    id: 'item-1',
                    quantity: 3,
                    returned_quantity: 1,
                    is_returnable: true
                },
                {
                    id: 'item-2',
                    quantity: 1,
                    returned_quantity: 0,
                    is_returnable: false
                }
            ],
            invoices: [
                { id: 'inv-1', type: 'TAX_INVOICE', public_url: '/api/invoices/inv-1/download' }
            ],
            return_requests: [
                {
                    id: 'ret-1',
                    status: 'approved',
                    created_at: '2026-04-20T10:00:00.000Z',
                    updated_at: '2026-04-21T10:00:00.000Z',
                    return_items: [
                        {
                            order_item_id: 'item-1',
                            quantity: 1
                        }
                    ]
                }
            ]
        };

        const result = buildOrderViewState(order, { role: 'customer' });

        expect(result.actions.can_cancel_order).toBe(false);
        expect(result.actions.can_request_return).toBe(true);
        expect(result.actions.can_cancel_latest_return).toBe(true);
        expect(result.returns.returnable_item_count).toBe(1);
        expect(result.returns.returnable_quantity_count).toBe(1);
        expect(result.documents.can_download_invoice).toBe(true);
        expect(result.documents.invoice_id).toBe('inv-1');
        expect(result.lifecycle.current_flow).toBe('normal');
    });

    test('derives admin actions for invoice management, cancellation, transitions, and return handling', () => {
        const order = {
            status: 'shipped',
            payment_status: 'paid',
            items: [],
            invoices: [
                { id: 'inv-9', type: 'TAX_INVOICE', public_url: '/api/invoices/inv-9/download' }
            ],
            return_requests: [
                {
                    id: 'ret-9',
                    status: 'requested',
                    created_at: '2026-04-25T10:00:00.000Z',
                    updated_at: '2026-04-25T11:00:00.000Z',
                    return_items: []
                }
            ]
        };

        const result = buildOrderViewState(order, { role: 'admin' });

        expect(result.actions.admin.can_manage_invoice).toBe(true);
        expect(result.actions.admin.can_generate_invoice).toBe(false);
        expect(result.actions.admin.can_regenerate_invoice).toBe(true);
        expect(result.actions.admin.can_cancel_order).toBe(false);
        expect(result.actions.admin.available_status_transitions).toEqual(['out_for_delivery', 'delivery_unsuccessful']);
        expect(result.actions.admin.active_return_request_id).toBe('ret-9');
        expect(result.actions.admin.can_approve_active_return).toBe(true);
        expect(result.actions.admin.can_reject_active_return).toBe(true);
        expect(result.actions.admin.can_mark_active_return_picked_up).toBe(false);
    });

    test('maps delivery recovery and terminal return states into lifecycle buckets', () => {
        const deliveryRecovery = buildOrderViewState({
            status: 'delivery_unsuccessful',
            items: [],
            invoices: [],
            return_requests: []
        }, { role: 'admin' });

        const returnFlow = buildOrderViewState({
            status: 'qc_initiated',
            items: [],
            invoices: [],
            return_requests: [
                {
                    id: 'ret-2',
                    status: 'qc_initiated',
                    created_at: '2026-04-24T10:00:00.000Z',
                    updated_at: '2026-04-24T11:00:00.000Z',
                    return_items: []
                }
            ]
        }, { role: 'admin' });

        expect(deliveryRecovery.lifecycle.current_flow).toBe('delivery_recovery');
        expect(deliveryRecovery.sync.poll_interval_ms).toBe(8000);
        expect(returnFlow.lifecycle.current_flow).toBe('return');
        expect(returnFlow.lifecycle.active_return_request_id).toBe('ret-2');
    });
});
