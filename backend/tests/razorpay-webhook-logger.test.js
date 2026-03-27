jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: jest.fn(() => ({
        operationStart: jest.fn(),
        operationError: jest.fn(),
        warn: jest.fn(),
        info: jest.fn()
    }))
}));

jest.mock('../utils/async-context', () => ({
    getTraceContext: jest.fn(() => ({ correlationId: 'corr-123' }))
}));

jest.mock('../services/financial-event-logger.service', () => ({
    FinancialEventLogger: {}
}));

jest.mock('../services/webhook.service', () => ({
    handleEvent: jest.fn()
}));

const crypto = require('crypto');
const supabase = require('../config/supabase');
const webhookService = require('../services/webhook.service');
const { RazorpayWebhookLogger } = require('../services/razorpay-webhook-logger.service');

function createInsertQuery(result) {
    const query = {
        insert: jest.fn(() => query),
        select: jest.fn(() => query),
        single: jest.fn().mockResolvedValue(result)
    };
    return query;
}

function createUpdateQuery(result = { error: null }) {
    const query = {
        update: jest.fn(() => query),
        eq: jest.fn().mockResolvedValue(result)
    };
    return query;
}

describe('RazorpayWebhookLogger', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        process.env.RAZORPAY_WEBHOOK_SECRET = 'test-secret';
    });

    test('rejects invalid signatures without invoking business processing', async () => {
        const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } };
        const rawBody = JSON.stringify(event);

        const insertQuery = createInsertQuery({
            data: { id: 'log-1' },
            error: null
        });

        supabase.from.mockReturnValue(insertQuery);

        const result = await RazorpayWebhookLogger.processWebhookEvent(event, rawBody, 'bad-signature');

        expect(result).toEqual({
            success: false,
            verified: false,
            error: 'Invalid signature'
        });
        expect(webhookService.handleEvent).not.toHaveBeenCalled();
    });

    test('returns shouldRetry=true when business processing throws after verified signature', async () => {
        const event = { event: 'payment.captured', payload: { payment: { entity: { id: 'pay_123' } } } };
        const rawBody = JSON.stringify(event);
        const signature = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET).update(rawBody).digest('hex');

        const insertQuery = createInsertQuery({
            data: { id: 'log-1' },
            error: null
        });

        supabase.from.mockImplementation(() => insertQuery);
        webhookService.handleEvent.mockRejectedValueOnce(new Error('temporary db outage'));

        const result = await RazorpayWebhookLogger.processWebhookEvent(event, rawBody, signature);

        expect(result).toEqual({
            success: false,
            verified: true,
            error: 'temporary db outage',
            shouldRetry: true
        });
    });
});
