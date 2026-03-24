const AnalyticsService = require('../services/analytics.service');
const supabase = require('../config/supabase');

jest.mock('../config/supabase', () => ({
    from: jest.fn(),
    rpc: jest.fn()
}));

function createQuery(table, resolver) {
    const state = {
        table,
        filters: {},
        selectArg: null,
        rangeArgs: null
    };

    const builder = {
        select(arg) {
            state.selectArg = arg;
            return builder;
        },
        eq(column, value) {
            state.filters[column] = value;
            return builder;
        },
        in(column, value) {
            state.filters[column] = value;
            return builder;
        },
        gte(column, value) {
            state.filters[`gte:${column}`] = value;
            return builder;
        },
        lte(column, value) {
            state.filters[`lte:${column}`] = value;
            return builder;
        },
        gt(column, value) {
            state.filters[`gt:${column}`] = value;
            return builder;
        },
        lt(column, value) {
            state.filters[`lt:${column}`] = value;
            return builder;
        },
        order() {
            return builder;
        },
        limit() {
            return builder;
        },
        range(from, to) {
            state.rangeArgs = [from, to];
            return builder;
        },
        then(resolve, reject) {
            return Promise.resolve(resolver(state)).then(resolve, reject);
        }
    };

    return builder;
}

function createResolver() {
    return (state) => {
        const { table, filters, selectArg } = state;

        if (table === 'products') {
            return { data: null, count: 15, error: null };
        }

        if (table === 'orders') {
            if (typeof selectArg === 'string' && selectArg.includes('order_number')) {
                return {
                    data: [{
                        id: 'order-1',
                        order_number: '1001',
                        customer_name: 'Alice',
                        total_amount: 250,
                        status: 'pending',
                        createdAt: '2026-03-20T10:00:00.000Z',
                        profiles: null
                    }],
                    error: null
                };
            }

            if (filters['gte:createdAt']) {
                return { data: null, count: 3, error: null };
            }

            return { data: null, count: 10, error: null };
        }

        if (table === 'profiles') {
            if (filters.role_id === 'customer-role') {
                return { data: null, count: filters['gte:created_at'] ? 2 : 40, error: null };
            }

            if (filters.role_id === 'manager-role') {
                return { data: null, count: 4, error: null };
            }

            return { data: null, count: 0, error: null };
        }

        if (table === 'blogs') {
            return { data: null, count: 7, error: null };
        }

        if (table === 'events') {
            if (typeof selectArg === 'string' && selectArg.includes('start_date')) {
                if (filters['lte:start_date'] && filters['gte:end_date']) {
                    return { data: [{ id: 'event-live', title: 'Live Event', end_date: '2026-12-31T00:00:00.000Z' }], error: null };
                }

                if (filters['gt:start_date']) {
                    return { data: [{ id: 'event-upcoming', title: 'Upcoming Event', start_date: '2026-04-01T00:00:00.000Z' }], error: null };
                }

                if (filters['lt:end_date']) {
                    return { data: [{ id: 'event-past', title: 'Past Event', start_date: '2026-01-01T00:00:00.000Z', end_date: '2026-01-02T00:00:00.000Z' }], error: null };
                }
            }

            return { data: null, count: filters['gte:created_at'] ? 1 : 6, error: null };
        }

        if (table === 'returns') {
            return { data: null, count: 5, error: null };
        }

        if (table === 'donations') {
            return { data: [{ amount: 50 }], error: null };
        }

        if (table === 'manager_permissions') {
            return { data: null, error: null };
        }

        return { data: [], count: 0, error: null };
    };
}

describe('AnalyticsService RBAC payload shaping', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        supabase.from.mockImplementation((table) => createQuery(table, createResolver()));
        supabase.rpc.mockReset();

        jest.spyOn(AnalyticsService, '_getRoleIds').mockResolvedValue({
            ADMIN: 'admin-role',
            MANAGER: 'manager-role',
            CUSTOMER: 'customer-role'
        });

        jest.spyOn(AnalyticsService, '_getTotalDonationsSum').mockResolvedValue({ data: 5000, success: true });
        jest.spyOn(AnalyticsService, '_getCategoryStats').mockResolvedValue({
            data: [{ category: 'Feed', count: 8, trend: '+0%' }],
            success: true
        });
        jest.spyOn(AnalyticsService, '_enrichEventsWithRegistrations').mockImplementation(async (events) => (
            events.map((event) => ({
                ...event,
                registeredCount: 3,
                cancelledCount: 1
            }))
        ));
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test('returns full dashboard payload for admins', async () => {
        jest.spyOn(AnalyticsService, '_getAccessScope').mockResolvedValue({
            canManageProducts: true,
            canManageOrders: true,
            canManageEvents: true,
            canManageBlogs: true,
            canViewDonations: true,
            canViewUsers: true
        });

        const result = await AnalyticsService.getDashboardStats({
            ordersPage: 1,
            ordersLimit: 10,
            user: { id: 'admin-1', role: 'admin' }
        });

        expect(result.stats.totalProducts).toBe(15);
        expect(result.stats.totalOrders).toBe(10);
        expect(result.stats.totalCustomers).toBe(40);
        expect(result.stats.totalManagers).toBe(4);
        expect(result.stats.totalDonations).toBe(5000);
        expect(result.stats.newDonationsAmount).toBe(50);
        expect(result.productCategories).toHaveLength(1);
        expect(result.recentOrders.data).toHaveLength(1);
        expect(result.upcomingEvents).toHaveLength(1);
        expect(result.ongoingEvents).toHaveLength(1);
    });

    test('trims unrelated dashboard sections for limited managers', async () => {
        const donationsSpy = jest.spyOn(AnalyticsService, '_getTotalDonationsSum');
        const categoriesSpy = jest.spyOn(AnalyticsService, '_getCategoryStats');

        jest.spyOn(AnalyticsService, '_getAccessScope').mockResolvedValue({
            canManageProducts: false,
            canManageOrders: false,
            canManageEvents: true,
            canManageBlogs: false,
            canViewDonations: false,
            canViewUsers: false
        });

        const result = await AnalyticsService.getDashboardStats({
            ordersPage: 1,
            ordersLimit: 10,
            user: { id: 'manager-1', role: 'manager' }
        });

        expect(result.stats.totalProducts).toBe(0);
        expect(result.stats.totalOrders).toBe(0);
        expect(result.stats.totalCustomers).toBe(0);
        expect(result.stats.totalManagers).toBe(0);
        expect(result.stats.totalDonations).toBe(0);
        expect(result.stats.blogPosts).toBe(0);
        expect(result.productCategories).toEqual([]);
        expect(result.recentOrders.data).toEqual([]);
        expect(result.stats.activeEvents).toBe(6);
        expect(result.upcomingEvents).toHaveLength(1);
        expect(result.ongoingEvents).toHaveLength(1);
        expect(donationsSpy).not.toHaveBeenCalled();
        expect(categoriesSpy).not.toHaveBeenCalled();
    });
});
