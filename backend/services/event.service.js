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
        const offset = (page - 1) * limit;
        logger.info({ page, limit, search, status }, '[EventService] getAllEvents: Fetching events');

        let query = supabase
            .from('events')
            .select('*', { count: 'exact' });

        if (search) {
            query = query.ilike('title', `%${search}%`);
        }

        // Status filtering using SQL Date logic
        if (status && status !== 'all') {
            const now = new Date().toISOString();

            switch (status) {
                case 'upcoming':
                    // Start date is in the future
                    query = query.gt('start_date', now);
                    break;
                case 'completed':
                    // End date is in the past (or start date if no end date)
                    query = query.or(`end_date.lt.${now},and(end_date.is.null,start_date.lt.${now})`);
                    break;
                case 'ongoing':
                    // Started but not ended
                    // start_date <= NOW AND (end_date >= NOW OR end_date IS NULL)
                    query = query.lte('start_date', now).or(`end_date.gte.${now},end_date.is.null`);
                    break;
            }
        }

        query = query
            .order('start_date', { ascending: true })
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        const startTime = Date.now();
        const { data, error, count } = await query;
        const duration = Date.now() - startTime;

        if (error) {
            logger.error({ err: error, duration }, '[EventService] getAllEvents: DB Error');
            throw error;
        }

        // Manual Join: Fetch category data for localization
        if (data && data.length > 0) {
            const catNames = [...new Set(data.map(e => e.category).filter(Boolean))];
            if (catNames.length > 0) {
                const { data: catData, error: catError } = await supabase
                    .from('categories')
                    .select('*')
                    .in('name', catNames)
                    .eq('type', 'event');

                if (!catError && catData) {
                    const catMap = Object.fromEntries(catData.map(c => [c.name, c]));
                    data.forEach(e => {
                        e.category_data = catMap[e.category];
                    });
                }
            }
        }

        logger.info({ count, resultCount: (data || []).length, duration }, '[EventService] getAllEvents: Success');

        return {
            events: (data || []).map(e => mapToFrontend(e, lang)),
            total: count || 0
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
