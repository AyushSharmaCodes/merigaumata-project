import axios from 'axios';

const API_URL = '/api/testimonials';

import { Testimonial } from '@/types';

export const testimonialService = {
    getAll: async (params?: { limit?: number }): Promise<Testimonial[]> => {
        const response = await axios.get(API_URL, { params });
        return response.data;
    },

    getById: async (id: string): Promise<Testimonial> => {
        const response = await axios.get(`${API_URL}/${id}`);
        return response.data;
    },

    create: async (data: Partial<Testimonial>): Promise<Testimonial> => {
        const response = await axios.post(API_URL, data);
        return response.data;
    },

    update: async (id: string, data: Partial<Testimonial>): Promise<Testimonial> => {
        const response = await axios.put(`${API_URL}/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await axios.delete(`${API_URL}/${id}`);
    }
};
