const supabase = require('../config/supabase');
const logger = require('../utils/logger');

// Dashboard Schema Configuration
const CONFIG = {
    TABLES: {
        PRODUCTS: 'products',
        ORDERS: 'orders',
        DONATIONS: 'donations',
        PROFILES: 'profiles',
        BLOGS: 'blogs',
        EVENTS: 'events',
        EVENT_REGISTRATIONS: 'event_registrations',
        ORDER_ITEMS: 'order_items',
        ROLES: 'roles'
    },
    COLUMNS: {
        // Many tables use camelCase after migration
        CREATED_AT: {
            PRODUCTS: 'createdAt',
            ORDERS: 'createdAt',
            DONATIONS: 'created_at',   // snake_case
            PROFILES: 'created_at',    // snake_case
            BLOGS: 'created_at',       // snake_case
            EVENTS: 'created_at'       // snake_case (migration-events-setup.sql)
        },
        TOTAL_AMOUNT: 'totalAmount',   // orders
        ROLE_ID: 'role_id',            // profiles
        PAYMENT_STATUS: 'payment_status', // donations
        START_DATE: 'start_date',      // events
        END_DATE: 'end_date'           // events
    }
};

/**
 * Analytics Service
 * Handles dashboard statistics and data aggregation with high resilience.
 */
class AnalyticsService {
    // In-memory cache for role IDs
    static _roleIdsCache = null;
    static _roleCacheTime = 0;
    static VIDEO_CACHE_TTL = 1000 * 60 * 60; // 1 hour

    /**
     * Get validated Role IDs
     * Fetches from DB if not cached
     */
    static async _getRoleIds() {
        const now = Date.now();
        if (this._roleIdsCache && (now - this._roleCacheTime < this.VIDEO_CACHE_TTL)) {
            return this._roleIdsCache;
        }

        try {
            const { data: roles, error } = await supabase
                .from(CONFIG.TABLES.ROLES)
                .select('id, name');

            if (error) throw error;

            const roleMap = {
                ADMIN: null,
                MANAGER: null,
                CUSTOMER: null
            };

            roles.forEach(role => {
                const upperName = role.name.toUpperCase();
                if (roleMap.hasOwnProperty(upperName)) {
                    roleMap[upperName] = role.id;
                }
            });

            // Validate we found all needed roles
            if (!roleMap.ADMIN || !roleMap.MANAGER || !roleMap.CUSTOMER) {
                logger.warn({ found: roles }, 'Could not find all required roles in database');
            }

            this._roleIdsCache = roleMap;
            this._roleCacheTime = now;
            return roleMap;
        } catch (err) {
            logger.error({ err }, 'Failed to fetch roles for analytics');
            // Fallback for emergency (assuming standard PG serial start)
            return { ADMIN: 1, MANAGER: 2, CUSTOMER: 3 };
        }
    }

    static async _getAccessScope(user) {
        const fullAccess = {
            canManageProducts: true,
            canManageOrders: true,
            canManageEvents: true,
            canManageBlogs: true,
            canViewDonations: true,
            canViewUsers: true
        };

        if (!user || user.role === 'admin') {
            return fullAccess;
        }

        if (user.role !== 'manager') {
            return {
                canManageProducts: false,
                canManageOrders: false,
                canManageEvents: false,
                canManageBlogs: false,
                canViewDonations: false,
                canViewUsers: false
            };
        }

        try {
            const { data: permissions, error } = await supabase
                .from('manager_permissions')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (error || !permissions || !permissions.is_active) {
                return {
                    canManageProducts: false,
                    canManageOrders: false,
                    canManageEvents: false,
                    canManageBlogs: false,
                    canViewDonations: false,
                    canViewUsers: false
                };
            }

            return {
                canManageProducts: !!permissions.can_manage_products,
                canManageOrders: !!permissions.can_manage_orders,
                canManageEvents: !!permissions.can_manage_events,
                canManageBlogs: !!permissions.can_manage_blogs,
                canViewDonations: false,
                canViewUsers: false
            };
        } catch (err) {
            logger.error({ err, userId: user.id }, 'Failed to resolve analytics access scope');
            return {
                canManageProducts: false,
                canManageOrders: false,
                canManageEvents: false,
                canManageBlogs: false,
                canViewDonations: false,
                canViewUsers: false
            };
        }
    }

