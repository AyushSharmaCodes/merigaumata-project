import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { settingsApi } from "@/domains/settings";
import i18nInstance from "@/app/i18n/config";
import { Product, Testimonial } from "@/shared/types";
import { Milk, Leaf, Recycle, Heart } from "lucide-react";
import { HomeMessages } from "@/shared/constants/messages/HomeMessages";
import { NavMessages } from "@/shared/constants/messages/NavMessages";

export const useHomePage = () => {
    const { t, i18n: i18nFromHook } = useTranslation();
    const i18n = i18nFromHook || i18nInstance;
    const currentLang = i18n?.language || "en";

    const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);
    const [selectedTestimonial, setSelectedTestimonial] = useState<Testimonial | null>(null);

    const { data: initData, isLoading } = useQuery({
        queryKey: ["app-initial-payload", currentLang],
        queryFn: () => settingsApi.publicContent.getInitialPayload(false),
        staleTime: 10 * 60 * 1000,
    });

    const homepageContent = initData?.homepage;
    const featuredProducts = homepageContent?.products?.slice(0, 10) || [];
    const upcomingEvents = homepageContent?.events?.slice(0, 10) || [];
    const latestBlogs = homepageContent?.blogs?.slice(0, 10) || [];
    const testimonials = homepageContent?.testimonials || [];
    const heroSlides = homepageContent?.carouselSlides || [];
    const mobileHeroSlides = (homepageContent?.mobileCarouselSlides && homepageContent.mobileCarouselSlides.length > 0)
        ? homepageContent.mobileCarouselSlides
        : heroSlides;

    const productsScrollRef = useRef<HTMLDivElement>(null);
    const eventsScrollRef = useRef<HTMLDivElement>(null);
    const blogsScrollRef = useRef<HTMLDivElement>(null);
    const testimonialsScrollRef = useRef<HTMLDivElement>(null);

    const scroll = (ref: React.RefObject<HTMLDivElement>, direction: "left" | "right") => {
        if (ref.current) {
            const scrollAmount = 400;
            ref.current.scrollBy({
                left: direction === "left" ? -scrollAmount : scrollAmount,
                behavior: "smooth",
            });
        }
    };

    const benefits = [
        { icon: Milk, title: t(HomeMessages.BENEFITS_PURE_TITLE), description: t(HomeMessages.BENEFITS_PURE_DESC) },
        { icon: Leaf, title: t(HomeMessages.BENEFITS_ORGANIC_TITLE), description: t(HomeMessages.BENEFITS_ORGANIC_DESC) },
        { icon: Recycle, title: t(HomeMessages.BENEFITS_ECO_TITLE), description: t(HomeMessages.BENEFITS_ECO_DESC) },
        { icon: Heart, title: t(HomeMessages.BENEFITS_HERITAGE_TITLE), description: t(HomeMessages.BENEFITS_HERITAGE_DESC) },
    ];

    return {
        t, isLoading,
        quickViewProduct, setQuickViewProduct,
        selectedTestimonial, setSelectedTestimonial,
        featuredProducts, upcomingEvents, latestBlogs, testimonials, heroSlides, mobileHeroSlides,
        productsScrollRef, eventsScrollRef, blogsScrollRef, testimonialsScrollRef,
        scroll, benefits,
    };
};
