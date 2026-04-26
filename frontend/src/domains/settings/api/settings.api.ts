import { apiClient } from '@/core/api/api-client';
import CacheHelper from '@/core/utils/cacheHelper';
import { CouponCache } from '@/domains/order/services/coupon-cache.service';
import type {
    Category, CategoryType,
    ContactInfoData, ContactAddress, ContactPhone, ContactEmail, OfficeHour,
    ContactFormData, ContactResponse, ContactMessage, ContactMessagesResponse,
    SocialMediaLink, BankDetails, DeliverySettings, Policy,
    CurrencyContextResponse
} from '../model/settings.types';
import type { DeliveryConfig } from '@/domains/product';
import type { Coupon, CreateCouponDto } from '@/domains/cart';

// ─── Categories API ─────────────────────────────────────────────────────────

export const categoryApi = {
    getAll: async (type?: CategoryType): Promise<Category[]> => {
        const params = type ? `?type=${type}` : '';
        const response = await apiClient.get(`/categories${params}`);
        return response.data.map((c: any) => ({
            ...c,
            createdAt: c.created_at || c.createdAt
        }));
    },

    getById: async (id: string): Promise<Category> => {
        const response = await apiClient.get(`/categories/${id}`);
        const c = response.data;
        return { ...c, createdAt: c.created_at || c.createdAt };
    },

    create: async (category: { name: string; name_i18n?: Record<string, string>; type: CategoryType }): Promise<Category> => {
        const response = await apiClient.post('/categories', category);
        const c = response.data;
        return { ...c, createdAt: c.created_at || c.createdAt };
    },

    update: async (id: string, category: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category> => {
        const response = await apiClient.put(`/categories/${id}`, category);
        const c = response.data;
        return { ...c, createdAt: c.created_at || c.createdAt };
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/categories/${id}`);
    },
};

// ─── Contact Info API ───────────────────────────────────────────────────────

export const contactInfoApi = {
    getAll: async (isAdmin = false): Promise<ContactInfoData> => {
        const response = await apiClient.get(`/contact-info?isAdmin=${isAdmin}`);
        return response.data;
    },

    updateAddress: async (data: Partial<ContactAddress>) => {
        const response = await apiClient.put(`/contact-info/address`, data);
        return response.data;
    },

    addPhone: async (data: Partial<ContactPhone>) => {
        const response = await apiClient.post(`/contact-info/phones`, data);
        return response.data;
    },
    updatePhone: async (id: string, data: Partial<ContactPhone>) => {
        const response = await apiClient.put(`/contact-info/phones/${id}`, data);
        return response.data;
    },
    deletePhone: async (id: string) => {
        const response = await apiClient.delete(`/contact-info/phones/${id}`);
        return response.data;
    },

    addEmail: async (data: Partial<ContactEmail>) => {
        const response = await apiClient.post(`/contact-info/emails`, data);
        return response.data;
    },
    updateEmail: async (id: string, data: Partial<ContactEmail>) => {
        const response = await apiClient.put(`/contact-info/emails/${id}`, data);
        return response.data;
    },
    deleteEmail: async (id: string) => {
        const response = await apiClient.delete(`/contact-info/emails/${id}`);
        return response.data;
    },

    addOfficeHours: async (data: Partial<OfficeHour>) => {
        const response = await apiClient.post(`/contact-info/office-hours`, data);
        return response.data;
    },
    updateOfficeHours: async (id: string, data: Partial<OfficeHour>) => {
        const response = await apiClient.put(`/contact-info/office-hours/${id}`, data);
        return response.data;
    },
    deleteOfficeHours: async (id: string) => {
        const response = await apiClient.delete(`/contact-info/office-hours/${id}`);
        return response.data;
    },
};

// ─── Contact Messages API ───────────────────────────────────────────────────

export const contactApi = {
    sendMessage: async (data: ContactFormData): Promise<ContactResponse> => {
        const response = await apiClient.post('/contact', data);
        return response.data;
    },

    getMessages: async (params?: { page?: number; limit?: number; search?: string; status?: ContactMessage['status'] | 'ALL' }): Promise<ContactMessagesResponse> => {
        const response = await apiClient.get('/contact', { params });
        return response.data.data;
    },

    getMessageById: async (id: string): Promise<ContactMessage> => {
        const response = await apiClient.get(`/contact/${id}`);
        return response.data.data;
    },

    updateMessageStatus: async (id: string, status: ContactMessage['status']): Promise<ContactMessage> => {
        const response = await apiClient.patch(`/contact/${id}/status`, { status });
        return response.data.data;
    },
};

// ─── Coupons API ────────────────────────────────────────────────────────────

export const couponApi = {
    getAll: async (filters?: { type?: string; is_active?: boolean; expired?: boolean; page?: number; limit?: number }): Promise<{ coupons: Coupon[]; pagination: any }> => {
        const params = new URLSearchParams();
        if (filters?.type) params.append('type', filters.type);
        if (filters?.is_active !== undefined) params.append('is_active', String(filters.is_active));
        if (filters?.expired !== undefined) params.append('expired', String(filters.expired));
        if (filters?.page !== undefined) params.append('page', String(filters.page));
        if (filters?.limit !== undefined) params.append('limit', String(filters.limit));
        const response = await apiClient.get(`/coupons?${params.toString()}`);
        return response.data;
    },

    getActive: async (): Promise<Coupon[]> => {
        const cachedCoupons = CouponCache.get();
        if (cachedCoupons) return cachedCoupons;

        const response = await apiClient.get('/coupons/active');
        const coupons = response.data;
        CouponCache.set(coupons);
        return coupons;
    },

    getActiveCached: async (): Promise<Coupon[]> => {
        return CacheHelper.getOrFetch(
            'active_coupons',
            async () => {
                const response = await apiClient.get('/coupons/active');
                return response.data;
            },
            { ttl: 60 * 60 * 1000 }
        );
    },

    getById: async (id: string): Promise<Coupon> => {
        const response = await apiClient.get(`/coupons/${id}`);
        return response.data;
    },

    create: async (coupon: CreateCouponDto): Promise<Coupon> => {
        const response = await apiClient.post('/coupons', coupon);
        CouponCache.clear();
        return response.data;
    },

    update: async (id: string, coupon: Partial<CreateCouponDto>): Promise<Coupon> => {
        const response = await apiClient.put(`/coupons/${id}`, coupon);
        CouponCache.clear();
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/coupons/${id}`);
        CouponCache.clear();
    },

    invalidateCache: () => {
        CacheHelper.remove('active_coupons');
        CouponCache.clear();
    },

    validateCached: (code: string, cartTotal: number = 0) => CouponCache.validate(code, cartTotal),
};

