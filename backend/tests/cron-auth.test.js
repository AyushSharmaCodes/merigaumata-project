jest.mock('../services/email-retry.service', () => ({
    processRetryQueue: jest.fn(),
    getRetryStats: jest.fn()
}));

jest.mock('../services/invoice-orchestrator.service', () => ({
    InvoiceOrchestrator: {
        retryFailedInvoices: jest.fn(),
        getInvoiceStats: jest.fn()
    }
}));

jest.mock('../services/refund.service', () => ({
    RefundService: {
        processOrphanPayments: jest.fn(),
        processPendingRefundJobs: jest.fn()
    }
}));

jest.mock('../services/event-cancellation.service', () => ({
    processPendingJobs: jest.fn()
}));

jest.mock('../services/deletion-job-processor', () => ({
    DeletionJobProcessor: {
        processScheduledDeletions: jest.fn()
    }
}));

jest.mock('../lib/scheduler', () => ({
    getSchedulerStatus: jest.fn()
}));

jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        operationError: jest.fn()
    }))
}));

jest.mock('../lib/supabase', () => ({
    supabaseAdmin: {
        auth: {
            getUser: jest.fn()
        }
    }
}));

jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

const { supabaseAdmin } = require('../lib/supabase');
const profileSupabase = require('../config/supabase');
const cronRoutes = require('../routes/cron.routes');

describe('cronAuth', () => {
    const next = jest.fn();
    const createRes = () => ({
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    });

    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.CRON_SECRET;
        process.env.NODE_ENV = 'test';
    });

    test('allows authenticated admin users', async () => {
        supabaseAdmin.auth.getUser.mockResolvedValue({
            data: { user: { id: 'admin-1', email: 'admin@example.com' } },
            error: null
        });

        const mockSingle = jest.fn().mockResolvedValue({
            data: { roles: { name: 'admin' } }
        });
        const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        profileSupabase.from.mockReturnValue({ select: mockSelect });

        const req = {
            cookies: { access_token: 'token' },
            headers: {},
            t: (key) => key
        };
        const res = createRes();

        await cronRoutes.cronAuth(req, res, next);

        expect(next).toHaveBeenCalled();
        expect(req.user).toEqual({ id: 'admin-1', email: 'admin@example.com', role: 'admin' });
    });

    test('allows loopback requests in non-production without cron secret', async () => {
        const req = {
            cookies: {},
            headers: {},
            ip: '127.0.0.1',
            socket: { remoteAddress: '127.0.0.1' },
            t: (key) => key
        };
        const res = createRes();

        await cronRoutes.cronAuth(req, res, next);

        expect(next).toHaveBeenCalled();
    });

    test('rejects requests with missing or wrong cron secret outside loopback bypass', async () => {
        process.env.CRON_SECRET = 'expected-secret';

        const req = {
            cookies: {},
            headers: { 'x-forwarded-for': '10.0.0.8' },
            ip: '10.0.0.8',
            socket: { remoteAddress: '10.0.0.8' },
            t: (key) => key
        };
        const res = createRes();

        await cronRoutes.cronAuth(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(401);
    });
});