    /**
     * Get Dashboard Stats
     * Aggregates counts, revenue, and trends using a robust modular approach.
     */
    static async getDashboardStats(options = {}) {
        let { ordersPage = 1, ordersLimit = 10 } = options;

        // Sanitize inputs
        ordersPage = Math.max(1, parseInt(ordersPage) || 1);
        ordersLimit = Math.max(0, parseInt(ordersLimit) || 0);

        const ordersOffset = (ordersPage - 1) * ordersLimit;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const sevenDaysAgoStr = sevenDaysAgo.toISOString();
        const nowStr = new Date().toISOString();

        try {
            // fetch dynamic role IDs
            const ROLES = await this._getRoleIds();
            const access = await this._getAccessScope(options.user);
            const startTime = Date.now();

            // Safe query execution pattern
            const runSafe = async (operation, fallback = null, context = '') => {
                try {
                    const { data, count, error } = await operation;
                    if (error) throw error;
                    return { data, count, success: true };
                } catch (err) {
                    logger.error({ err, context }, `Dashboard query failed: ${context}`);
                    return { data: fallback, count: 0, success: false };
                }
            };

            // --- BATCH 1: Core Counts (Fastest) ---
            // Consolidate frequently requested counts
            const batch1 = await Promise.all([
                access.canManageProducts ? runSafe(supabase.from(CONFIG.TABLES.PRODUCTS).select('id', { count: 'exact', head: true }), null, 'Total Products') : Promise.resolve({ count: 0, success: true }),
                access.canManageOrders ? runSafe(supabase.from(CONFIG.TABLES.ORDERS).select('id', { count: 'exact', head: true }), null, 'Total Orders') : Promise.resolve({ count: 0, success: true }),
                access.canViewUsers ? runSafe(supabase.from(CONFIG.TABLES.PROFILES).select('id', { count: 'exact', head: true }).eq(CONFIG.COLUMNS.ROLE_ID, ROLES.CUSTOMER), null, 'Total Customers') : Promise.resolve({ count: 0, success: true }),
                access.canViewUsers ? runSafe(supabase.from(CONFIG.TABLES.PROFILES).select('id', { count: 'exact', head: true }).eq(CONFIG.COLUMNS.ROLE_ID, ROLES.MANAGER), null, 'Total Managers') : Promise.resolve({ count: 0, success: true }),
                access.canManageBlogs ? runSafe(supabase.from(CONFIG.TABLES.BLOGS).select('id', { count: 'exact', head: true }), null, 'Total Blogs') : Promise.resolve({ count: 0, success: true }),
                access.canManageEvents ? runSafe(supabase.from(CONFIG.TABLES.EVENTS).select('id', { count: 'exact', head: true }), null, 'Active Events') : Promise.resolve({ count: 0, success: true }),
                access.canManageOrders ? runSafe(supabase.from('returns').select('id', { count: 'exact', head: true }).in('status', ['requested', 'approved', 'pickup_scheduled', 'picked_up', 'item_returned']), null, 'Pending Returns') : Promise.resolve({ count: 0, success: true })
            ]);

            const products = batch1[0];
            const orders = batch1[1];
            const customers = batch1[2];
            const managers = batch1[3];
            const blogs = batch1[4];
            const activeEvents = batch1[5];
            const pendingReturns = batch1[6];

            // --- BATCH 2: Trends & Aggregations (Mixed Complexity) ---
            const batch2 = await Promise.all([
                access.canManageOrders ? runSafe(supabase.from(CONFIG.TABLES.ORDERS).select('id', { count: 'exact', head: true }).gte(CONFIG.COLUMNS.CREATED_AT.ORDERS, sevenDaysAgoStr), 0, 'Orders Trend') : Promise.resolve({ count: 0, success: true }),
                access.canViewUsers ? runSafe(supabase.from(CONFIG.TABLES.PROFILES).select('id', { count: 'exact', head: true }).eq(CONFIG.COLUMNS.ROLE_ID, ROLES.CUSTOMER).gte(CONFIG.COLUMNS.CREATED_AT.PROFILES, sevenDaysAgoStr), 0, 'Customers Trend') : Promise.resolve({ count: 0, success: true }),
                access.canViewDonations ? runSafe(supabase.from(CONFIG.TABLES.DONATIONS).select('amount').eq(CONFIG.COLUMNS.PAYMENT_STATUS, 'success').gte(CONFIG.COLUMNS.CREATED_AT.DONATIONS, sevenDaysAgoStr), [], 'Donations Trend') : Promise.resolve({ data: [], success: true }),
                access.canManageEvents ? runSafe(supabase.from(CONFIG.TABLES.EVENTS).select('id', { count: 'exact', head: true }).gte(CONFIG.COLUMNS.CREATED_AT.EVENTS, sevenDaysAgoStr), 0, 'Events Trend') : Promise.resolve({ count: 0, success: true }),
                access.canViewDonations ? this._getTotalDonationsSum() : Promise.resolve({ data: 0, success: true }),
                access.canManageProducts ? this._getCategoryStats() : Promise.resolve({ data: [], success: true })
            ]);

            const ordersTrend = batch2[0].count || 0;
            const customersTrend = batch2[1].count || 0;
            const donationsTrendData = batch2[2].data || [];
            const eventsTrend = batch2[3].count || 0;
            const totalDonationsSum = batch2[4].data || 0;
            const categoryStats = batch2[5].data || [];
            const newDonationsAmount = donationsTrendData.reduce((sum, d) => sum + (Number(d.amount) || 0), 0);

            // --- BATCH 3: Lists & Heavy Data (Slowest) ---
            const listQueries = [
                access.canManageOrders ? runSafe(supabase.from(CONFIG.TABLES.ORDERS).select('id', { count: 'exact', head: true }), null, 'Recent Orders Count') : Promise.resolve({ count: 0, success: true }),
                null, // Placeholder for Recent Orders Data
                access.canManageEvents ? runSafe(supabase.from(CONFIG.TABLES.EVENTS).select(`id, title, ${CONFIG.COLUMNS.START_DATE}, ${CONFIG.COLUMNS.END_DATE}`).lte(CONFIG.COLUMNS.START_DATE, nowStr).gte(CONFIG.COLUMNS.END_DATE, nowStr).limit(5), [], 'Ongoing Events') : Promise.resolve({ data: [], success: true }),
                access.canManageEvents ? runSafe(supabase.from(CONFIG.TABLES.EVENTS).select(`id, title, ${CONFIG.COLUMNS.START_DATE}`).gt(CONFIG.COLUMNS.START_DATE, nowStr).order(CONFIG.COLUMNS.START_DATE, { ascending: true }).limit(5), [], 'Upcoming Events') : Promise.resolve({ data: [], success: true }),
                access.canManageEvents ? runSafe(supabase.from(CONFIG.TABLES.EVENTS).select(`id, title, ${CONFIG.COLUMNS.START_DATE}, ${CONFIG.COLUMNS.END_DATE}`).lt(CONFIG.COLUMNS.END_DATE, nowStr).order(CONFIG.COLUMNS.END_DATE, { ascending: false }).limit(5), [], 'Past Events') : Promise.resolve({ data: [], success: true })
            ];

            // Only fetch orders list if limit > 0
            if (ordersLimit > 0 && access.canManageOrders) {
                listQueries[1] = runSafe(supabase.from(CONFIG.TABLES.ORDERS)
                    .select(`id, order_number, ${CONFIG.COLUMNS.CREATED_AT.ORDERS}, ${CONFIG.COLUMNS.TOTAL_AMOUNT}, status, customer_name, profiles(name)`)
                    .order(CONFIG.COLUMNS.CREATED_AT.ORDERS, { ascending: false })
                    .range(ordersOffset, ordersOffset + ordersLimit - 1), [], 'Recent Orders Data');
            } else {
                listQueries[1] = Promise.resolve({ data: [], success: true });
            }

            const batch3 = await Promise.all(listQueries);

            const recentOrdersCount = batch3[0].count || 0;
            const recentOrders = batch3[1].data || [];
            const ongoingEvents = batch3[2].data || [];
            const upcomingEvents = batch3[3].data || [];
            const pastEvents = batch3[4].data || [];

            // Process Event Registrations (Enrichment) - Done last
            const [enrichedOngoing, enrichedUpcoming] = await Promise.all([
                this._enrichEventsWithRegistrations(ongoingEvents),
                this._enrichEventsWithRegistrations(upcomingEvents)
            ]);

            const finalStats = {
                stats: {
                    totalProducts: products.count || 0,
                    activeEvents: activeEvents.count || 0,
                    blogPosts: blogs.count || 0,
                    totalOrders: orders.count || 0,
                    totalCustomers: customers.count || 0,
                    totalManagers: managers.count || 0,
                    totalDonations: totalDonationsSum,
                    newOrdersCount: ordersTrend,
                    newCustomersCount: customersTrend,
                    newDonationsAmount: newDonationsAmount,
                    newEventsCount: eventsTrend,
                    pendingReturns: pendingReturns.count || 0
                },
                productCategories: categoryStats,
                recentOrders: {
                    data: recentOrders.map(o => ({
                        id: o.id,
                        orderNumber: o.order_number,
                        customerName: o.profiles?.name || o.customer_name || 'Guest',
                        amount: o.total_amount,
                        status: o.status,
                        createdAt: o.createdAt
                    })),
                    pagination: {
                        total: recentOrdersCount,
                        page: ordersPage,
                        limit: ordersLimit,
                        pages: ordersLimit > 0 ? Math.ceil(recentOrdersCount / ordersLimit) : 1
                    }
                },
                upcomingEvents: enrichedUpcoming.map(e => ({
                    id: e.id,
                    title: e.title,
                    date: e.start_date,
                    registeredCount: e.registeredCount,
                    cancelledCount: e.cancelledCount
                })),
                ongoingEvents: enrichedOngoing.map(e => ({
                    id: e.id,
                    title: e.title,
                    endDate: e.end_date,
                    registeredCount: e.registeredCount,
                    cancelledCount: e.cancelledCount
                })),
                pastEvents: pastEvents.map(e => ({
                    id: e.id,
                    title: e.title,
                    startDate: e.start_date,
                    endDate: e.end_date
                })),
                access
            };

            const duration = Date.now() - startTime;
            logger.info({
                msg: '[AnalyticsService] Dashboard Data Generated',
                stats: finalStats.stats,
                durationMs: duration,
                roleIds: ROLES
            });

            return finalStats;
        } catch (error) {
            logger.error({ err: error }, 'Critical breakdown in getDashboardStats');
            throw error; // Re-throw to be handled by routes
        }
    }

