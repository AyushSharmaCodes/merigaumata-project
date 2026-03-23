import { apiClient } from '@/lib/api-client';
import { logger } from "@/lib/logger";
import i18n from "@/i18n/config";

export type PolicyType = 'privacy' | 'terms' | 'shipping-refund';

export interface Policy {
    id?: string;
    policy_type: PolicyType;
    title: string;
    contentHtml: string;
    version: number;
    updatedAt?: string;
}

export const policyService = {
    upload: async (file: File, policyType: PolicyType, title?: string): Promise<Policy> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('policyType', policyType);
        if (title) formData.append('title', title);

        const response = await apiClient.post('/policies/upload', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data.policy;
    },

    getPublic: async (policyType: PolicyType): Promise<Policy> => {
        const response = await apiClient.get(`/policies/public/${policyType}`);
        return response.data;
    },

    getVersion: async (policyType: PolicyType): Promise<{ version: number }> => {
        const response = await apiClient.get(`/policies/public/${policyType}/version`);
        return response.data;
    },

    getAllLanguageVersions: async (policyType: PolicyType): Promise<{
        titleI18n: { en: string; hi: string; ta: string; te: string };
        contentHtmlI18n: { en: string; hi: string; ta: string; te: string };
        version: number;
        updatedAt: string;
    }> => {
        const response = await apiClient.get(`/policies/admin/${policyType}/languages`);
        return response.data;
    }
};
