// Proxy: Legacy contact types → Settings domain
export type { SocialMediaLink, BankDetails } from "@/domains/settings";

// Legacy aliases with simplified shapes (for backward compat)
import type {
    ContactPhone as DomainContactPhone,
    ContactEmail as DomainContactEmail,
    OfficeHour as DomainOfficeHour
} from "@/domains/settings";

export type ContactPhone = DomainContactPhone;
export type ContactEmail = DomainContactEmail;
export type OfficeHours = DomainOfficeHour;

export interface ContactSettings {
    socialMedia: import("@/domains/settings").SocialMediaLink[];
    phones: ContactPhone[];
    emails: ContactEmail[];
    address: string;
    bankDetails: import("@/domains/settings").BankDetails[];
}
