import { Product } from '@/types';
import { AVAILABLE_TAGS } from '@/constants/productConstants';

/**
 * Utility to get localized and unique tags for a product.
 * 
 * Logic:
 * 1. Predefined tags (those in AVAILABLE_TAGS) are always included if they exist in product.tags.
 * 2. For English ('en'):
 *    - Custom tags are filtered from product.tags (those not in AVAILABLE_TAGS).
 * 3. For other languages:
 *    - Custom tags are taken from product.tags_i18n[lang].
 *    - If no localized custom tags exist, it falls back to English custom tags.
 * 4. Ensures no duplication of predefined tags even if they are added to localizations.
 */
export const getLocalizedTags = (product: Product, currentLang: string): string[] => {
    const productTags = product.tags || [];

    // 1. Get predefined tags from the main tags array
    const predefinedTags = productTags.filter(t =>
        AVAILABLE_TAGS.includes(t.toLowerCase())
    );

    // 2. Get custom tags
    let customTags: string[] = [];

    if (currentLang === 'en') {
        customTags = productTags.filter(t =>
            !AVAILABLE_TAGS.includes(t.toLowerCase())
        );
    } else {
        // Check for localized tags
        const localizedCustomTags = product.tags_i18n?.[currentLang] || [];

        if (localizedCustomTags.length > 0) {
            customTags = localizedCustomTags;
        }
    }

    // 3. Combine and ensure uniqueness (case-insensitive for predefined, but keep original for display)
    // Predefined tags are already handled by i18n in components, so we return their keys.
    // We want to make sure predefined tags from customTags (if any) don't duplicate.

    const allTags = [...predefinedTags];

    customTags.forEach(tag => {
        const lowerTag = tag.toLowerCase();
        // Don't add if it's already in predefinedTags or if it's actually a predefined tag key
        const isPredefined = AVAILABLE_TAGS.includes(lowerTag);
        const alreadyExists = allTags.some(t => t.toLowerCase() === lowerTag);

        if (!isPredefined && !alreadyExists) {
            allTags.push(tag);
        }
    });

    return allTags;
};
