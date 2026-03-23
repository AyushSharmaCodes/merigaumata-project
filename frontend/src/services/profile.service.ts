import { apiClient } from "@/lib/api-client";
import type { CheckoutAddress } from "@/types";


interface BackendAddress {
    id: string;
    userId: string;
    type?: 'home' | 'work' | 'other';
    isPrimary: boolean;
    label?: string;
    phone?: string;
    streetAddress: string;
    apartment?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
    createdAt: string;
    updatedAt: string;
}

export interface ProfileData {
    id: string;
    email: string;
    firstName: string;
    lastName?: string;
    name: string;
    phone?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    language?: string;
    avatarUrl?: string;
    role: string;
    emailVerified: boolean;
    phoneVerified: boolean;
    authProvider: 'LOCAL' | 'GOOGLE';
    addresses: CheckoutAddress[];
}

export interface UpdateProfileData {
    firstName: string;
    lastName?: string;
    gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
    phone?: string;
    language?: string;
}

export const profileService = {
    /**
     * Get current user's profile
     */
    getProfile: async (lang?: string): Promise<ProfileData> => {
        const response = await apiClient.get('/profile', {
            params: { lang }
        });
        const data = response.data;

        // Transform addresses to match CheckoutAddress type
        if (data.addresses && Array.isArray(data.addresses)) {
            data.addresses = data.addresses.map((addr: any) => ({
                id: addr.id,
                user_id: addr.user_id || addr.userId,
                type: addr.type || 'other',
                is_primary: addr.is_primary !== undefined ? addr.is_primary : addr.isPrimary,
                full_name: addr.full_name || addr.label || 'User',
                phone: addr.phone || '',
                address_line1: addr.address_line1 || addr.street_address || addr.streetAddress,
                address_line2: addr.address_line2 || addr.apartment,
                city: addr.city,
                state: addr.state,
                postal_code: addr.postal_code || addr.postalCode,
                country: addr.country,
                created_at: addr.created_at || addr.createdAt,
                updated_at: addr.updated_at || addr.updatedAt
            }));
        }

        return data;
    },

    /**
     * Update personal information
     */
    updateProfile: async (data: UpdateProfileData): Promise<void> => {
        await apiClient.put('/profile', data);
    },

    /**
     * Upload profile avatar
     */
    uploadAvatar: async (file: File): Promise<{ avatarUrl: string }> => {
        const formData = new FormData();
        formData.append('avatar', file);

        const response = await apiClient.post('/profile/avatar', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Delete profile avatar
     */
    deleteAvatar: async (): Promise<void> => {
        await apiClient.delete('/profile/avatar');
    },

    /**
     * Delete account (soft delete)
     */
    deleteAccount: async (): Promise<void> => {
        await apiClient.post('/profile/delete-account');
    },

    /**
     * Send email verification (for Google auth users)
     */
    sendEmailVerification: async (): Promise<{ success: boolean; message: string }> => {
        const response = await apiClient.post('/profile/send-email-verification');
        return response.data;
    },
};