// ─── Delivery Config API ────────────────────────────────────────────────────

export const deliveryConfigApi = {
    getAll: async (): Promise<DeliveryConfig[]> => {
        const response = await apiClient.get("/admin/delivery-configs");
        return response.data.configs;
    },

    getByProduct: async (productId: string): Promise<DeliveryConfig | null> => {
        try {
            const response = await apiClient.get(`/admin/delivery-configs/product/${productId}`);
            return response.data.config;
        } catch (error: any) {
            if (error.response && error.response.status === 404) return null;
            throw error;
        }
    },

    create: async (data: Partial<DeliveryConfig>): Promise<DeliveryConfig> => {
        const response = await apiClient.post("/admin/delivery-configs", data);
        return response.data.config;
    },

    update: async (id: string, data: Partial<DeliveryConfig>): Promise<DeliveryConfig> => {
        const response = await apiClient.put(`/admin/delivery-configs/${id}`, data);
        return response.data.config;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/admin/delivery-configs/${id}`);
    },
};

// ─── Social Media API ───────────────────────────────────────────────────────

export const socialMediaApi = {
    getAll: async (isAdmin = false): Promise<SocialMediaLink[]> => {
        const response = await apiClient.get(`/social-media?isAdmin=${isAdmin}`);
        return response.data;
    },

    create: async (data: Partial<SocialMediaLink>): Promise<SocialMediaLink> => {
        const response = await apiClient.post("/social-media", data);
        return response.data;
    },

    update: async (id: string, data: Partial<SocialMediaLink>): Promise<SocialMediaLink> => {
        const response = await apiClient.put(`/social-media/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/social-media/${id}`);
    },

    reorder: async (links: SocialMediaLink[]): Promise<void> => {
        await apiClient.put("/social-media/reorder/bulk", { links });
    },
};

// ─── Bank Details API ───────────────────────────────────────────────────────

export const bankDetailsApi = {
    getAll: async (): Promise<BankDetails[]> => {
        const response = await apiClient.get("/bank-details");
        return response.data;
    },

    create: async (data: Partial<BankDetails>): Promise<BankDetails> => {
        const response = await apiClient.post("/bank-details", data);
        return response.data;
    },

    update: async (id: string, data: Partial<BankDetails>): Promise<BankDetails> => {
        const response = await apiClient.put(`/bank-details/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/bank-details/${id}`);
    },
};

// ─── Public Content API ────────────────────────────────────────────────────

export const publicContentApi = {
    getInitialPayload: async (isAdmin = false) => {
        const response = await apiClient.get(`/public/init-payload?isAdmin=${isAdmin}`);
        return response.data;
    },

    getSiteContent: async (isAdmin = false) => {
        const response = await apiClient.get(`/public/site-content?isAdmin=${isAdmin}`);
        return response.data;
    },

    getHomepageContent: async () => {
        const response = await apiClient.get('/public/homepage');
        return response.data;
    },
};

// ─── Policy API ─────────────────────────────────────────────────────────────

export const policyApi = {
    getAll: async (): Promise<Policy[]> => {
        const response = await apiClient.get("/policies");
        return response.data;
    },

    getBySlug: async (slug: string): Promise<Policy> => {
        const response = await apiClient.get(`/policies/${slug}`);
        return response.data;
    },

    update: async (slug: string, data: Partial<Policy>): Promise<Policy> => {
        const response = await apiClient.put(`/policies/${slug}`, data);
        return response.data;
    },
};

// ─── Currency API ───────────────────────────────────────────────────────────

export const currencyApi = {
    getContext: async (): Promise<CurrencyContextResponse> => {
        const response = await apiClient.get("/settings/currency-context");
        return response.data;
    },

    getDeliverySettings: async (): Promise<DeliverySettings> => {
        const response = await apiClient.get("/settings/delivery");
        return response.data;
    },

    updateDeliverySettings: async (data: Partial<DeliverySettings>): Promise<DeliverySettings> => {
        const response = await apiClient.put("/settings/delivery", data);
        return response.data;
    },

    getMaintenanceSettings: async () => {
        const response = await apiClient.get("/settings/maintenance");
        return response.data;
    },

    updateMaintenanceSettings: async (data: any) => {
        const response = await apiClient.put("/settings/maintenance", data);
        return response.data;
    },
};

// Backward-compatible aggregate API facade (replaces settings-compat.api.ts)
export const settingsApi = {
    categories: categoryApi,
    contactInfo: contactInfoApi,
    contact: contactApi,
    coupons: couponApi,
    deliveryConfigs: deliveryConfigApi,
    publicContent: publicContentApi,
    socialMedia: socialMediaApi,
    bankDetails: bankDetailsApi,
    policy: policyApi,
    currency: currencyApi,
};

export const categoryService = settingsApi.categories;
export const contactInfoService = settingsApi.contactInfo;
export const contactService = settingsApi.contact;
export const couponService = settingsApi.coupons;
export const deliveryConfigService = settingsApi.deliveryConfigs;
export const publicContentService = settingsApi.publicContent;
export const socialMediaService = settingsApi.socialMedia;
