const mockSupabase = {
    auth: {
        getUser: jest.fn()
    }
};

const mockSupabaseAdmin = {
    from: jest.fn()
};

jest.mock('../lib/supabase', () => ({
    supabase: mockSupabase,
    supabaseAdmin: mockSupabaseAdmin
}));

const { authenticateToken } = require('../middleware/auth.middleware');

function createResponse() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis()
    };
}

describe('auth.middleware caching', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('authenticateToken reuses cached auth user and profile for repeated requests', async () => {
        const profileQuery = {
            select: jest.fn().mockReturnThis(),
            eq: jest.fn().mockReturnThis(),
            maybeSingle: jest.fn().mockResolvedValue({
                data: {
                    deletion_status: 'ACTIVE',
                    is_blocked: false,
                    roles: { name: 'customer' }
                },
                error: null
            })
        };

        mockSupabase.auth.getUser.mockResolvedValue({
            data: {
                user: {
                    id: 'user-1',
                    email: 'user@example.com',
                    user_metadata: { name: 'Test User' }
                }
            },
            error: null
        });
        mockSupabaseAdmin.from.mockImplementation((table) => {
            if (table === 'profiles') {
                return profileQuery;
            }
            throw new Error(`Unexpected table: ${table}`);
        });

        const next = jest.fn();
        const reqA = {
            cookies: { access_token: 'shared-token' },
            headers: {},
            originalUrl: '/api/orders'
        };
        const reqB = {
            cookies: { access_token: 'shared-token' },
            headers: {},
            originalUrl: '/api/orders'
        };

        await authenticateToken(reqA, createResponse(), next);
        await authenticateToken(reqB, createResponse(), next);

        expect(mockSupabase.auth.getUser).toHaveBeenCalledTimes(1);
        expect(mockSupabaseAdmin.from).toHaveBeenCalledTimes(1);
        expect(next).toHaveBeenCalledTimes(2);
        expect(reqA.user).toEqual(expect.objectContaining({ id: 'user-1', role: 'customer' }));
        expect(reqB.user).toEqual(expect.objectContaining({ id: 'user-1', role: 'customer' }));
    });
});
