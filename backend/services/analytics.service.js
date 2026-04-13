const supabase = require('../lib/supabase');
const logger = require('../utils/logger');

let dashboardRpcStrategy = 'unknown';

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
        ROLES: 'roles'
    }
};

/**
 * Analytics Service
 * Handles dashboard statistics and data aggregation using optimized Postgres RPCs.
 */
class AnalyticsService {
    static _isGranularDashboardRpcMissing(error) {
        if (!error) return false;
        const message = `${error.message || ''} ${error.details || ''}`;
        return error.code === 'PGRST202' && message.includes('get_admin_dashboard_stats_v3');
    }

    static async _getRoleIds() {
        try {
            const { data: roles, error } = await supabase
                .from('roles')
                .select('id, name');

            if (error) throw error;

            const roleMap = {
                ADMIN: 1,   // Fallback defaults
                MANAGER: 2,
                CUSTOMER: 3
            };

            if (roles) {
                roles.forEach(r => {
                    const name = r.name.toUpperCase();
                    if (roleMap.hasOwnProperty(name)) {
                        roleMap[name] = r.id;
                    }
                });
            }

            return roleMap;
        } catch (error) {
            logger.warn({ err: error }, '[AnalyticsService] Failed to fetch role IDs, using fallback mapping');
            return {
                ADMIN: 1,
                MANAGER: 2,
                CUSTOMER: 3
            };
        }
    }

    static async _getTotalDonationsSum() {
        // Use Postgres-side aggregation instead of fetching all rows into Node.js memory
        const { data, error } = await supabase
            .rpc('get_total_donations_sum')
            .maybeSingle();

        if (error) {
            // Fallback: if RPC doesn't exist, use a lightweight select with client-side sum
            logger.warn({ err: error }, '[AnalyticsService] get_total_donations_sum RPC unavailable, falling back');
            const { data: donations, error: fallbackError } = await supabase
                .from('donations')
                .select('amount');
            if (fallbackError) throw fallbackError;
            const total = Array.isArray(donations)
                ? donations.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
                : 0;
            return { success: true, data: total };
        }

        return { success: true, data: data?.total || data || 0 };
    }

    static async _getCategoryStats() {
        return { success: true, data: [] };
    }

    static async _enrichEventsWithRegistrations(events = []) {
        return events;
    }

