import { apiClient } from '@/lib/api-client';
import type { Blog } from '@/types';

export const blogService = {
    getAll: async (params?: { published?: boolean; limit?: number }): Promise<Blog[]> => {
        const response = await apiClient.get('/blogs', { params });
        return response.data;
    },

    getPaginated: async (page: number, limit: number, search?: string): Promise<{ blogs: Blog[]; total: number; totalPages: number }> => {
        const params = new URLSearchParams({
            page: page.toString(),
            limit: limit.toString(),
        });
        if (search) params.append('search', search);

        const response = await apiClient.get(`/blogs?${params.toString()}`);
        return response.data;
    },

    getById: async (id: string): Promise<Blog> => {
        const response = await apiClient.get(`/blogs/${id}`);
        return response.data;
    },

    create: async (blog: Omit<Blog, 'id'>): Promise<Blog> => {
        const response = await apiClient.post('/blogs', blog);
        return response.data;
    },

    update: async (id: string, blog: Partial<Blog>): Promise<Blog> => {
        const response = await apiClient.put(`/blogs/${id}`, blog);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/blogs/${id}`);
    },
};
