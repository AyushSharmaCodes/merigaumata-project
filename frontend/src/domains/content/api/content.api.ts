import { apiClient } from '@/core/api/api-client';
import type {
    AboutCard, ImpactStat, TimelineItem, TeamMember, FutureGoal,
    AboutUsSectionVisibility, AboutUsContent, HeroCarouselSlide
} from '../model/content.types';

// ─── About API ──────────────────────────────────────────────────────────────

export const aboutApi = {
    getAll: async (): Promise<AboutUsContent> => {
        const response = await apiClient.get("/about");
        return response.data;
    },

    // Cards
    createCard: async (data: Omit<AboutCard, "id">) => {
        const response = await apiClient.post("/about/cards", data);
        return response.data;
    },
    updateCard: async (id: string, data: Partial<AboutCard>) => {
        const response = await apiClient.put(`/about/cards/${id}`, data);
        return response.data;
    },
    deleteCard: async (id: string) => {
        const response = await apiClient.delete(`/about/cards/${id}`);
        return response.data;
    },

    // Impact Stats
    createStat: async (data: Omit<ImpactStat, "id">) => {
        const response = await apiClient.post("/about/stats", data);
        return response.data;
    },
    updateStat: async (id: string, data: Partial<ImpactStat>) => {
        const response = await apiClient.put(`/about/stats/${id}`, data);
        return response.data;
    },
    deleteStat: async (id: string) => {
        const response = await apiClient.delete(`/about/stats/${id}`);
        return response.data;
    },

    // Timeline
    createTimeline: async (data: Omit<TimelineItem, "id">) => {
        const response = await apiClient.post("/about/timeline", data);
        return response.data;
    },
    updateTimeline: async (id: string, data: Partial<TimelineItem>) => {
        const response = await apiClient.put(`/about/timeline/${id}`, data);
        return response.data;
    },
    deleteTimeline: async (id: string) => {
        const response = await apiClient.delete(`/about/timeline/${id}`);
        return response.data;
    },

    // Team Members
    createTeamMember: async (data: FormData) => {
        const response = await apiClient.post("/about/team", data, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    },
    updateTeamMember: async (id: string, data: FormData) => {
        const response = await apiClient.put(`/about/team/${id}`, data, {
            headers: { "Content-Type": "multipart/form-data" },
        });
        return response.data;
    },
    deleteTeamMember: async (id: string) => {
        const response = await apiClient.delete(`/about/team/${id}`);
        return response.data;
    },

    // Future Goals
    createGoal: async (data: Omit<FutureGoal, "id">) => {
        const response = await apiClient.post("/about/goals", data);
        return response.data;
    },
    updateGoal: async (id: string, data: Partial<FutureGoal>) => {
        const response = await apiClient.put(`/about/goals/${id}`, data);
        return response.data;
    },
    deleteGoal: async (id: string) => {
        const response = await apiClient.delete(`/about/goals/${id}`);
        return response.data;
    },

    // Settings
    updateSettings: async (data: {
        footer_description?: string;
        footer_description_i18n?: Record<string, string>;
        section_visibility?: AboutUsSectionVisibility;
    }) => {
        const response = await apiClient.put("/about/settings", data);
        return response.data;
    },
};

// ─── Carousel API ───────────────────────────────────────────────────────────

export const carouselApi = {
    getSlides: async (): Promise<HeroCarouselSlide[]> => {
        const response = await apiClient.get("/gallery-folders");
        const folders = response.data;
        const carouselFolder = folders.find((f: any) => f.is_home_carousel);
        if (!carouselFolder) return [];

        const folderResponse = await apiClient.get(`/gallery-folders/${carouselFolder.id}`);
        const items = folderResponse.data.items || [];

        return items.map((item: any, index: number) => ({
            id: item.id,
            image: item.image_url,
            title: item.title,
            subtitle: item.description,
            order: item.order_index || index,
            isActive: true,
            createdAt: item.created_at,
            updatedAt: item.updated_at,
        }));
    },

    createSlide: async (data: Omit<HeroCarouselSlide, "id" | "createdAt" | "updatedAt">) => {
        const response = await apiClient.post("/carousel-slides", data);
        return response.data;
    },

    updateSlide: async (id: string, data: Partial<Omit<HeroCarouselSlide, "id" | "createdAt" | "updatedAt">>) => {
        const response = await apiClient.put(`/carousel-slides/${id}`, data);
        return response.data;
    },

    deleteSlide: async (id: string) => {
        await apiClient.delete(`/carousel-slides/${id}`);
    },

    toggleSlideStatus: async (id: string, isActive: boolean) => {
        const response = await apiClient.put(`/carousel-slides/${id}`, { isActive });
        return response.data;
    },
};

// ─── Public Content API ─────────────────────────────────────────────────────

export const publicContentApi = {
    getInitialPayload: async (isAdmin = false) => {
        const response = await apiClient.get(`/public/init-payload?isAdmin=${isAdmin}`);
        return response.data;
    },

    getSiteContent: async (isAdmin = false) => {
        const response = await apiClient.get(`/public/site-content?isAdmin=${isAdmin}`);
        return response.data;
    },

    getHomepageContent: async () => {
        const response = await apiClient.get('/public/homepage');
        return response.data;
    },
};