    // --- Private Helpers ---

    static async _getTotalDonationsSum() {
        try {
            const { data, error } = await supabase.rpc('get_total_donations');
            if (!error && data !== null) return { data: Number(data), success: true };

            // Fallback
            const { data: queryData } = await supabase.from(CONFIG.TABLES.DONATIONS).select('amount').eq(CONFIG.COLUMNS.PAYMENT_STATUS, 'success');
            const sum = (queryData || []).reduce((s, d) => s + (Number(d.amount) || 0), 0);
            return { data: sum, success: true };
        } catch (err) {
            return { data: 0, success: false };
        }
    }

    static async _getCategoryStats() {
        try {
            const { data, error } = await supabase.rpc('get_product_category_stats');
            if (!error && data) return { data: data.map(c => ({ category: c.category, count: c.count, trend: '+0%' })), success: true };

            // Fallback
            const { data: queryData } = await supabase.from(CONFIG.TABLES.PRODUCTS).select('category');
            const grouped = (queryData || []).reduce((acc, curr) => {
                const cat = curr.category || 'Uncategorized';
                acc[cat] = (acc[cat] || 0) + 1;
                return acc;
            }, {});

            const stats = Object.entries(grouped).map(([category, count]) => ({
                category,
                count,
                trend: '+0%'
            })).sort((a, b) => b.count - a.count);

            return { data: stats, success: true };
        } catch (err) {
            return { data: [], success: false };
        }
    }

