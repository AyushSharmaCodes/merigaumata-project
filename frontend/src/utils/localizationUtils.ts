
/**
 * Helper to get localized content from an object that has an i18n field.
 * Falls back to the default field if translation is missing.
 * 
 * @param data The object containing the data (e.g., category, product)
 * @param lang The current language code (e.g., 'en', 'hi')
 * @param field The field name to get (default: 'name')
 * @param i18nField The field containing translations (default: field + '_i18n')
 * @returns The localized string
 */
export const getLocalizedContent = (
    data: any,
    lang: string,
    field: string = 'name',
    i18nField?: string
): string => {
    if (!data) return '';

    const i18nKey = i18nField || `${field}_i18n`;

    // Check if i18n object exists and has the requested language
    if (data[i18nKey] && data[i18nKey][lang]) {
        return data[i18nKey][lang];
    }

    // Fallback to default field
    return data[field] || '';
};
