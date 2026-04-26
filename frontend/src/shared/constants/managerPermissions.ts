export const MANAGER_PERMISSION_KEYS = [
  "can_manage_products",
  "can_manage_categories",
  "can_manage_orders",
  "can_manage_events",
  "can_manage_blogs",
  "can_manage_testimonials",
  "can_add_testimonials",
  "can_approve_testimonials",

  "can_manage_gallery",
  "can_manage_faqs",
  "can_manage_carousel",
  "can_manage_contact_info",
  "can_manage_social_media",
  "can_manage_bank_details",
  "can_manage_about_us",
  "can_manage_reviews",
  "can_manage_policies",
  "can_manage_contact_messages",
  "can_manage_coupons",
  "can_manage_background_jobs",
  "can_manage_delivery_configs",
] as const;

export const MANAGER_PERMISSION_COUNT = MANAGER_PERMISSION_KEYS.length;
