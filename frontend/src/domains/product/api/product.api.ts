import { apiClient } from '@/core/api/api-client';
import type { Product } from '../model/product.types';

export const productApi = {
    getAll: async (params?: { page?: number; limit?: number; search?: string; category?: string; sortBy?: string; includeStats?: boolean; lang?: string }) => {
        const response = await apiClient.get('/products', { params });
        return response.data;
    },

    getById: async (id: string, params?: { lang?: string; _ts?: number }) => {
        const response = await apiClient.get<Product>(`/products/${id}`, { params });
        return response.data;
    },

    create: async (product: Omit<Product, 'id'>) => {
        const response = await apiClient.post<Product>('/products', product);
        return response.data;
    },

    update: async (id: string, product: Partial<Product>) => {
        const response = await apiClient.put<Product>(`/products/${id}`, product);
        return response.data;
    },

    delete: async (id: string) => {
        await apiClient.delete(`/products/${id}`);
    },

    createWithVariants: async (data: { product: any; variants: any[] }) => {
        const response = await apiClient.post<Product>('/admin/products-with-variants', data);
        return response.data;
    },

    updateWithVariants: async (id: string, data: { product?: any; variants?: any[] }) => {
        const response = await apiClient.put<Product>(`/admin/products-with-variants/${id}`, data);
        return response.data;
    },

    getVariantById: async (id: string) => {
        const response = await apiClient.get(`/variants/${id}`);
        return response.data;
    },
};
