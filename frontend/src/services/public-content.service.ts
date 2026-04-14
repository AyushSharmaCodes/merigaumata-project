import { apiClient } from "@/lib/api-client";
import type { BankDetails } from "@/services/bank-details.service";
import type { ContactInfoData } from "@/services/contact-info.service";
import type { Blog, Coupon, HeroCarouselSlide, Product, Testimonial } from "@/types";
import type { SocialMediaLink } from "@/types/contact";
import type { Event } from "@/types";
import type { GalleryItem } from "@/services/gallery-item.service";

export interface PublicSiteContent {
    contactInfo: ContactInfoData;
    socialMedia: SocialMediaLink[];
    bankDetails: BankDetails[];
    coupons: Coupon[];
    about: {
        footerDescription: string;
    };
}

export interface HomepageContent {
    products: Product[];
    events: Event[];
    blogs: Blog[];
    testimonials: Testimonial[];
    galleryItems: GalleryItem[];
    carouselSlides: HeroCarouselSlide[];
    mobileCarouselSlides: HeroCarouselSlide[];
}

export interface InitPayload {
    siteContent: PublicSiteContent;
    homepage: HomepageContent;
    timestamp: string;
}

export const publicContentService = {
    // THEORETICAL MINIMUM: Exactly 1 DB round-trip for the entire app init
    getInitialPayload: async (isAdmin = false): Promise<InitPayload> => {
        const response = await apiClient.get(`/public/init-payload?isAdmin=${isAdmin}`);
        return response.data;
    },

    getSiteContent: async (isAdmin = false): Promise<PublicSiteContent> => {
        const response = await apiClient.get(`/public/site-content?isAdmin=${isAdmin}`);
        return response.data;
    },

    getHomepageContent: async (): Promise<HomepageContent> => {
        const response = await apiClient.get('/public/homepage');
        return response.data;
    }
};
