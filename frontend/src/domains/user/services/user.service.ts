import { CheckoutAddress } from "@/domains/order";

export const userService = {
    transformToCheckoutAddress: (data: any): CheckoutAddress => ({
        id: data.id,
        user_id: data.user_id || data.userId,
        type: data.type || 'other',
        is_primary: data.is_primary !== undefined ? data.is_primary : data.isPrimary,
        full_name: data.full_name || data.label || 'User',
        phone: data.phone || data.phone_numbers?.phone_number || '',
        address_line1: data.address_line1 || data.street_address || data.streetAddress,
        address_line2: data.address_line2 || data.apartment,
        city: data.city,
        state: data.state,
        postal_code: data.postal_code || data.postalCode,
        country: data.country,
        created_at: data.created_at || data.createdAt,
        updated_at: data.updated_at || data.updatedAt
    }),

    transformToBackendAddressPayload: (data: any) => {
        let backendType: 'home' | 'work' | 'other' = 'other';
        if (data.type === 'home' || data.type === 'work' || data.type === 'other') {
            backendType = data.type;
        }

        return {
            type: backendType,
            streetAddress: data.address_line1,
            apartment: data.address_line2,
            city: data.city,
            state: data.state,
            postalCode: data.postal_code,
            country: data.country,
            isPrimary: data.is_primary,
            label: data.full_name,
            phone: data.phone
        };
    }
};
