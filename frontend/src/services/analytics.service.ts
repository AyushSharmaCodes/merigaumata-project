import { apiClient } from "@/lib/api-client";
import { Order } from "@/types";

export interface OrdersPagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
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
        newOrdersCount: number;
        newCustomersCount: number;
        newDonationsAmount: number;
        newEventsCount: number;
        pendingReturns: number;
    };
    productCategories: Array<{
        category: string;
        count: number;
        trend: string;
    }>;
    recentOrders: {
        data: Order[];
        pagination: OrdersPagination;
    };
    upcomingEvents: Array<{
        id: string;
        title: string;
        date: string;
        registeredCount: number;
        cancelledCount: number;
    }>;
    ongoingEvents: Array<{
        id: string;
        title: string;
        endDate: string;
        registeredCount: number;
        cancelledCount: number;
    }>;
    pastEvents: Array<{
        id: string;
        title: string;
        startDate: string;
        endDate: string;
    }>;
}

export interface GetDashboardStatsParams {
    ordersPage?: number;
    ordersLimit?: number;
}

export const analyticsService = {
    getDashboardStats: async (params: GetDashboardStatsParams = {}): Promise<DashboardStats> => {
        const { ordersPage = 1, ordersLimit = 10 } = params;
        const response = await apiClient.get('/analytics/dashboard', {
            params: { ordersPage, ordersLimit }
        });
        return response.data;
    }
};
