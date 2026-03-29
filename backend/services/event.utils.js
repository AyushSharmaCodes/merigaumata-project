const EventPricingService = require('./event-pricing.service');
const { applyTranslations } = require('../utils/i18n.util');

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
const DEFAULT_SCHEDULE_TYPE = 'single_day';
const VALID_SCHEDULE_TYPES = new Set(['single_day', 'multi_day_daily', 'multi_day_continuous']);

const normalizeScheduleType = (scheduleType, event = {}) => {
    if (VALID_SCHEDULE_TYPES.has(scheduleType)) return scheduleType;

    const startDate = event.startDate || event.start_date;
    const endDate = event.endDate || event.end_date;
    if (!startDate) return DEFAULT_SCHEDULE_TYPE;

    const startDay = new Date(startDate).toDateString();
    const endDay = endDate ? new Date(endDate).toDateString() : startDay;

    if (startDay !== endDay) {
        return 'multi_day_daily';
    }

    return DEFAULT_SCHEDULE_TYPE;
};

const getDefaultRegistrationDeadline = (event = {}) => {
    if (!event.startDate || !event.startTime) return undefined;

    const eventStart = new Date(event.startDate);
    if (Number.isNaN(eventStart.getTime())) return undefined;

    const [hours, minutes] = String(event.startTime).split(':').map(Number);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return undefined;

    eventStart.setHours(hours, minutes, 0, 0);
    return new Date(eventStart.getTime() - 24 * 60 * 60 * 1000).toISOString();
};

/**
 * Map snake_case DB object to camelCase frontend object
 */
const mapToFrontend = (rawEvent, lang = 'en') => {
    if (!rawEvent) return null;

    // Apply translations while preserving i18n blocks so the client can switch locally.
    const event = applyTranslations(rawEvent, lang, false);

    return {
        id: event.id,
        title: event.title,
        title_i18n: event.title_i18n,
        description: event.description,
        description_i18n: event.description_i18n,
        startDate: event.start_date,
        startTime: event.start_time,
        endDate: event.end_date,
        endTime: event.end_time,
        scheduleType: normalizeScheduleType(event.schedule_type, event),
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registrations: event.registrations,
        registration_amount: event.registration_amount,
        registrationAmount: event.registration_amount,
        gstRate: event.gst_rate,
        basePrice: event.base_price,
        gstAmount: event.gst_amount,
        registrationDeadline: event.registration_deadline,
        category: (event.category_data && event.category_data.name) || event.category,
        category_data: event.category_data,
        status: event.status,
        kathaVachak: event.katha_vachak,
        contactAddress: event.contact_address,
        isRegistrationEnabled: event.is_registration_enabled,
        keyHighlights: event.key_highlights,
        keyHighlights_i18n: event.key_highlights_i18n,
        specialPrivileges: event.special_privileges,
        specialPrivileges_i18n: event.special_privileges_i18n,
        cancellationStatus: event.cancellation_status,
        cancelledAt: event.cancelled_at,
        cancellationReason: event.cancellation_reason,
        cancellationCorrelationId: event.cancellation_correlation_id,
        createdAt: event.created_at,
        updatedAt: event.updated_at
    };
};

/**
 * Map camelCase frontend object to snake_case DB object
 */
const mapToDb = (event) => {
    const scheduleType = normalizeScheduleType(event.scheduleType, event);

    // Validate required fields
    const requiredFields = [
        { key: 'start_date', label: 'Start Date', val: event.startDate },
        { key: 'start_time', label: 'Start Time', val: event.startTime },
        { key: 'end_time', label: 'End Time', val: event.endTime }
    ];

    for (const field of requiredFields) {
        if (!field.val || field.val.trim() === '') {
            const error = new Error(`${field.label} is required`);
            error.statusCode = 400;
            throw error;
        }
    }

    if (!VALID_SCHEDULE_TYPES.has(scheduleType)) {
        const error = new Error('Schedule Type is invalid');
        error.statusCode = 400;
        throw error;
    }

    if (scheduleType !== 'single_day' && !event.endDate) {
        const error = new Error('End Date is required for multi-day events');
        error.statusCode = 400;
        throw error;
    }

    // Calculate tax breakdown if pricing info is provided
    let pricing = {
        basePrice: 0,
        gstAmount: 0,
        totalAmount: event.registrationAmount || 0,
        gstRate: event.gstRate || 0
    };

    if (event.registrationAmount > 0) {
        pricing = EventPricingService.calculateBreakdown(event.registrationAmount, event.gstRate);
    }

    const explicitRegistrationDeadline = hasOwn(event, 'registrationDeadline')
        ? event.registrationDeadline
        : undefined;
    const registrationDeadline = explicitRegistrationDeadline
        ? explicitRegistrationDeadline
        : getDefaultRegistrationDeadline(event);

    const dbEvent = {
        title: event.title,
        title_i18n: event.title_i18n,
        description: event.description,
        description_i18n: event.description_i18n,
        start_date: event.startDate,
        start_time: event.startTime,
        end_date: event.endDate, // End date is optional in DB but effectively required for logic usually
        end_time: event.endTime,
        schedule_type: scheduleType,
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registration_amount: pricing.totalAmount,
        gst_rate: pricing.gstRate,
        base_price: pricing.basePrice,
        gst_amount: pricing.gstAmount,
        registration_deadline: registrationDeadline,
        category: event.category,
        status: event.status,
        katha_vachak: event.kathaVachak,
        contact_address: event.contactAddress,
        is_registration_enabled: event.isRegistrationEnabled,
        key_highlights: event.keyHighlights,
        key_highlights_i18n: event.keyHighlights_i18n,
        special_privileges: event.specialPrivileges,
        special_privileges_i18n: event.specialPrivileges_i18n,
        cancellation_status: event.cancellationStatus,
        cancelled_at: event.cancelledAt,
        cancellation_reason: event.cancellationReason,
        cancellation_correlation_id: event.cancellationCorrelationId,
        updated_at: new Date().toISOString()
    };

    // Remove undefined fields
    Object.keys(dbEvent).forEach(key => dbEvent[key] === undefined && delete dbEvent[key]);

    return dbEvent;
};

module.exports = {
    DEFAULT_SCHEDULE_TYPE,
    getDefaultRegistrationDeadline,
    mapToFrontend,
    mapToDb,
    normalizeScheduleType
};
