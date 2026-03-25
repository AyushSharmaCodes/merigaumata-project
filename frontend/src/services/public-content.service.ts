import { apiClient } from "@/lib/api-client";
import type { BankDetails } from "@/services/bank-details.service";
import type { ContactInfoData } from "@/services/contact-info.service";
import type { Blog, HeroCarouselSlide, Product, Testimonial } from "@/types";
import type { SocialMediaLink } from "@/types/contact";
import type { Event } from "@/types";
import type { GalleryItem } from "@/services/gallery-item.service";

export interface PublicSiteContent {
    contactInfo: ContactInfoData;
    socialMedia: SocialMediaLink[];
    bankDetails: BankDetails[];
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
}

export const publicContentService = {
    getSiteContent: async (isAdmin = false): Promise<PublicSiteContent> => {
        const response = await apiClient.get(`/public/site-content?isAdmin=${isAdmin}`);
        return response.data;
    },

    getHomepageContent: async (): Promise<HomepageContent> => {
        const response = await apiClient.get('/public/homepage');
        return response.data;
    }
};
