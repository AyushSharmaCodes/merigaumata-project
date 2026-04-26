import { apiClient } from "@/core/api/api-client";
import { 
  AboutCard, 
  ImpactStat, 
  TimelineItem, 
  TeamMember, 
  FutureGoal, 
  AboutUsSectionVisibility,
  Testimonial
} from "@/shared/types";

// --- About Content Types ---
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

// --- FAQ Types ---
export interface FAQWithCategory {
  id: string;
  question: string;
  question_i18n?: Record<string, string>;
  answer: string;
  answer_i18n?: Record<string, string>;
  category_id: string;
  category: {
    id: string;
    name: string;
    name_i18n?: Record<string, string>;
    description?: string;
  };
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
}

// --- Policy Types ---
export type PolicyType = 'privacy' | 'terms' | 'shipping-refund';

export interface Policy {
  id?: string;
  policy_type: PolicyType;
  title: string;
  contentHtml: string;
  version: number;
  updatedAt?: string;
}

export const staticApi = {
  // --- ABOUT SERVICE ---
  about: {
    getAll: async (): Promise<AboutContent> => {
      const response = await apiClient.get("/about");
      return response.data;
    },
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
    updateSettings: async (data: { footer_description?: string; footer_description_i18n?: Record<string, string>; section_visibility?: AboutUsSectionVisibility }) => {
      const response = await apiClient.put("/about/settings", data);
      return response.data;
    },
  },

  // --- FAQ SERVICE ---
  faqs: {
    getAll: async (isAdmin = false): Promise<FAQWithCategory[]> => {
      const response = await apiClient.get('/faqs', {
        params: { isAdmin: isAdmin ? 'true' : 'false' }
      });
      return response.data;
    },
    getById: async (id: string): Promise<FAQWithCategory> => {
      const response = await apiClient.get(`/faqs/${id}`);
      return response.data;
    },
    getByCategory: async (categoryId: string): Promise<FAQWithCategory[]> => {
      const response = await apiClient.get('/faqs', {
        params: { category: categoryId }
      });
      return response.data;
    },
    create: async (faq: {
      question: string;
      question_i18n?: Record<string, string>;
      answer: string;
      answer_i18n?: Record<string, string>;
      category_id: string;
      display_order?: number;
      is_active?: boolean;
    }): Promise<FAQWithCategory> => {
      const response = await apiClient.post('/faqs', faq);
      return response.data;
    },
    update: async (id: string, faq: Partial<{
      question: string;
      question_i18n: Record<string, string>;
      answer: string;
      answer_i18n: Record<string, string>;
      category_id: string;
      display_order: number;
      is_active: boolean;
    }>): Promise<FAQWithCategory> => {
      const response = await apiClient.put(`/faqs/${id}`, faq);
      return response.data;
    },
    toggleActive: async (id: string): Promise<FAQWithCategory> => {
      const response = await apiClient.patch(`/faqs/${id}/toggle-active`);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/faqs/${id}`);
    },
    reorder: async (faqs: { id: string }[]): Promise<void> => {
      await apiClient.put('/faqs/reorder/bulk', { faqs });
    },
  },

  // --- POLICY SERVICE ---
  policies: {
    upload: async (file: File, policyType: PolicyType, title?: string): Promise<Policy> => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('policyType', policyType);
      if (title) formData.append('title', title);

      const response = await apiClient.post('/policies/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return response.data.policy;
    },
    getPublic: async (policyType: PolicyType): Promise<Policy> => {
      const response = await apiClient.get(`/policies/public/${policyType}`);
      return response.data;
    },
    getVersion: async (policyType: PolicyType): Promise<{ version: number }> => {
      const response = await apiClient.get(`/policies/public/${policyType}/version`);
      return response.data;
    },
    getAllLanguageVersions: async (policyType: PolicyType): Promise<{
      titleI18n: { en: string; hi: string; ta: string; te: string };
      contentHtmlI18n: { en: string; hi: string; ta: string; te: string };
      version: number;
      updatedAt: string;
    }> => {
      const response = await apiClient.get(`/policies/admin/${policyType}/languages`);
      return response.data;
    }
  },

  // --- TESTIMONIAL SERVICE ---
  testimonials: {
    getAll: async (params?: { limit?: number; isAdmin?: boolean }): Promise<Testimonial[]> => {
      const response = await apiClient.get('/testimonials', { params });
      return response.data;
    },
    getById: async (id: string): Promise<Testimonial> => {
      const response = await apiClient.get(`/testimonials/${id}`);
      return response.data;
    },
    create: async (data: Partial<Testimonial>): Promise<Testimonial> => {
      const response = await apiClient.post('/testimonials', data);
      return response.data;
    },
    update: async (id: string, data: Partial<Testimonial>): Promise<Testimonial> => {
      const response = await apiClient.put(`/testimonials/${id}`, data);
      return response.data;
    },
    delete: async (id: string): Promise<void> => {
      await apiClient.delete(`/testimonials/${id}`);
    }
  }
};

// Backward compatibility
export const aboutService = staticApi.about;
export const faqService = staticApi.faqs;
export const policyService = staticApi.policies;
export const testimonialService = staticApi.testimonials;
