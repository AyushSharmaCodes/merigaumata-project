const supabase = require('../config/supabase');
const { pino: logger } = require('../utils/logger');
const { deletePhotoByUrl } = require('./photo.service');
const EventPricingService = require('./event-pricing.service');
const { mapToFrontend, mapToDb } = require('./event.utils');
// We require EventCancellationService dynamically inside updateEvent to avoid immediate circular require issue

// Helpers removed and moved to event.utils.js

class EventService {
    /**
     * Get all events with pagination and search
     */
    static async getAllEvents({ page = 1, limit = 15, search = '', status = 'all', lang = 'en' } = {}) {
        logger.info({ page, limit, search, status }, '[EventService] getAllEvents: Fetching optimized events');

        const { data, error } = await supabase.rpc('get_events_paginated', {
            p_page: page,
            p_limit: limit,
            p_search: search,
            p_status: status,
            p_lang: lang
        });

        if (error) {
            logger.error({ err: error }, '[EventService] getAllEvents: RPC Error');
            throw error;
        }

        if (data.events && data.events.length > 0) {
            logger.info({ 
                firstEventKeys: Object.keys(data.events[0]),
                sampleMapped: mapToFrontend(data.events[0], lang)
            }, '[EventService] getAllEvents: Mapping check');
        }

        return {
            events: (data.events || []).map(e => mapToFrontend(e, lang)),
            total: data.total || 0,
            page: data.page,
            limit: data.limit
        };
    }

    /**
     * Get single event by ID
     */
    static async getEventById(id, lang = 'en') {
        const { data, error } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;

        // Manual Join: Fetch category data for localization
        if (data && data.category) {
            const { data: catData, error: catError } = await supabase
                .from('categories')
                .select('*')
                .eq('name', data.category)
                .eq('type', 'event')
                .single();

            if (!catError && catData) {
                data.category_data = catData;
            }
        }

        return mapToFrontend(data, lang);
    }

    /**
     * Create event
     */
    static async createEvent(eventData) {
        logger.info({ title: eventData.title }, '[EventService] createEvent: Creating new event');
        const dbEvent = mapToDb(eventData);
        // Add created_at for new records
        dbEvent.created_at = new Date().toISOString();
        // Default registrations to 0 if not provided
        if (dbEvent.registrations === undefined) dbEvent.registrations = 0;

        const { data, error } = await supabase
            .from('events')
            .insert([dbEvent])
            .select()
            .single();

        if (error) {
            logger.error({ err: error, title: eventData.title }, '[EventService] createEvent: DB Error');
            throw error;
        }

        // Manual Join for response
        if (data && data.category) {
            const { data: catData } = await supabase
                .from('categories')
                .select('*')
                .eq('name', data.category)
                .eq('type', 'event')
                .single();
            if (catData) data.category_data = catData;
        }

        logger.info({ id: data.id }, '[EventService] createEvent: Success');
        return mapToFrontend(data);
    }

    /**
     * Update event
     */
    static async updateEvent(id, eventData) {
        logger.info({ id, updates: Object.keys(eventData) }, '[EventService] updateEvent: Updating event');
        // 1. Get old event for comparison
        const { data: oldEvent, error: fetchError } = await supabase
            .from('events')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            logger.error({ err: fetchError, id }, '[EventService] updateEvent: Event not found');
            throw fetchError;
        }

        const mergedEventData = {
            ...mapToFrontend(oldEvent),
            ...eventData
        };
        const dbEvent = mapToDb(mergedEventData);

        // 2. Perform Update
        const { data, error } = await supabase
            .from('events')
            .update(dbEvent)
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error({ err: error, id }, '[EventService] updateEvent: DB Update Error');
            throw error;
        }

        // 3. CHECK FOR DATE CHANGES -> Trigger Notifications
        const oldStart = oldEvent.start_date;
        const newStart = data.start_date;
        const oldEnd = oldEvent.end_date;
        const newEnd = data.end_date;

        if (oldStart !== newStart || oldEnd !== newEnd) {
            logger.info({ eventId: id, oldStart, newStart }, '[EventService] Date change detected in updateEvent, triggering notifications');

            // Require EventCancellationService here to avoid circular dependencies at load time
            const EventCancellationService = require('./event-cancellation.service');

            EventCancellationService.notifyScheduleUpdate(
                id,
                data,
                'Event details updated by administrator.',
                `AUTO_UPDATE_${Date.now()}`
            ).catch(err => logger.error({ err: err.message }, 'Failed to trigger automatic schedule update emails'));
        }

        // Manual Join for response
        if (data && data.category) {
            const { data: catData } = await supabase
                .from('categories')
                .select('*')
                .eq('name', data.category)
                .eq('type', 'event')
                .single();
            if (catData) data.category_data = catData;
        }

        return mapToFrontend(data);
    }

    /**
     * Delete event
     */
    static async deleteEvent(id) {
        // 1. Get event to find image URL
        const { data: event, error: fetchError } = await supabase
            .from('events')
            .select('image')
            .eq('id', id)
            .single();

        if (fetchError) throw fetchError;

        // 2. Delete event from database first
        const { error } = await supabase
            .from('events')
            .delete()
            .eq('id', id);

        if (error) throw error;

        // 3. Clean up event image from storage and photos table
        if (event && event.image) {
            // Don't await - let cleanup happen asynchronously
            deletePhotoByUrl(event.image).catch(err =>
                logger.error('Error cleaning up event image:', err)
            );
        }

        return true;
    }
}

module.exports = EventService;