    static async _enrichEventsWithRegistrations(eventsList) {
        if (!eventsList || eventsList.length === 0) return [];

        try {
            const eventIds = eventsList.map(e => e.id);

            // Fetch registration counts grouped by event_id in ONE query
            const { data: counts, error } = await supabase.rpc('get_event_registration_stats', {
                event_ids: eventIds
            });

            if (error) {
                // FALLBACK: If RPC fails, use the old N+1 logic but log a warning
                logger.warn({ err: error }, 'FALLBACK: get_event_registration_stats RPC failed, using N+1 logic');
                return Promise.all(eventsList.map(async (event) => {
                    const [totalRes, cancelledRes] = await Promise.all([
                        supabase.from(CONFIG.TABLES.EVENT_REGISTRATIONS).select('id', { count: 'exact', head: true }).eq('event_id', event.id),
                        supabase.from(CONFIG.TABLES.EVENT_REGISTRATIONS).select('id', { count: 'exact', head: true }).eq('event_id', event.id).eq('status', 'cancelled')
                    ]);
                    return { ...event, registeredCount: totalRes.count || 0, cancelledCount: cancelledRes.count || 0 };
                }));
            }

            // Map counts to events
            const countMap = (counts || []).reduce((acc, curr) => {
                acc[curr.event_id] = {
                    registeredCount: curr.total_count || 0,
                    cancelledCount: curr.cancelled_count || 0
                };
                return acc;
            }, {});

            return eventsList.map(event => ({
                ...event,
                registeredCount: countMap[event.id]?.registeredCount || 0,
                cancelledCount: countMap[event.id]?.cancelledCount || 0
            }));

        } catch (err) {
            logger.error({ err }, 'Error in _enrichEventsWithRegistrations');
            return eventsList.map(e => ({ ...e, registeredCount: 0, cancelledCount: 0 }));
        }
    }
}

module.exports = AnalyticsService;
