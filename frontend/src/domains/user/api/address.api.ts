import { apiClient } from '@/core/api/api-client';

export const addressApi = {
    getAddresses: async () => {
        const response = await apiClient.get('/addresses');
        return response.data;
    },

    createAddress: async (data: any) => {
        const response = await apiClient.post('/addresses', data);
        return response.data;
    },

    updateAddress: async (id: string, data: any) => {
        const response = await apiClient.put(`/addresses/${id}`, data);
        return response.data;
    },

    deleteAddress: async (id: string) => {
        await apiClient.delete(`/addresses/${id}`);
    },

    setPrimary: async (id: string, type: string) => {
        const response = await apiClient.post(`/addresses/${id}/set-primary`, { type });
        return response.data;
    }
};
