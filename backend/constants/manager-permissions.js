const MANAGER_PERMISSION_KEYS = [
    'can_manage_products',
    'can_manage_categories',
    'can_manage_orders',
    'can_manage_events',
    'can_manage_blogs',
    'can_manage_testimonials',
    'can_manage_gallery',
    'can_manage_faqs',
    'can_manage_carousel',
    'can_manage_contact_info',
    'can_manage_social_media',
    'can_manage_bank_details',
    'can_manage_about_us',
    'can_manage_newsletter',
    'can_manage_reviews',
    'can_manage_policies',
    'can_manage_contact_messages',
    'can_manage_coupons'
];

function getDefaultManagerPermissions() {
    return MANAGER_PERMISSION_KEYS.reduce((acc, key) => {
        acc[key] = false;
        return acc;
    }, {});
}

function sanitizeManagerPermissions(input = {}) {
    const permissions = getDefaultManagerPermissions();

    for (const key of MANAGER_PERMISSION_KEYS) {
        if (Object.prototype.hasOwnProperty.call(input, key)) {
            permissions[key] = Boolean(input[key]);
        }
    }

    return permissions;
}

module.exports = {
    MANAGER_PERMISSION_KEYS,
    MANAGER_PERMISSION_COUNT: MANAGER_PERMISSION_KEYS.length,
    getDefaultManagerPermissions,
    sanitizeManagerPermissions
};
