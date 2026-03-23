import { apiClient } from "@/lib/api-client";
import { SocialMediaLink } from "@/types/contact";

export const socialMediaService = {
    getAll: async (isAdmin: boolean = false): Promise<SocialMediaLink[]> => {
        const response = await apiClient.get(`/social-media?isAdmin=${isAdmin}`);
        return response.data;
    },

    create: async (data: Partial<SocialMediaLink>): Promise<SocialMediaLink> => {
        const response = await apiClient.post("/social-media", data);
        return response.data;
    },

    update: async (id: string, data: Partial<SocialMediaLink>): Promise<SocialMediaLink> => {
        const response = await apiClient.put(`/social-media/${id}`, data);
        return response.data;
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/social-media/${id}`);
    },

    reorder: async (links: SocialMediaLink[]): Promise<void> => {
        await apiClient.put("/social-media/reorder/bulk", { links });
    },
};
