/**
 * SES Templates Registry
 * Exports an array of all defined SES templates for the deploy script
 */

const registrationTemplates = require('./registration');
const authTemplates = require('./auth');
const orderTemplates = require('./order');
const eventTemplates = require('./event');
const donationTemplates = require('./donation');
const subscriptionTemplates = require('./subscription');
const contactTemplates = require('./contact');
const accountTemplates = require('./account');
const managerTemplates = require('./manager');

// Combine all template objects into a flat array
const allTemplates = [
    ...registrationTemplates,
    ...authTemplates,
    ...orderTemplates,
    ...eventTemplates,
    ...donationTemplates,
    ...subscriptionTemplates,
    ...contactTemplates,
    ...accountTemplates,
    ...managerTemplates
];

module.exports = {
    allTemplates
};
