import { apiClient } from "@/lib/api-client";
import { AboutCard, ImpactStat, TimelineItem, TeamMember, FutureGoal, AboutUsSectionVisibility } from "@/types";

export interface AboutContent {
    cards: AboutCard[];
    impactStats: ImpactStat[];
    timeline: TimelineItem[];
    teamMembers: TeamMember[];
    futureGoals: FutureGoal[];
    footerDescription: string;
    footerDescription_i18n?: Record<string, string>;
    sectionVisibility: AboutUsSectionVisibility;
}

export const aboutService = {
    getAll: async (): Promise<AboutContent> => {
        const response = await apiClient.get("/about");
        return response.data;
    },

    // --- CARDS ---
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

    // --- IMPACT STATS ---
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

    // --- TIMELINE ---
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

    // --- TEAM MEMBERS ---
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

    // --- FUTURE GOALS ---
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

    // --- SETTINGS ---
    updateSettings: async (data: { footer_description?: string; footer_description_i18n?: Record<string, string>; section_visibility?: AboutUsSectionVisibility }) => {
        const response = await apiClient.put("/about/settings", data);
        return response.data;
    },
};
