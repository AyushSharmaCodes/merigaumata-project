import { Testimonial } from '@/types';
import { apiClient } from '@/lib/api-client';

const API_URL = '/testimonials';

export const testimonialService = {
    getAll: async (params?: { limit?: number; isAdmin?: boolean }): Promise<Testimonial[]> => {
        const response = await apiClient.get(API_URL, { params });
        return response.data;
    },

    getById: async (id: string): Promise<Testimonial> => {
        const response = await apiClient.get(`${API_URL}/${id}`);
        return response.data;
    },

    create: async (data: Partial<Testimonial>): Promise<Testimonial> => {
        const response = await apiClient.post(API_URL, data);
        return response.data;
    },

    update: async (id: string, data: Partial<Testimonial>): Promise<Testimonial> => {
        const response = await apiClient.put(`${API_URL}/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`${API_URL}/${id}`);
    }
};
