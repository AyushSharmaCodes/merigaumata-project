import { apiClient } from "@/core/api/api-client";
import { DeliveryConfig } from "@/shared/types";

export const deliveryConfigService = {
    // Get all delivery configs
    getAll: async (): Promise<DeliveryConfig[]> => {
        const response = await apiClient.get("/admin/delivery-configs");
        return response.data.configs;
    },

    // Get config for a specific product
    getByProduct: async (productId: string): Promise<DeliveryConfig | null> => {
        try {
            const response = await apiClient.get(`/admin/delivery-configs/product/${productId}`);
            return response.data.config;
        } catch (error: any) {
            if (error.response && error.response.status === 404) {
                return null;
            }
            throw error;
        }
    },

    // Create a new config
    create: async (data: Partial<DeliveryConfig>): Promise<DeliveryConfig> => {
        const response = await apiClient.post("/admin/delivery-configs", data);
        return response.data.config;
    },

    // Update an existing config
    update: async (id: string, data: Partial<DeliveryConfig>): Promise<DeliveryConfig> => {
        const response = await apiClient.put(`/admin/delivery-configs/${id}`, data);
        return response.data.config;
    },

    // Delete a config
    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/admin/delivery-configs/${id}`);
    },
};
