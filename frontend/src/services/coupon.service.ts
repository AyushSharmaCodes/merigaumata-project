import { apiClient } from '@/lib/api-client';
import CacheHelper from '@/utils/cacheHelper';
import { CouponCache } from '@/lib/couponCache';
import type { Coupon, CreateCouponDto } from '@/types';

export const couponService = {
    // Get all coupons (admin only)
    getAll: async (filters?: { type?: string; is_active?: boolean; expired?: boolean }): Promise<Coupon[]> => {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
        if (filters?.expired !== undefined) params.append('expired', String(filters.expired));

        const response = await apiClient.get(`/coupons?${params.toString()}`);
        return response.data;
    },

    // Get active coupons for banners (public) - with optimized caching
    getActive: async (): Promise<Coupon[]> => {
        // Try cache first
        const cached = CouponCache.get();
        if (cached) {
            return cached;
        }

        // Fetch from API and cache
        const response = await apiClient.get('/coupons/active');
        const coupons = response.data;
        CouponCache.set(coupons);
        return coupons;
    },

    // Get active coupons with 1-hour cache (for promotional displays)
    getActiveCached: async (): Promise<Coupon[]> => {
        return CacheHelper.getOrFetch(
            'active_coupons',
            async () => {
                const response = await apiClient.get('/coupons/active');
                return response.data;
            },
            { ttl: 60 * 60 * 1000 } // 1 hour
        );
    },

    // Invalidate active coupons cache (call after create/update/delete)
    invalidatecache: () => {
        CacheHelper.remove('active_coupons');
        CouponCache.clear();
    },

    // Get single coupon by ID (admin only)
    getById: async (id: string): Promise<Coupon> => {
        const response = await apiClient.get(`/coupons/${id}`);
        return response.data;
    },

    // Create new coupon (admin only)
    create: async (coupon: CreateCouponDto): Promise<Coupon> => {
        const response = await apiClient.post('/coupons', coupon);
        CouponCache.clear(); // Invalidate cache
        return response.data;
    },

    // Update coupon (admin only)
    update: async (id: string, coupon: Partial<CreateCouponDto>): Promise<Coupon> => {
        const response = await apiClient.put(`/coupons/${id}`, coupon);
        CouponCache.clear(); // Invalidate cache
        return response.data;
    },

    // Delete/deactivate coupon (admin only)
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/coupons/${id}`);
        CouponCache.clear(); // Invalidate cache
    },

    // Client-side validation using cache (instant, no API call)
    validateCached: (code: string, cartTotal: number = 0) => {
        return CouponCache.validate(code, cartTotal);
    },
};
