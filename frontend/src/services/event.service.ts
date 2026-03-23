import { apiClient } from '@/lib/api-client';
import type { Event, CancellationJobStatus } from '@/types';

/**
 * Computes the event status based on startDate and endDate compared to current date.
 */
function computeEventStatus(startDate: string, endDate?: string): 'upcoming' | 'ongoing' | 'completed' {
    const now = new Date();
    const start = new Date(startDate);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = endDate ? new Date(endDate) : start;
    const endDay = new Date(end.getFullYear(), end.getMonth(), end.getDate());

    if (today < new Date(start.getFullYear(), start.getMonth(), start.getDate())) {
        return 'upcoming';
    } else if (today > endDay) {
        return 'completed';
    } else {
        return 'ongoing';
    }
}

/**
 * Applies computed status to an event based on its dates.
 */
function enrichEventWithStatus(event: any): Event {
    if (event.status === 'cancelled') return event as Event;
    return {
        ...event,
        status: computeEventStatus(event.startDate, event.endDate)
    };
}

export const eventService = {
    getAll: async (params?: { page?: number; limit?: number; search?: string; status?: string }): Promise<{ events: Event[]; total: number }> => {
        const response = await apiClient.get('/events', { params });
        const data = response.data;
        const events = Array.isArray(data) ? data : (data.events || []);
        const total = Array.isArray(data) ? data.length : (data.total || 0);

        return {
            events: events.map(enrichEventWithStatus),
            total
        };
    },

    getById: async (id: string): Promise<Event> => {
        const response = await apiClient.get(`/events/${id}`);
        return enrichEventWithStatus(response.data);
    },

    create: async (event: Omit<Event, 'id'>): Promise<Event> => {
        const response = await apiClient.post('/events', event);
        return enrichEventWithStatus(response.data);
    },

    update: async (id: string, event: Partial<Event>): Promise<Event> => {
        const response = await apiClient.put(`/events/${id}`, event);
        return enrichEventWithStatus(response.data);
    },

    delete: async (id: string): Promise<void> => {
        await apiClient.delete(`/events/${id}`);
    },

    // Admin Specific Methods
    cancel: async (id: string, reason: string): Promise<{ success: boolean; jobId: string }> => {
        const response = await apiClient.post(`/admin/events/${id}/cancel`, { reason });
        return response.data;
    },

    updateSchedule: async (id: string, data: { startDate: string; endDate?: string; reason: string }): Promise<{ success: boolean }> => {
        const response = await apiClient.post(`/admin/events/${id}/update-schedule`, data);
        return response.data;
    },

    getJobStatus: async (id: string): Promise<CancellationJobStatus | null> => {
        const response = await apiClient.get(`/admin/events/${id}/cancellation-job`);
        return response.data;
    },

    retryCancellation: async (id: string): Promise<{ success: boolean; message: string; jobId: string; pendingRegistrations?: number }> => {
        const response = await apiClient.post(`/admin/events/${id}/retry-cancellation`);
        return response.data;
    }
};
