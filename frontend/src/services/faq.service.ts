import { apiClient } from '@/lib/api-client';
import type { FAQ } from '@/types';

// Extended FAQ type with populated category
export interface FAQWithCategory {
    id: string;
    question: string;
    question_i18n?: Record<string, string>;
    answer: string;
    answer_i18n?: Record<string, string>;
    category_id: string;
    category: {
        id: string;
        name: string;
        name_i18n?: Record<string, string>;
        description?: string;
    };
    display_order: number;
    is_active: boolean;
    created_at: string;
    updated_at?: string;
}

export const faqService = {
    getAll: async (isAdmin = false): Promise<FAQWithCategory[]> => {
        const response = await apiClient.get('/faqs', {
            params: { isAdmin: isAdmin ? 'true' : 'false' }
        });
        return response.data;
    },

    getById: async (id: string): Promise<FAQWithCategory> => {
        const response = await apiClient.get(`/faqs/${id}`);
        return response.data;
    },

    getByCategory: async (categoryId: string): Promise<FAQWithCategory[]> => {
        const response = await apiClient.get('/faqs', {
            params: { category: categoryId }
        });
        return response.data;
    },

    create: async (faq: {
        question: string;
        question_i18n?: Record<string, string>;
        answer: string;
        answer_i18n?: Record<string, string>;
        category_id: string;
        display_order?: number;
        is_active?: boolean;
    }): Promise<FAQWithCategory> => {
        const response = await apiClient.post('/faqs', faq);
        return response.data;
    },

    update: async (id: string, faq: Partial<{
        question: string;
        question_i18n: Record<string, string>;
        answer: string;
        answer_i18n: Record<string, string>;
        category_id: string;
        display_order: number;
        is_active: boolean;
    }>): Promise<FAQWithCategory> => {
        const response = await apiClient.put(`/faqs/${id}`, faq);
        return response.data;
    },

    toggleActive: async (id: string): Promise<FAQWithCategory> => {
        const response = await apiClient.patch(`/faqs/${id}/toggle-active`);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/faqs/${id}`);
    },

    reorder: async (faqs: { id: string }[]): Promise<void> => {
        await apiClient.put('/faqs/reorder/bulk', { faqs });
    },
};
