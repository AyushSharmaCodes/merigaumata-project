import { apiClient } from '@/lib/api-client';

export interface DonationOrderResponse {
    success: boolean;
    order_id: string;
    amount: number;
    currency: string;
    key_id: string;
    donation_ref: string;
    donor_name: string;
    donor_email: string;
    donor_contact: string;
}

export interface CreateDonationParams {
    amount: number;
    donorName: string;
    donorEmail: string;
    donorPhone: string;
    isAnonymous: boolean;
}

export const donationService = {
    createOrder: async (params: CreateDonationParams): Promise<DonationOrderResponse> => {
        const response = await apiClient.post('/donations/create-order', params);
        return response.data;
    },
    createSubscription: (data: Record<string, unknown>) => apiClient.post('/donations/create-subscription', data).then(res => res.data),

    verifyPayment: async (data: {
        razorpay_order_id: string;
        razorpay_payment_id: string;
        razorpay_signature: string;
        donation_ref: string;
    }) => {
        const response = await apiClient.post('/donations/verify', data);
        return response.data;
    },

    getSubscriptions: async (): Promise<{ subscriptions: any[] }> => {
        const response = await apiClient.get('/donations/subscriptions');
        return response.data;
    },

    cancelSubscription: async (subscriptionId: string) => {
        const response = await apiClient.post('/donations/cancel-subscription', { subscriptionId });
        return response.data;
    },

    pauseSubscription: async (subscriptionId: string) => {
        const response = await apiClient.post('/donations/pause-subscription', { subscriptionId });
        return response.data;
    },

    resumeSubscription: async (subscriptionId: string) => {
        const response = await apiClient.post('/donations/resume-subscription', { subscriptionId });
        return response.data;
    },

    getQrCode: async () => {
        const response = await apiClient.get('/donations/qr-code');
        return response.data;
    }
};
