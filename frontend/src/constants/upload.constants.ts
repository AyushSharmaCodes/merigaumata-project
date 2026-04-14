/**
 * Upload Constants
 *
 * Single source of truth for file upload size limits across the entire frontend.
 * Change these values here to update all upload components at once.
 */

/** Maximum image size for admin-uploaded images (product, gallery, event, blog, team, carousel) */
export const MAX_ADMIN_IMAGE_SIZE_MB = 3;
export const MAX_ADMIN_IMAGE_SIZE_BYTES = MAX_ADMIN_IMAGE_SIZE_MB * 1024 * 1024;

/** Maximum image size for customer-facing uploads (profile avatar, return photos) */
export const MAX_USER_IMAGE_SIZE_MB = 1;
export const MAX_USER_IMAGE_SIZE_BYTES = MAX_USER_IMAGE_SIZE_MB * 1024 * 1024;

/** Generic fallback used by shared components that serve both admin and users */
export const MAX_IMAGE_SIZE_MB = MAX_USER_IMAGE_SIZE_MB;
export const MAX_IMAGE_SIZE_BYTES = MAX_USER_IMAGE_SIZE_BYTES;
export const MAX_IMAGE_SIZE_LABEL = `${MAX_IMAGE_SIZE_MB}MB`;
