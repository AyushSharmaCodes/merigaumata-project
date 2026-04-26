import { apiClient } from "@/core/api/api-client";

// --- Donation Types ---
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

export interface DonationHistoryItem {
  id: string;
  donation_reference_id: string;
  type: 'one_time' | 'monthly';
  amount: number;
  currency: string;
  payment_status: string;
  created_at: string;
  razorpay_payment_id?: string | null;
  razorpay_subscription_id?: string | null;
}

// --- Bank Details Types ---
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

export const donationsApi = {
  // --- DONATION SERVICE ---
  donations: {
    createOrder: async (params: CreateDonationParams): Promise<DonationOrderResponse> => {
      const response = await apiClient.post('/donations/create-order', params);
      return response.data;
    },
    createSubscription: (data: Record<string, unknown>) => 
      apiClient.post('/donations/create-subscription', data).then(res => res.data),
    
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

    getHistory: async (): Promise<{ donations: DonationHistoryItem[] }> => {
      const response = await apiClient.get('/donations/history');
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
  },

  // --- BANK DETAILS SERVICE ---
  bankDetails: {
    getAll: async (isAdmin = false): Promise<BankDetails[]> => {
      const response = await apiClient.get(`/bank-details?isAdmin=${isAdmin}`);
      return response.data;
    },

    getById: async (id: string): Promise<BankDetails> => {
      const response = await apiClient.get(`/bank-details/${id}`);
      return response.data;
    },

    create: async (data: Partial<BankDetails>): Promise<BankDetails> => {
      const response = await apiClient.post('/bank-details', data);
      return response.data;
    },

    update: async (id: string, data: Partial<BankDetails>): Promise<BankDetails> => {
      const response = await apiClient.put(`/bank-details/${id}`, data);
      return response.data;
    },

    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/bank-details/${id}`);
    }
  }
};

// Backward compatibility aliases
export const donationService = donationsApi.donations;
export const bankDetailsService = donationsApi.bankDetails;
