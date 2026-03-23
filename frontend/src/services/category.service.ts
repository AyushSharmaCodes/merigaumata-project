import { apiClient } from '@/lib/api-client';

export type CategoryType = 'product' | 'event' | 'faq' | 'gallery';

export interface Category {
    id: string;
    name: string;
    original_name?: string; // Added for admin editing compatibility with localized backend
    name_i18n?: Record<string, string>;
    type: CategoryType;
    createdAt: string;
}

export const categoryService = {
    getAll: async (type?: CategoryType): Promise<Category[]> => {
        const params = type ? `?type=${type}` : '';
        const response = await apiClient.get(`/categories${params}`);
        return response.data.map((c: { _id: string; name: string; slug: string; description?: string; image?: string; created_at?: string; createdAt?: string; updatedAt?: string }) => ({
            ...c,
            createdAt: c.created_at || c.createdAt
        })) as Category[];
    },

    getById: async (id: string): Promise<Category> => {
        const response = await apiClient.get(`/categories/${id}`);
        const c = response.data;
        return {
            ...c,
            createdAt: c.created_at || c.createdAt
        };
    },

    create: async (category: { name: string; name_i18n?: Record<string, string>; type: CategoryType }): Promise<Category> => {
        const response = await apiClient.post('/categories', category);
        const c = response.data;
        return {
            ...c,
            createdAt: c.created_at || c.createdAt
        };
    },

    update: async (id: string, category: Partial<Omit<Category, 'id' | 'createdAt'>>): Promise<Category> => {
        const response = await apiClient.put(`/categories/${id}`, category);
        const c = response.data;
        return {
            ...c,
            createdAt: c.created_at || c.createdAt
        };
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/categories/${id}`);
    },
};