    static async _buildLegacyDashboard(options, access) {
        const { CUSTOMER, MANAGER } = await this._getRoleIds();
        const ordersPage = Math.max(1, parseInt(options.ordersPage, 10) || 1);
        const ordersLimit = Math.max(0, parseInt(options.ordersLimit, 10) || 0);

        const zeroStats = {
            totalProducts: 0,
            totalOrders: 0,
            totalCustomers: 0,
            totalManagers: 0,
            totalDonations: 0,
            newDonationsAmount: 0,
            blogPosts: 0
        };

        const [
            productsResult,
            ordersResult,
            customersResult,
            managersResult,
            blogsResult,
            eventsResult,
            returnsResult,
            newOrdersResult,
            newCustomersResult,
            newEventsResult,
            donationsResult,
            newDonationsResult,
            recentOrdersResult,
            upcomingEventsResult,
            ongoingEventsResult
        ] = await Promise.all([
            // CRIT-01 FIX: Use count-only queries instead of fetching entire tables into memory
            access.canManageProducts ? supabase.from('products').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
            access.canManageOrders ? supabase.from('orders').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
            access.canViewUsers ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', CUSTOMER) : Promise.resolve({ count: 0 }),
            access.canViewUsers ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', MANAGER) : Promise.resolve({ count: 0 }),
            access.canManageBlogs ? supabase.from('blogs').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
            access.canManageEvents ? supabase.from('events').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
            access.canManageOrders ? supabase.from('returns').select('id', { count: 'exact', head: true }) : Promise.resolve({ count: 0 }),
            access.canManageOrders ? supabase.from('orders').select('id', { count: 'exact', head: true }).gte('createdAt', new Date(0).toISOString()) : Promise.resolve({ count: 0 }),
            access.canViewUsers ? supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role_id', CUSTOMER).gte('created_at', new Date(0).toISOString()) : Promise.resolve({ count: 0 }),
            access.canManageEvents ? supabase.from('events').select('id', { count: 'exact', head: true }).gte('created_at', new Date(0).toISOString()) : Promise.resolve({ count: 0 }),
            access.canViewDonations ? this._getTotalDonationsSum() : Promise.resolve({ success: true, data: 0 }),
            access.canViewDonations ? supabase.from('donations').select('amount') : Promise.resolve({ data: [] }),
            access.canManageOrders
                ? supabase.from('orders').select('id, order_number, customer_name, total_amount, status, createdAt, profiles(name)').range((ordersPage - 1) * ordersLimit, Math.max((ordersPage * ordersLimit) - 1, 0))
                : Promise.resolve({ data: [] }),
            access.canManageEvents ? supabase.from('events').select('id, title, start_date').gt('start_date', new Date(0).toISOString()) : Promise.resolve({ data: [] }),
            access.canManageEvents ? supabase.from('events').select('id, title, start_date, end_date').lte('start_date', new Date().toISOString()).gte('end_date', new Date().toISOString()) : Promise.resolve({ data: [] })
        ]);

        const categoryStats = access.canManageProducts
            ? await this._getCategoryStats()
            : { success: true, data: [] };

        const recentOrders = (recentOrdersResult.data || []).map((order) => ({
            id: order.id,
            orderNumber: order.orderNumber || order.order_number || order.id,
            customerName: order.customerName || order.customer_name || order.profiles?.name || 'Unknown',
            amount: Number(order.amount || order.total_amount || 0),
            status: order.status
        }));

        return {
            stats: {
                ...zeroStats,
                totalProducts: productsResult.count || 0,
                totalOrders: ordersResult.count || 0,
                totalCustomers: customersResult.count || 0,
                totalManagers: managersResult.count || 0,
                totalDonations: donationsResult.data || 0,
                totalEarnings: 0,
                newDonationsAmount: Array.isArray(newDonationsResult.data)
                    ? newDonationsResult.data.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
                    : 0,
                blogPosts: blogsResult.count || 0,
                activeEvents: eventsResult.count || 0,
                pendingReturns: returnsResult.count || 0,
                newOrdersCount: newOrdersResult.count || 0,
                newCustomersCount: newCustomersResult.count || 0,
                newEventsCount: newEventsResult.count || 0,
                sparklineData: {
                    orders: [],
                    customers: [],
                    managers: [],
                    donations: [],
                    earnings: []
                }
            },
            charts: {
                revenueTrend: [],
                orderStatusDistribution: [],
                categoryStats: []
            },
            productCategories: categoryStats.data || [],
            recentOrders: {
                data: recentOrders,
                pagination: {
                    page: ordersPage,
                    limit: ordersLimit,
                    total: ordersResult.count || 0,
                    pages: ordersLimit > 0 ? Math.max(1, Math.ceil((ordersResult.count || 0) / ordersLimit)) : 1
                }
            },
            recentComments: [],
            upcomingEvents: await this._enrichEventsWithRegistrations(upcomingEventsResult.data || []),
            ongoingEvents: await this._enrichEventsWithRegistrations(ongoingEventsResult.data || []),
            access
        };
    }
    
