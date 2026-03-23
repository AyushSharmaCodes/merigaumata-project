/**
 * Email Template i18n Helper
 * 
 * This module provides backward-compatible helper functions for email templates
 * that were using the old getCommonStrings() pattern.
 * 
 * All templates should eventually migrate to using the `t` function directly,
 * but this provides a transition layer.
 */

const { i18next } = require('../../../middleware/i18n.middleware');

/**
 * Get common email strings for a specific language
 * @deprecated Use the `t` function passed to templates instead
 * @param {string} lang - Language code ('en', 'hi', 'ta', etc.)
 * @returns {object} Common strings object
 */
function getCommonStrings(lang = 'en') {
    const t = i18next.getFixedT(lang);

    return {
        dear: t('emails.common.dear'),
        valuedDonor: t('emails.common.valuedDonor'),
        generousDonor: t('emails.common.generousDonor'),
        withGratitude: t('emails.common.withGratitude'),
        withRegards: t('emails.common.withRegards'),
        team: t('emails.common.team', { appName: process.env.APP_NAME || 'MeriGauMata' }),
        taxInfo: t('emails.common.taxInfo'),
        securityNote: t('emails.common.securityNote'),
        rights: t('emails.common.rights'),
        visit: t('emails.common.visit')
    };
}

module.exports = {
    getCommonStrings
};
