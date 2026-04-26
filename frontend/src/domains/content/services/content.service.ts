// Proxy: Legacy public-content service -> Content domain
export { publicContentApi as publicContentService } from "../api/content.api";

// Re-export types for backward compatibility
export type { AboutUsContent } from "../model/content.types";
export type { ContactInfoData, SocialMediaLink, BankDetails } from "@/domains/settings";

import type { ContactInfoData, SocialMediaLink, BankDetails } from "@/domains/settings";
import type { Coupon } from "@/domains/cart";
import type { Product, Blog, HeroCarouselSlide, Testimonial, Event } from "@/shared/types";

export interface PublicSiteContent {
    contactInfo: ContactInfoData;
    socialMedia: SocialMediaLink[];
    bankDetails: BankDetails[];
    coupons: Coupon[];
    about: { footerDescription: string };
    brandAssets?: Record<string, string>;
}

export interface HomepageContent {
    products: Product[];
    events: Event[];
    blogs: Blog[];
    testimonials: Testimonial[];
    galleryItems: any[];
    carouselSlides: HeroCarouselSlide[];
    mobileCarouselSlides: HeroCarouselSlide[];
}

export interface InitPayload {
    siteContent: PublicSiteContent;
    homepage: HomepageContent;
    timestamp: string;
}