    /**
     * Get Dashboard Stats
     * Highly optimized single-call aggregation using the consolidated RPC.
     */
    static async getDashboardStats(options = {}) {
        let { 
            ordersPage = 1, 
            ordersLimit = 10,
            revenueTimeframe = 'yearly',
            orderSummaryTimeframe = 'weekly',
            categoryTimeframe = 'monthly',
            summaryTimeframe = 'weekly',
            scope = 'all'
        } = options;

        // Sanitize inputs
        ordersPage = Math.max(1, parseInt(ordersPage) || 1);
        ordersLimit = Math.max(0, parseInt(ordersLimit) || 0);

        try {
            const startTime = Date.now();
            const access = await this._getAccessScope(options.user);

            if (dashboardRpcStrategy === 'legacy') {
                return this._buildLegacyDashboard(options, access);
            }

            const rpcResponse = await supabase.rpc('get_admin_dashboard_stats_v3', {
                p_revenue_timeframe: revenueTimeframe,
                p_order_summary_timeframe: orderSummaryTimeframe,
                p_category_timeframe: categoryTimeframe,
                p_summary_timeframe: summaryTimeframe,
                p_orders_page: ordersPage,
                p_orders_limit: ordersLimit,
                p_scope: scope
            });
            const { data, error } = rpcResponse || {};

            if (error) {
                if (this._isGranularDashboardRpcMissing(error)) {
                    dashboardRpcStrategy = 'legacy';
                    logger.warn({
                        code: error.code,
                        details: error.details
                    }, '[AnalyticsService] Granular dashboard RPC unavailable, falling back to legacy aggregation');
                    return this._buildLegacyDashboard(options, access);
                }
                throw error;
            }

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                dashboardRpcStrategy = 'legacy';
                return this._buildLegacyDashboard(options, access);
            }

            dashboardRpcStrategy = 'granular';

            const duration = Date.now() - startTime;
            logger.info({
                msg: '[AnalyticsService] Dashboard Data Fetched via RPC',
                durationMs: duration,
                success: true
            });

            // Post-process access rights (maintain backward compatibility)
            return {
                ...data,
                access
            };
        } catch (error) {
            logger.error({ 
                err: error,
                context: 'AnalyticsService.getDashboardStats',
                params: { ordersPage, ordersLimit, revenueTimeframe }
            }, 'Dashboard RPC fetch failed');
            throw error;
        }
    }

    /**
     * Internal helper to resolve management permissions for the current user.
     */
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
                .select('is_active, can_manage_products, can_manage_orders, can_manage_events, can_manage_blogs')
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
     * Export Dashboard Analysis as CSV
     */
    static async exportAnalysis(options = {}) {
        try {
            // Fetch all data for export
            const data = await this.getDashboardStats({ ...options, scope: 'all' });
            
            let csv = 'Platform Analysis Report\n';
            csv += `Generated at: ${new Date().toLocaleString()}\n\n`;

            // 1. KPIs
            csv += 'METRICS SUMMARY\n';
            csv += 'Metric,Value\n';
            const s = data.stats;
            csv += `Total Products,${s.totalProducts}\n`;
            csv += `Total Orders,${s.totalOrders}\n`;
            csv += `Total Earnings,${s.totalEarnings}\n`;
            csv += `Total Donations,${s.totalDonations}\n`;
            csv += `Total Customers,${s.totalCustomers}\n`;
            csv += `Total Managers,${s.totalManagers}\n`;
            csv += `Active Events,${s.activeEvents}\n`;
            csv += `Blog Posts,${s.blogPosts}\n`;
            csv += `Pending Returns,${s.pendingReturns}\n`;
            csv += '\n';

            // 2. Revenue Trends
            if (data.charts && data.charts.revenueTrend) {
                csv += 'REVENUE & GROWTH TRENDS\n';
                csv += 'Period,Revenue,Orders,Donations\n';
                data.charts.revenueTrend.forEach(item => {
                    csv += `${item.name},${item.revenue},${item.orders},${item.donations}\n`;
                });
                csv += '\n';
            }

            // 3. Order Status Distribution
            if (data.charts && data.charts.orderStatusDistribution) {
                csv += 'ORDER STATUS DISTRIBUTION\n';
                csv += 'Status,Count\n';
                data.charts.orderStatusDistribution.forEach(item => {
                    csv += `${item.name},${item.value}\n`;
                });
                csv += '\n';
            }

            // 4. Category Sales
            if (data.charts && data.charts.categoryStats) {
                csv += 'SALES BY CATEGORY\n';
                csv += 'Category,Quantity Sold\n';
                data.charts.categoryStats.forEach(item => {
                    csv += `"${item.category}",${item.count}\n`;
                });
                csv += '\n';
            }

            return csv;
        } catch (error) {
            logger.error({ err: error, context: 'AnalyticsService.exportAnalysis' }, 'Failed to generate export');
            throw error;
        }
    }
}

module.exports = AnalyticsService;
