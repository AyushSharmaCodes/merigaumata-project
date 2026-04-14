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
        ROLES: 'roles'
    }
};

/**
 * Analytics Service
 * Handles dashboard statistics and data aggregation using optimized Postgres RPCs.
 */
class AnalyticsService {
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

            // Call the consolidated RPC with granular scope
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
                console.error('Database Error in getDashboardStats RPC:', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }

            if (!data || typeof data !== 'object' || Array.isArray(data)) {
                throw new Error('RPC returned invalid data format');
            }

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
