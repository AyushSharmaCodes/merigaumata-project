const mockSupabase = {
    from: jest.fn()
};

const mockEmailService = {
    sendManagerWelcomeEmail: jest.fn()
};

const mockCustomAuthService = {
    normalizeEmail: jest.fn((email) => String(email || '').trim().toLowerCase()),
    generateRandomPassword: jest.fn(() => 'TempPassword123!'),
    upsertLocalAccount: jest.fn(),
    deleteAuthArtifacts: jest.fn()
};

const mockScheduleBackgroundTask = jest.fn(({ task }) => Promise.resolve().then(task));

jest.mock('../config/supabase', () => mockSupabase);
jest.mock('../services/email', () => mockEmailService);
jest.mock('../services/custom-auth.service', () => mockCustomAuthService);
jest.mock('../utils/background-task', () => ({
    scheduleBackgroundTask: (...args) => mockScheduleBackgroundTask(...args)
}));
jest.mock('../middleware/auth.middleware', () => ({
    authenticateToken: jest.fn((req, res, next) => next()),
    requireRole: jest.fn(() => (req, res, next) => next())
}));
jest.mock('../middleware/requestLock.middleware', () => ({
    requestLock: jest.fn(() => (req, res, next) => next())
}));
jest.mock('../middleware/idempotency.middleware', () => ({
    idempotency: jest.fn(() => (req, res, next) => next())
}));
jest.mock('../utils/error-messages', () => ({
    getFriendlyMessage: jest.fn((error) => error.message || 'friendly-error')
}));

const managerRoutes = require('../routes/manager.routes');

function getRouteHandler(path, method) {
    const layer = managerRoutes.stack.find((entry) => entry.route?.path === path && entry.route.methods?.[method]);
    if (!layer) {
        throw new Error(`Route not found: ${method.toUpperCase()} ${path}`);
    }
    return layer.route.stack[layer.route.stack.length - 1].handle;
}

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

function createQueryBuilder(tableName, handlers) {
    const state = {};
    const builder = {
        select: jest.fn(() => builder),
        eq: jest.fn((column, value) => {
            state.eq = { column, value };
            return builder;
        }),
        maybeSingle: jest.fn(async () => handlers.profilesMaybeSingle(tableName, state)),
        single: jest.fn(async () => handlers.single(tableName, state)),
        upsert: jest.fn(async (payload) => handlers.upsert(tableName, payload, state)),
        insert: jest.fn((payload) => {
            state.insertPayload = payload;
            return {
                select: jest.fn(() => ({
                    single: jest.fn(async () => handlers.insertSingle(tableName, payload, state))
                }))
            };
        }),
        delete: jest.fn(() => {
            state.deleteCalled = true;
            return builder;
        })
    };

    return builder;
}

describe('manager.routes create flow', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('POST / responds before welcome email completes', async () => {
        const handler = getRouteHandler('/', 'post');
        const req = {
            body: {
                email: '  MAIT@Ruutukf.com ',
                name: 'Mait',
                permissions: { can_manage_orders: true }
            },
            user: { id: 'admin-1' },
            t: jest.fn((key) => key)
        };
        const res = createResponse();

        const operations = [];

        mockSupabase.from.mockImplementation((tableName) => createQueryBuilder(tableName, {
            profilesMaybeSingle: async () => ({ data: null, error: null }),
            single: async (table) => {
                if (table === 'roles') {
                    return { data: { id: 'manager-role-id' }, error: null };
                }
                return { data: null, error: null };
            },
            upsert: async (table, payload) => {
                operations.push({ type: 'upsert', table, payload });
                return { error: null };
            },
            insertSingle: async (table, payload) => {
                operations.push({ type: 'insert', table, payload });
                return { data: { user_id: 'generated-user-id', is_active: true }, error: null };
            }
        }));

        let releaseEmail;
        mockEmailService.sendManagerWelcomeEmail.mockImplementation(() => new Promise((resolve) => {
            releaseEmail = resolve;
        }));

        const execution = handler(req, res);
        await Promise.resolve();
        await execution;

        expect(res.status).toHaveBeenCalledWith(201);
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
            email: 'mait@ruutukf.com',
            mustChangePassword: true,
            temporaryPasswordSent: false,
            temporaryPasswordQueued: true
        }));
        expect(mockCustomAuthService.upsertLocalAccount).toHaveBeenCalledWith({
            userId: expect.any(String),
            email: 'mait@ruutukf.com',
            password: 'TempPassword123!'
        });
        expect(mockScheduleBackgroundTask).toHaveBeenCalledTimes(1);
        expect(mockEmailService.sendManagerWelcomeEmail).toHaveBeenCalledWith('mait@ruutukf.com', 'Mait', 'TempPassword123!');
        expect(operations.some((entry) => entry.table === 'manager_permissions')).toBe(true);

        releaseEmail({ success: true, messageId: 'msg-1' });
    });

    test('POST / rolls back profile and auth artifacts when auth account creation fails', async () => {
        const handler = getRouteHandler('/', 'post');
        const req = {
            body: {
                email: 'manager@example.com',
                name: 'Manager Name',
                permissions: {}
            },
            user: { id: 'admin-1' },
            t: jest.fn((key) => key)
        };
        const res = createResponse();

        const deletedProfileIds = [];

        mockSupabase.from.mockImplementation((tableName) => {
            const builder = createQueryBuilder(tableName, {
                profilesMaybeSingle: async () => ({ data: null, error: null }),
                single: async (table) => {
                    if (table === 'roles') {
                        return { data: { id: 'manager-role-id' }, error: null };
                    }
                    return { data: null, error: null };
                },
                upsert: async () => ({ error: null }),
                insertSingle: async () => ({ data: null, error: null })
            });

            const originalEq = builder.eq;
            builder.eq = jest.fn((column, value) => {
                if (tableName === 'profiles' && builder.delete.mock.calls.length > 0 && column === 'id') {
                    deletedProfileIds.push(value);
                }
                return originalEq(column, value);
            });

            return builder;
        });

        const authError = new Error('auth insert failed');
        mockCustomAuthService.upsertLocalAccount.mockRejectedValue(authError);

        await handler(req, res);

        expect(mockCustomAuthService.deleteAuthArtifacts).toHaveBeenCalledWith(expect.any(String));
        expect(deletedProfileIds).toHaveLength(1);
        expect(res.status).toHaveBeenCalledWith(500);
        expect(res.json).toHaveBeenCalledWith({ error: 'auth insert failed' });
        expect(mockScheduleBackgroundTask).not.toHaveBeenCalled();
    });
});
