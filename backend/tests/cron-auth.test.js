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

const mockAuthRefreshMonitor = {
    getSnapshot: jest.fn()
};

jest.mock('../lib/auth-refresh-monitor', () => mockAuthRefreshMonitor);

jest.mock('../utils/logging-standards', () => ({
    createModuleLogger: jest.fn(() => ({
        debug: jest.fn(),
        warn: jest.fn(),
        info: jest.fn(),
        error: jest.fn(),
        operationError: jest.fn()
    }))
}));

jest.mock('../utils/app-auth', () => ({
    isAppAccessToken: jest.fn(),
    verifyAppAccessToken: jest.fn()
}));

jest.mock('../config/supabase', () => ({
    from: jest.fn()
}));

const profileSupabase = require('../config/supabase');
const { isAppAccessToken, verifyAppAccessToken } = require('../utils/app-auth');
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
        isAppAccessToken.mockReturnValue(true);
        verifyAppAccessToken.mockReturnValue({
            sub: 'admin-1',
            email: 'admin@example.com'
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

    test('returns auth refresh stats for authorized admin users', async () => {
        isAppAccessToken.mockReturnValue(true);
        verifyAppAccessToken.mockReturnValue({
            sub: 'admin-1',
            email: 'admin@example.com'
        });

        const mockSingle = jest.fn().mockResolvedValue({
            data: { roles: { name: 'admin' } }
        });
        const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
        const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
        profileSupabase.from.mockReturnValue({ select: mockSelect });

        mockAuthRefreshMonitor.getSnapshot.mockResolvedValue({
            since: '2026-03-26T00:00:00.000Z',
            windowMinutes: 60,
            counters: { started: 10, succeeded: 8, totalFailures: 2 },
            recentEvents: []
        });

        const routeLayer = cronRoutes.stack.find((entry) => entry.route?.path === '/auth-refresh-stats' && entry.route.methods?.get);
        const handler = routeLayer.route.stack[routeLayer.route.stack.length - 1].handle;
        const req = {
            cookies: { access_token: 'token' },
            headers: {},
            query: { sinceMinutes: '60', recentLimit: '10' },
            t: (key) => key
        };
        const res = createRes();

        await handler(req, res);

        expect(mockAuthRefreshMonitor.getSnapshot).toHaveBeenCalledWith({
            sinceMinutes: '60',
            recentLimit: '10'
        });
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith({
            success: true,
            stats: {
                since: '2026-03-26T00:00:00.000Z',
                windowMinutes: 60,
                counters: { started: 10, succeeded: 8, totalFailures: 2 },
                recentEvents: []
            }
        });
    });
});
