import { apiClient } from '@/core/api/api-client';

export interface EventRegistration {
    id: string;
    registration_number: string;
    event_id: string;
    user_id: string;
    full_name: string;
    email: string;
    phone: string;
    amount: number;
    payment_status: 'pending' | 'paid' | 'failed' | 'free';
    status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
    created_at: string;
    cancellationReason?: string;
    refunds?: Array<{
        status: string;
        amount: number;
    }>;
    event_refunds?: Array<{
        id: string;
        status: string;
        amount: number;
        gateway_reference?: string;
    }>;
    events?: {
        id: string;
        title: string;
        start_date: string;
        end_date?: string;
        start_time?: string;
        location?: string;
        image?: string;
        capacity?: number;
        registrations?: number;
    };
}

export interface GetRegistrationsResponse {
    registrations: EventRegistration[];
    total: number;
}

export const eventRegistrationService = {
    getMyRegistrations: async ({ page = 1, limit = 5 } = {}): Promise<GetRegistrationsResponse> => {
        const response = await apiClient.get('/event-registrations/my', { params: { page, limit } });
        return response.data;
    },

    cancelRegistration: async ({ registrationId, reason }: { registrationId: string; reason: string }) => {
        const response = await apiClient.post('/event-registrations/cancel', { registrationId, reason });
        return response.data;
    }
};
