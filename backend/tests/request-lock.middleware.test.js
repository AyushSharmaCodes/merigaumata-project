const mockStore = {
    getRequestLock: jest.fn(),
    acquireRequestLock: jest.fn(),
    releaseRequestLock: jest.fn(),
    deleteExpiredRequestLock: jest.fn()
};

jest.mock('../lib/store/request-state.store', () => mockStore);

const { requestLock } = require('../middleware/requestLock.middleware');

function createResponse() {
    const listeners = {};

    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        end: jest.fn().mockReturnThis(),
        on: jest.fn((event, handler) => {
            listeners[event] = handler;
            return this;
        }),
        listeners
    };
}

describe('requestLock middleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockStore.acquireRequestLock.mockResolvedValue({ id: 'lock-1' });
        mockStore.releaseRequestLock.mockResolvedValue(undefined);
        mockStore.deleteExpiredRequestLock.mockResolvedValue(undefined);
    });

    test('acquires refresh lock using guest id when no authenticated user is present', async () => {
        const middleware = requestLock('auth-refresh');
        const next = jest.fn();
        const req = {
            user: null,
            headers: {
                'x-guest-id': 'guest-123'
            }
        };
        const res = createResponse();

        await middleware(req, res, next);

        expect(mockStore.acquireRequestLock).toHaveBeenCalledWith(expect.objectContaining({
            lockKey: 'guest:guest-123:auth-refresh',
            userId: 'guest:guest-123',
            operation: 'auth-refresh'
        }));
        expect(next).toHaveBeenCalled();
    });

    test('falls back to normalized forwarded ip when user and guest ids are absent', async () => {
        const middleware = requestLock('auth-refresh');
        const next = jest.fn();
        const req = {
            user: null,
            ip: '10.0.0.9',
            headers: {
                'x-forwarded-for': '203.0.113.10, 10.0.0.9'
            }
        };
        const res = createResponse();

        await middleware(req, res, next);

        expect(mockStore.acquireRequestLock).toHaveBeenCalledWith(expect.objectContaining({
            lockKey: 'ip:203.0.113.10:auth-refresh',
            userId: 'ip:203.0.113.10'
        }));
        expect(next).toHaveBeenCalled();
    });

    test('blocks concurrent requests for the same resolved owner', async () => {
        const middleware = requestLock('auth-refresh');
        const next = jest.fn();
        const req = {
            user: null,
            headers: {
                'x-guest-id': 'guest-123'
            }
        };
        const res = createResponse();

        mockStore.acquireRequestLock.mockResolvedValueOnce(null);

        await middleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(409);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            code: 'CONCURRENT_REQUEST_BLOCKED'
        }));
    });
});
