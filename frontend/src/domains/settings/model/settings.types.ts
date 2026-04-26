// ─── Category ───────────────────────────────────────────────────────────────

export type CategoryType = 'product' | 'event' | 'faq' | 'gallery';

export interface Category {
    id: string;
    name: string;
    original_name?: string;
    name_i18n?: Record<string, string>;
    type: CategoryType;
    createdAt: string;
}

// ─── Contact Info ───────────────────────────────────────────────────────────

export interface ContactAddress {
    id?: string;
    address_line1: string;
    address_line1_i18n?: Record<string, string>;
    address_line2?: string;
    address_line2_i18n?: Record<string, string>;
    city: string;
    city_i18n?: Record<string, string>;
    state: string;
    state_i18n?: Record<string, string>;
    pincode: string;
    country: string;
    country_i18n?: Record<string, string>;
    google_maps_link?: string;
    google_place_id?: string;
    map_latitude?: number;
    map_longitude?: number;
}

export interface ContactPhone {
    id: string;
    number: string;
    label?: string;
    label_i18n?: Record<string, string>;
    is_primary: boolean;
    is_active: boolean;
    display_order: number;
}

export interface ContactEmail {
    id: string;
    email: string;
    label?: string;
    label_i18n?: Record<string, string>;
    is_primary: boolean;
    is_active: boolean;
    display_order: number;
}

export interface OfficeHour {
    id: string;
    day_of_week: string;
    open_time?: string;
    close_time?: string;
    is_closed: boolean;
    display_order: number;
}

export interface ContactInfoData {
    address: ContactAddress;
    phones: ContactPhone[];
    emails: ContactEmail[];
    officeHours: OfficeHour[];
}

export interface ContactFormData {
    name: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
}

export interface ContactResponse {
    success: boolean;
    message: string;
    data?: { id: string };
}

export interface ContactMessage {
    id: string;
    name: string;
    email: string;
    phone: string;
    subject?: string;
    message: string;
    status: 'NEW' | 'READ' | 'REPLIED' | 'ARCHIVED';
    ip_address?: string;
    user_agent?: string;
    created_at: string;
}

export interface ContactMessagesResponse {
    messages: ContactMessage[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// ─── Social Media ───────────────────────────────────────────────────────────

export interface SocialMediaLink {
    id: string;
    platform: string;
    url: string;
    icon?: string;
    order?: number;
}

// ─── Bank Details ───────────────────────────────────────────────────────────

export interface BankDetails {
    id: string;
    accountName: string;
    accountNumber: string;
    ifscCode: string;
    bankName: string;
    branchName?: string;
    upiId?: string;
    type: "general" | "donation";
}

// ─── Currency ───────────────────────────────────────────────────────────────

export interface SupportedCurrency {
    code: string;
    label: string;
    symbol?: string;
}

export interface CurrencySettings {
    base_currency: string;
    supported_currencies: SupportedCurrency[];
}

export interface CurrencyContextResponse extends CurrencySettings {
    display_currency: string;
    rate: number;
    provider: string;
    fetched_at: string;
    rates: Record<string, number>;
    is_stale?: boolean;
    default_display_currency?: string;
}

// ─── Delivery Settings ──────────────────────────────────────────────────────

export interface DeliverySettings {
    delivery_threshold: number;
    delivery_charge: number;
    delivery_gst?: number;
    delivery_gst_mode?: 'inclusive' | 'exclusive';
}

// ─── Policy ─────────────────────────────────────────────────────────────────

export interface Policy {
    id: string;
    slug: string;
    title: string;
    title_i18n?: Record<string, string>;
    content: string;
    content_i18n?: Record<string, string>;
    is_active: boolean;
    unavailable?: boolean;
    updated_at: string;
}
