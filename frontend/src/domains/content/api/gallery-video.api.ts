import { apiClient as api } from "@/core/api/api-client";

export interface GalleryVideo {
    id: string;
    folder_id: string;
    title: string;
    title_i18n?: Record<string, string>;
    description?: string;
    description_i18n?: Record<string, string>;
    youtube_url: string;
    youtube_id: string;
    thumbnail_url?: string;
    order_index: number;
    duration?: string;
    tags?: string[];
    created_at: string;
    updated_at: string;
}

export const galleryVideoService = {
    // Get all videos with optional filters
    getAll: async (params?: { folder_id?: string; tags?: string }): Promise<GalleryVideo[]> => {
        const response = await api.get("/gallery-videos", { params });
        return response.data;
    },

    // Get video by ID
    getById: async (id: string): Promise<GalleryVideo> => {
        const response = await api.get(`/gallery-videos/${id}`);
        return response.data;
    },

    // Get videos by folder
    getByFolder: async (folderId: string): Promise<GalleryVideo[]> => {
        const response = await api.get(`/gallery-videos/folder/${folderId}`);
        return response.data;
    },

    // Create new video
    create: async (data: Partial<GalleryVideo>): Promise<GalleryVideo> => {
        const response = await api.post("/gallery-videos", data);
        return response.data;
    },

    // Update video
    update: async (id: string, data: Partial<GalleryVideo>): Promise<GalleryVideo> => {
        const response = await api.put(`/gallery-videos/${id}`, data);
        return response.data;
    },

    // Delete video
    delete: async (id: string): Promise<void> => {
        await api.delete(`/gallery-videos/${id}`);
    },

    // Bulk delete videos
    deleteBulk: async (ids: string[]): Promise<void> => {
        await api.post("/gallery-videos/bulk-delete", { ids });
    },
};
