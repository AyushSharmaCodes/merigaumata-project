import { apiClient } from '@/lib/api-client';

export interface UploadResponse {
    message: string;
    url: string;
    path: string;
    id: string;
}

export interface StoredImage {
    id: string;
    image_path: string;
    title: string;
    size: number;
    mime_type: string;
    created_at: string;
    url: string;
}

export type UploadType = 'product' | 'event' | 'blog' | 'profile' | 'gallery' | 'team' | 'return' | 'return_order' | 'carousel' | 'testimonial';

export const uploadService = {
    uploadImage: async (file: File, type: UploadType = 'product', folder?: string, userId?: string): Promise<UploadResponse> => {
        const formData = new FormData();
        formData.append('type', type);
        if (folder) formData.append('folder', folder);
        if (userId) formData.append('userId', userId);
        formData.append('file', file);

        const response = await apiClient.post('/upload', formData);
        return response.data;
    },

    getUserImages: async (userId: string): Promise<StoredImage[]> => {
        const response = await apiClient.get(`/upload/user/${userId}`);
        return response.data;
    },

    deleteImage: async (id: string): Promise<void> => {
        await apiClient.delete(`/upload/${id}`);
    },

    deleteImageByUrl: async (url: string): Promise<void> => {
        await apiClient.delete('/upload/by-url', { data: { url } });
    }
};
