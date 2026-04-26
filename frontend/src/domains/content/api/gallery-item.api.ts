import { apiClient as api } from "@/core/api/api-client";

export interface GalleryItem {
    id: string;
    folder_id: string;
    photo_id?: string;
    title?: string;
    title_i18n?: Record<string, string>;
    description?: string;
    description_i18n?: Record<string, string>;
    image_url: string;
    thumbnail_url?: string;
    order_index: number;
    captured_date?: string;
    location?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
}

export const galleryItemService = {
    // Get all items with optional filters
    getAll: async (params?: { folder_id?: string; tags?: string; limit?: number }): Promise<GalleryItem[]> => {
        const response = await api.get("/gallery-items", { params });
        return response.data;
    },

    // Get item by ID
    getById: async (id: string): Promise<GalleryItem> => {
        const response = await api.get(`/gallery-items/${id}`);
        return response.data;
    },

    // Get items by folder
    getByFolder: async (folderId: string): Promise<GalleryItem[]> => {
        const response = await api.get(`/gallery-items/folder/${folderId}`);
        return response.data;
    },

    // Create new item
    create: async (data: Partial<GalleryItem>, axiosConfig?: any): Promise<GalleryItem> => {
        const response = await api.post("/gallery-items", data, axiosConfig);
        return response.data;
    },

    // Update item
    update: async (id: string, data: Partial<GalleryItem>, axiosConfig?: any): Promise<GalleryItem> => {
        const response = await api.put(`/gallery-items/${id}`, data, axiosConfig);
        return response.data;
    },

    // Delete item
    delete: async (id: string): Promise<void> => {
        await api.delete(`/gallery-items/${id}`);
    },

    // Bulk delete items
    deleteBulk: async (ids: string[]): Promise<void> => {
        await api.post("/gallery-items/bulk-delete", { ids });
    },
};
