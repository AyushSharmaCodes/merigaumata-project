import { apiClient as api } from "@/lib/api-client";

export interface GalleryFolder {
    id: string;
    name: string;
    name_i18n?: Record<string, string>;
    description?: string;
    description_i18n?: Record<string, string>;
    slug: string;
    category_id: string;
    category_name?: string;
    cover_image?: string;
    order_index: number;
    is_active: boolean;
    is_hidden?: boolean;
    is_home_carousel?: boolean;
    is_mobile_carousel?: boolean;
    created_at: string;
    updated_at: string;
    gallery_items?: {
        image_url: string;
        thumbnail_url: string;
    }[];
    gallery_videos?: {
        thumbnail_url: string;
    }[];
}

export const galleryFolderService = {
    // Get all folders
    getAll: async (): Promise<GalleryFolder[]> => {
        const response = await api.get("/gallery-folders");
        return response.data;
    },

    // Get folder by ID with items and videos
    getById: async (id: string): Promise<GalleryFolder> => {
        const response = await api.get(`/gallery-folders/${id}`);
        return response.data;
    },

    // Create new folder
    create: async (data: Partial<GalleryFolder>): Promise<GalleryFolder> => {
        const response = await api.post("/gallery-folders", data);
        return response.data;
    },

    // Update folder
    update: async (id: string, data: Partial<GalleryFolder>): Promise<GalleryFolder> => {
        const response = await api.put(`/gallery-folders/${id}`, data);
        return response.data;
    },

    // Set folder as home carousel
    setHomeCarouselFolder: async (id: string): Promise<GalleryFolder> => {
        const response = await api.put(`/gallery-folders/${id}/set-carousel`);
        return response.data;
    },

    // Set folder as mobile carousel
    setMobileCarouselFolder: async (id: string): Promise<GalleryFolder> => {
        const response = await api.put(`/gallery-folders/${id}/set-mobile-carousel`);
        return response.data;
    },

    // Delete folder
    delete: async (id: string): Promise<void> => {
        await api.delete(`/gallery-folders/${id}`);
    },
};
