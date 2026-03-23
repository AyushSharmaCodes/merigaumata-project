const EventPricingService = require('./event-pricing.service');
const { applyTranslations } = require('../utils/i18n.util');

/**
 * Map snake_case DB object to camelCase frontend object
 */
const mapToFrontend = (rawEvent, lang = 'en') => {
    if (!rawEvent) return null;

    // Apply translations and strip bulky i18n blocks
    const event = applyTranslations(rawEvent, lang);

    return {
        id: event.id,
        title: event.title,
        description: event.description,
        startDate: event.start_date,
        startTime: event.start_time,
        endDate: event.end_date,
        endTime: event.end_time,
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
        specialPrivileges: event.special_privileges,
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

    const dbEvent = {
        title: event.title,
        title_i18n: event.title_i18n,
        description: event.description,
        description_i18n: event.description_i18n,
        start_date: event.startDate,
        start_time: event.startTime,
        end_date: event.endDate, // End date is optional in DB but effectively required for logic usually
        end_time: event.endTime,
        location: event.location,
        image: event.image,
        capacity: event.capacity,
        registration_amount: pricing.totalAmount,
        gst_rate: pricing.gstRate,
        base_price: pricing.basePrice,
        gst_amount: pricing.gstAmount,
        registration_deadline: event.registrationDeadline || null, // Handle optional deadline
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
    mapToFrontend,
    mapToDb
};
