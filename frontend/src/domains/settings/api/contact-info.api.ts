import { apiClient } from "@/core/api/api-client";

export interface ContactAddress {
    id?: string;
    address_line1: string;
    address_line1_i18n?: Record<string, string>;
    address_line2?: string;
    address_line2_i18n?: Record<string, string>;
    city: string;
    city_i18n?: Record<string, string>;
    state: string;
    state_i18n?: Record<string, string>;
    pincode: string;
    country: string;
    country_i18n?: Record<string, string>;
    google_maps_link?: string;
    google_place_id?: string;
    map_latitude?: number;
    map_longitude?: number;
}

export interface ContactPhone {
    id: string;
    number: string;
    label?: string;
    label_i18n?: Record<string, string>;
    is_primary: boolean;
    is_active: boolean;
    display_order: number;
}

export interface ContactEmail {
    id: string;
    email: string;
    label?: string;
    label_i18n?: Record<string, string>;
    is_primary: boolean;
    is_active: boolean;
    display_order: number;
}

export interface OfficeHour {
    id: string;
    day_of_week: string;
    open_time?: string;
    close_time?: string;
    is_closed: boolean;
    display_order: number;
}

export interface ContactInfoData {
    address: ContactAddress;
    phones: ContactPhone[];
    emails: ContactEmail[];
    officeHours: OfficeHour[];
}

export const contactInfoService = {
    getAll: async (isAdmin = false): Promise<ContactInfoData> => {
        const response = await apiClient.get(`/contact-info?isAdmin=${isAdmin}`);
        return response.data;
    },

    updateAddress: async (data: Partial<ContactAddress>) => {
        const response = await apiClient.put(`/contact-info/address`, data);
        return response.data;
    },

    // Phones
    addPhone: async (data: Partial<ContactPhone>) => {
        const response = await apiClient.post(`/contact-info/phones`, data);
        return response.data;
    },

    updatePhone: async (id: string, data: Partial<ContactPhone>) => {
        const response = await apiClient.put(`/contact-info/phones/${id}`, data);
        return response.data;
    },

    deletePhone: async (id: string) => {
        const response = await apiClient.delete(`/contact-info/phones/${id}`);
        return response.data;
    },

    // Emails
    addEmail: async (data: Partial<ContactEmail>) => {
        const response = await apiClient.post(`/contact-info/emails`, data);
        return response.data;
    },

    updateEmail: async (id: string, data: Partial<ContactEmail>) => {
        const response = await apiClient.put(`/contact-info/emails/${id}`, data);
        return response.data;
    },

    deleteEmail: async (id: string) => {
        const response = await apiClient.delete(`/contact-info/emails/${id}`);
        return response.data;
    },

    // Office Hours
    addOfficeHours: async (data: Partial<OfficeHour>) => {
        const response = await apiClient.post(`/contact-info/office-hours`, data);
        return response.data;
    },

    updateOfficeHours: async (id: string, data: Partial<OfficeHour>) => {
        const response = await apiClient.put(`/contact-info/office-hours/${id}`, data);
        return response.data;
    },

    deleteOfficeHours: async (id: string) => {
        const response = await apiClient.delete(`/contact-info/office-hours/${id}`);
        return response.data;
    },
};
