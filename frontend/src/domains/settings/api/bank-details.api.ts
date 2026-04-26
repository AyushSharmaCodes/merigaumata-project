import { apiClient } from '@/core/api/api-client';

export interface BankDetails {
    id: string;
    account_name: string;
    account_number: string;
    ifsc_code: string;
    bank_name: string;
    branch_name?: string;
    upi_id?: string;
    type: 'general' | 'donation';
    is_active: boolean;
    display_order: number;
    created_at?: string;
    updated_at?: string;
}

export const bankDetailsService = {
    /**
     * Get all bank details
     * @param isAdmin - If true, returns all details
     */
    getAll: async (isAdmin = false): Promise<BankDetails[]> => {
        const response = await apiClient.get(`/bank-details?isAdmin=${isAdmin}`);
        return response.data;
    },

    /**
     * Get single bank detail by ID
     */
    getById: async (id: string): Promise<BankDetails> => {
        const response = await apiClient.get(`/bank-details/${id}`);
        return response.data;
    },

    /**
     * Create new bank account
     */
    create: async (data: Partial<BankDetails>): Promise<BankDetails> => {
        const response = await apiClient.post('/bank-details', data);
        return response.data;
    },

    /**
     * Update bank account
     */
    update: async (id: string, data: Partial<BankDetails>): Promise<BankDetails> => {
        const response = await apiClient.put(`/bank-details/${id}`, data);
        return response.data;
    },

    /**
     * Delete bank account (soft delete)
     */
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/bank-details/${id}`);
    },
};
