#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const BACKEND_DIR = path.join(__dirname, '../backend');
const FRONTEND_DIR = path.join(__dirname, '../frontend');
const LOCALES_DIR = path.join(FRONTEND_DIR, 'src/i18n/locales');
const locales = ['en', 'hi', 'ta', 'te'];

function setNestedKey(obj, keyPath, value) {
    const parts = keyPath.split('.');
    let current = obj;
    for (let i = 0; i < parts.length - 1; i++) {
        if (!current[parts[i]] || typeof current[parts[i]] !== 'object') {
            current[parts[i]] = {};
        }
        current = current[parts[i]];
    }
    // Only set if missing
    if (current[parts[parts.length - 1]] === undefined) {
        current[parts[parts.length - 1]] = value;
        return true;
    }
    return false;
}

const newKeys = [
    // Toasts
    { key: 'admin.events.toasts.updated', en: 'Event updated successfully' },
    { key: 'admin.events.toasts.created', en: 'Event created successfully' },
    { key: 'admin.events.toasts.saveError', en: 'Failed to save event' },
    { key: 'admin.events.toasts.cancelInitiated', en: 'Event cancellation initiated' },
    { key: 'admin.events.toasts.cancelError', en: 'Failed to cancel event' },
    { key: 'admin.events.toasts.rescheduled', en: 'Event rescheduled successfully' },
    { key: 'admin.events.toasts.rescheduleError', en: 'Failed to reschedule event' },
    { key: 'admin.events.toasts.retryInitiated', en: 'Retry initiated: {{message}}' },
    { key: 'admin.events.toasts.retryFailed', en: 'Retry failed' },
    { key: 'admin.events.toasts.uploading', en: 'Uploading image...' },
    { key: 'admin.events.toasts.updating', en: 'Updating event...' },
    { key: 'admin.events.toasts.creating', en: 'Creating event...' },
    { key: 'admin.events.toasts.cancelling', en: 'Cancelling event...' },
    { key: 'admin.events.toasts.updatingSchedule', en: 'Updating schedule...' },
    { key: 'admin.events.toasts.retrying', en: 'Retrying job...' },
    { key: 'admin.events.toasts.processing', en: 'Processing...' },

    // Job Status
    { key: 'admin.events.jobs.status.failed', en: 'Job failed' },
    { key: 'admin.events.jobs.pending', en: 'Pending' },
    { key: 'admin.events.jobs.processing', en: 'Processing' },
    { key: 'admin.events.jobs.completed', en: 'Completed' },
    { key: 'admin.events.jobs.partial', en: 'Partial Failure' },
    { key: 'admin.events.jobs.failed', en: 'Failed' },
    { key: 'admin.events.jobs.jobTitle', en: 'Job Status' },
    { key: 'admin.events.jobs.processedInfo', en: 'Processed: {{processed}} / {{total}}' },
    { key: 'admin.events.jobs.failedCount', en: 'Failed: {{count}}' },

    // Management UI
    { key: 'admin.events.management.tooltips.retry', en: 'Retry failed job' },
    { key: 'admin.events.management.title', en: 'Events Management' },
    { key: 'admin.events.management.subtitle', en: 'Create, edit, and manage events' },
    { key: 'admin.events.management.allEvents', en: 'All Events' },
    { key: 'admin.events.management.searchPlaceholder', en: 'Search events...' },
    { key: 'admin.events.management.addEvent', en: 'Add Event' },
    { key: 'admin.events.management.loadingRecords', en: 'Loading events...' },
    { key: 'admin.events.management.noEventsFound', en: 'No events found' },
    { key: 'admin.events.management.table.event', en: 'Event' },
    { key: 'admin.events.management.table.date', en: 'Date' },
    { key: 'admin.events.management.table.location', en: 'Location' },
    { key: 'admin.events.management.table.status', en: 'Status' },
    { key: 'admin.events.management.table.actions', en: 'Actions' },
    { key: 'admin.events.management.tooltips.edit', en: 'Edit Event' },
    { key: 'admin.events.management.tooltips.reschedule', en: 'Reschedule Event' },
    { key: 'admin.events.management.tooltips.cancel', en: 'Cancel Event' },
    { key: 'admin.events.management.pagination.info', en: 'Displaying {{start}} - {{end}} of {{total}} records' },

    // Event Status (New)
    { key: 'admin.events.status.upcoming', en: 'Upcoming', hi: 'आगामी', ta: 'வரவிருக்கும்', te: 'రాబోయే' },
    { key: 'admin.events.status.ongoing', en: 'Ongoing', hi: 'चल रही है', ta: 'நடந்து கொண்டிருக்கிறது', te: 'జరుగుతోంది' },
    { key: 'admin.events.status.completed', en: 'Completed', hi: 'पूर्ण', ta: 'முடிந்தது', te: ' పూర్తయింది' },
    { key: 'admin.events.status.cancelled', en: 'Cancelled', hi: 'रद्द', ta: 'ரத்து செய்யப்பட்டது', te: 'రద్దు చేయబడింది' }
];


const backendLocaleData = {};
for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    try {
        backendLocaleData[locale] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.error(`Error reading ${locale}.json:`, e.message);
        backendLocaleData[locale] = {};
    }
}

let keysAdded = 0;
for (const r of newKeys) {
    for (const locale of locales) {
        // Use english value as default if specific locale translation is missing
        const val = r[locale] || r.en;
        if (val && setNestedKey(backendLocaleData[locale], r.key, val)) {
            keysAdded++;
        }
    }
}

for (const locale of locales) {
    const filePath = path.join(LOCALES_DIR, `${locale}.json`);
    fs.writeFileSync(filePath, JSON.stringify(backendLocaleData[locale], null, 2) + '\n', 'utf8');
}

console.log(`Added ${keysAdded} keys to locale files.`);
