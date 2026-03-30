import { apiClient } from "@/lib/api-client";
import { Order } from "@/types";

export interface OrdersPagination {
    total: number;
    page: number;
    limit: number;
    pages: number; // Matches the RPC/Backend format
}

export interface DashboardStats {
    stats: {
        totalProducts: number;
        activeEvents: number;
        blogPosts: number;
        totalOrders: number;
        totalCustomers: number;
        totalManagers: number;
        totalDonations: number;
        totalEarnings: number;
        newOrdersCount: number;
        newCustomersCount: number;
        newDonationsAmount: number;
        newEventsCount: number;
        pendingReturns: number;
        sparklineData: {
            orders: Array<{ date: string; value: number }>;
            customers: Array<{ date: string; value: number }>;
            managers: Array<{ date: string; value: number }>;
            donations: Array<{ date: string; value: number }>;
            earnings: Array<{ date: string; value: number }>;
        };
    };
    charts: {
        revenueTrend: Array<{
            name: string;
            revenue: number;
            orders: number;
            donations: number;
        }>;
        orderStatusDistribution: Array<{
            name: string;
            value: number;
            color: string;
        }>;
        categoryStats: Array<{
            category: string;
            count: number;
            trend: string;
        }>;
    };
    recentComments: Array<{
        id: string;
        author: string;
        avatar?: string;
        comment: string;
        date: string;
    }>;
    recentOrders: {
        data: any[];
        pagination: OrdersPagination;
    };
    ongoingEvents: Array<{
        id: string;
        title: string;
        endDate: string;
        registeredCount: number;
        cancelledCount: number;
    }>;
    access?: {
        canManageProducts: boolean;
        canManageOrders: boolean;
        canManageEvents: boolean;
        canManageBlogs: boolean;
        canViewDonations: boolean;
        canViewUsers: boolean;
    };
}

export interface GetDashboardStatsParams {
    ordersPage?: number;
    ordersLimit?: number;
    revenueTimeframe?: 'weekly' | 'monthly' | 'yearly';
    orderSummaryTimeframe?: 'weekly' | 'monthly' | 'yearly';
    categoryTimeframe?: 'weekly' | 'monthly' | 'yearly';
    summaryTimeframe?: 'weekly' | 'monthly' | 'yearly';
    scope?: 'all' | 'summary' | 'charts' | 'activity';
}

export const analyticsService = {
    getDashboardStats: async (params: GetDashboardStatsParams = {}): Promise<DashboardStats> => {
        const { 
            ordersPage = 1, 
            ordersLimit = 10, 
            revenueTimeframe = 'yearly', 
            orderSummaryTimeframe = 'weekly',
            categoryTimeframe = 'monthly',
            summaryTimeframe = 'weekly',
            scope = 'all'
        } = params;

        const response = await apiClient.get('/analytics/dashboard', {
            params: { 
                ordersPage, 
                ordersLimit, 
                revenueTimeframe, 
                orderSummaryTimeframe, 
                categoryTimeframe,
                summaryTimeframe,
                scope
            }
        });
        return response.data;
    }
};
