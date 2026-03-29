import { apiClient } from "@/lib/api-client";

export interface ManagerPermissions {
    id: string;
    user_id: string;
    is_active: boolean;
    can_manage_products: boolean;
    can_manage_categories: boolean;
    can_manage_orders: boolean;
    can_manage_events: boolean;
    can_manage_blogs: boolean;
    can_manage_testimonials: boolean;
    can_manage_gallery: boolean;
    can_manage_faqs: boolean;
    can_manage_carousel: boolean;
    can_manage_contact_info: boolean;
    can_manage_social_media: boolean;
    can_manage_bank_details: boolean;
    can_manage_about_us: boolean;
    can_manage_newsletter: boolean;
    can_manage_reviews: boolean;
    can_manage_policies: boolean;
    can_manage_contact_messages: boolean;
    can_manage_coupons: boolean;
    can_manage_background_jobs: boolean;
    can_manage_delivery_configs: boolean;
    created_at: string;
    updated_at: string;
}

export interface Manager {
    id: string;
    email: string;
    name: string;
    phone?: string;
    created_at: string;
    manager_permissions: ManagerPermissions | ManagerPermissions[];
    creator_name?: string;
}

export interface CreateManagerData {
    email: string;
    name: string;
    permissions: Partial<Omit<ManagerPermissions, 'id' | 'user_id' | 'created_at' | 'updated_at'>>;
}

export interface ManagerListResponse {
    managers: Manager[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

export const managerService = {
    // Get all managers
    getAll: async (params?: { page?: number; limit?: number }): Promise<ManagerListResponse> => {
        const response = await apiClient.get("/managers", { params });
        return response.data;
    },

    // Create a new manager
    create: async (data: CreateManagerData): Promise<Manager> => {
        const response = await apiClient.post("/managers", data);
        return response.data;
    },

    // Update manager permissions
    updatePermissions: async (id: string, permissions: Partial<Omit<ManagerPermissions, 'id' | 'user_id' | 'created_at' | 'updated_at'>>): Promise<ManagerPermissions> => {
        const response = await apiClient.put(`/managers/${id}/permissions`, permissions);
        return response.data;
    },

    // Toggle manager active status
    toggleStatus: async (id: string, is_active: boolean): Promise<ManagerPermissions> => {
        const response = await apiClient.put(`/managers/${id}/toggle-status`, { is_active });
        return response.data;
    },

    // Delete a manager
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/managers/${id}`);
    },

    // Get permissions for a specific user
    getUserPermissions: async (userId: string): Promise<ManagerPermissions | null> => {
        const response = await apiClient.get(`/managers/permissions/${userId}`);
        return response.data;
    },
};
