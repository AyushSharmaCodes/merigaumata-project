import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { HeroCarousel } from "@/components/HeroCarousel";
import { ProductCard } from "@/components/ProductCard";
import { ProductQuickView } from "@/components/ProductQuickView";
import { EventCard } from "@/components/EventCard";
import { BlogCard } from "@/components/BlogCard";
import { TestimonialModal } from "@/components/TestimonialModal";
import { TestimonialCard } from "@/components/TestimonialCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Product, Testimonial } from "@/types";
import { HomePageSkeleton } from "@/components/ui/page-skeletons";
import {
  Milk,
  Leaf,
  Recycle,
  Heart,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Sparkles,
} from "lucide-react";

import { HomeMessages } from "@/constants/messages/HomeMessages";
import { ProductMessages } from "@/constants/messages/ProductMessages";
import { EventMessages } from "@/constants/messages/EventMessages";
import { BlogMessages } from "@/constants/messages/BlogMessages";
import { NavMessages } from "@/constants/messages/NavMessages";

import i18nInstance from "@/i18n/config";
import { publicContentService } from "@/services/public-content.service";
import type { GalleryItem } from "@/services/gallery-item.service";

const Index = () => {
  const { t, i18n: i18nFromHook } = useTranslation();
  // Fallback to imported instance if hook doesn't provide it (fixes ReferenceError)
  const i18n = i18nFromHook || i18nInstance;
  const currentLang = i18n?.language || "en";

  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(
    null
  );
  const [selectedTestimonial, setSelectedTestimonial] =
    useState<Testimonial | null>(null);

  const { data: initData, isLoading } = useQuery({
    queryKey: ["app-initial-payload", currentLang],
    queryFn: () => publicContentService.getInitialPayload(false),
    staleTime: 10 * 60 * 1000,
  });

  const homepageContent = initData?.homepage;
  const featuredProducts = homepageContent?.products?.slice(0, 10) || [];
  const upcomingEvents = homepageContent?.events?.slice(0, 10) || [];
  const latestBlogs = homepageContent?.blogs?.slice(0, 10) || [];
  const testimonials = homepageContent?.testimonials || [];
  const latestGalleryItems: GalleryItem[] = homepageContent?.galleryItems || [];
  const heroSlides = homepageContent?.carouselSlides || [];
  const mobileHeroSlides = (homepageContent?.mobileCarouselSlides && homepageContent.mobileCarouselSlides.length > 0)
    ? homepageContent.mobileCarouselSlides
    : heroSlides;

  const productsScrollRef = useRef<HTMLDivElement>(null);
  const eventsScrollRef = useRef<HTMLDivElement>(null);
  const blogsScrollRef = useRef<HTMLDivElement>(null);
  const testimonialsScrollRef = useRef<HTMLDivElement>(null);

  const scroll = (
    ref: React.RefObject<HTMLDivElement>,
    direction: "left" | "right"
  ) => {
    if (ref.current) {
      const scrollAmount = 400;
      ref.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  };

  const handleScroll = (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;

    const container = ref.current;
    const scrollWidth = container.scrollWidth;
    const clientWidth = container.clientWidth;
    const scrollLeft = container.scrollLeft;

    // When scrolled to the end, reset to beginning
    if (scrollLeft + clientWidth >= scrollWidth - 10) {
      container.scrollLeft = 0;
    }
    // When scrolled to the beginning (backward), jump to end
    else if (scrollLeft <= 10) {
      container.scrollLeft = (scrollWidth - clientWidth) / 2;
    }
  };

  const benefits = [
    {
      icon: Milk,
      title: t(HomeMessages.BENEFITS_PURE_TITLE),
      description: t(HomeMessages.BENEFITS_PURE_DESC),
    },
    {
      icon: Leaf,
      title: t(HomeMessages.BENEFITS_ORGANIC_TITLE),
      description: t(HomeMessages.BENEFITS_ORGANIC_DESC),
    },
    {
      icon: Recycle,
      title: t(HomeMessages.BENEFITS_ECO_TITLE),
      description: t(HomeMessages.BENEFITS_ECO_DESC),
    },
    {
      icon: Heart,
      title: t(HomeMessages.BENEFITS_HERITAGE_TITLE),
      description: t(HomeMessages.BENEFITS_HERITAGE_DESC),
    },
  ];

  if (isLoading) {
    return <HomePageSkeleton />;
  }

  return (
    <div className="min-h-screen">
      <ProductQuickView
        product={quickViewProduct}
        open={quickViewProduct !== null}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
      />

      <TestimonialModal
        testimonial={selectedTestimonial}
        open={selectedTestimonial !== null}
        onClose={() => setSelectedTestimonial(null)}
      />

      {/* Hero Carousel */}
      <HeroCarousel slides={heroSlides} mobileSlides={mobileHeroSlides} />



      {/* Featured Products */}
      <section className="py-12 bg-background relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                <Leaf className="h-3 w-3" /> {t(HomeMessages.FEATURED_BADGE)}
              </div>
              <h2 className="text-4xl md:text-6xl font-bold font-playfair text-foreground">
                {t(ProductMessages.TITLE)}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-medium max-w-xl">
                {t(HomeMessages.FEATURED_DESC)}
              </p>
            </div>
            <Link to="/shop">
              <Button variant="outline" className="rounded-full px-8 py-6 border-foreground/20 hover:bg-foreground hover:text-background transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto">
                {t(ProductMessages.VIEW_ALL)}
              </Button>
            </Link>
          </div>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="group/scroll relative mx-4 sm:mx-6">
            <div
              ref={productsScrollRef}
              className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {featuredProducts.map((product) => (
                <div key={product.id} className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start">
                  <ProductCard
                    product={product}
                    onQuickView={setQuickViewProduct}
                  />
                </div>
              ))}
            </div>

            {/* Custom Scroll Controls - Premium */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                onClick={() => scroll(productsScrollRef, "left")}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                onClick={() => scroll(productsScrollRef, "right")}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
              <p className="text-muted-foreground text-lg italic font-light">
                {t(HomeMessages.FEATURED_NO_PRODUCTS)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Upcoming Events */}
      <section className="py-12 bg-[#FAF7F2] relative overflow-hidden">
        <div className="absolute top-0 right-0 p-24 opacity-5 pointer-events-none">
          <Heart className="h-96 w-96 text-[#B85C3C]" />
        </div>

        <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-foreground/5 text-foreground text-[10px] font-bold uppercase tracking-widest">
                <Sparkles className="h-3 w-3" /> {t(HomeMessages.EVENTS_BADGE)}
              </div>
              <h2 className="text-4xl md:text-6xl font-bold font-playfair text-foreground">
                {t(HomeMessages.EVENTS_TITLE)}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                {t(HomeMessages.EVENTS_DESC)}
              </p>
            </div>
            <Link to="/events">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                {t(EventMessages.VIEW_ALL)}
              </Button>
            </Link>
          </div>
        </div>

        {upcomingEvents.length > 0 ? (
          <div className="group/events-scroll relative z-10 mx-4 sm:mx-6">
            <div
              ref={eventsScrollRef}
              className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {upcomingEvents.map((event) => (
                <div key={event.id} className="flex-shrink-0 w-[300px] sm:w-[420px] snap-start">
                  <EventCard event={event} />
                </div>
              ))}
            </div>

            {/* Custom Scroll Controls - Premium */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/events-scroll:opacity-100 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                onClick={() => scroll(eventsScrollRef, "left")}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-xl bg-white/90 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/events-scroll:opacity-100 transition-all duration-500 hover:bg-[#B85C3C] hover:text-white"
                onClick={() => scroll(eventsScrollRef, "right")}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-[#2C1810]/10">
              <p className="text-muted-foreground text-lg italic font-light">
                {t(HomeMessages.EVENTS_NO_EVENTS)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Benefits of Cow */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10 space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
              <Milk className="h-3 w-3" /> {t(NavMessages.BRAND_SUBTITLE)}
            </div>
            <h2 className="text-4xl md:text-5xl font-bold font-playfair text-foreground">
              {t(HomeMessages.BENEFITS_TITLE)}
            </h2>
            <p className="text-muted-foreground text-base md:text-lg font-medium max-w-2xl mx-auto">
              {t(HomeMessages.BENEFITS_SUBTITLE)}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {benefits.map((benefit, index) => (
              <div
                key={index}
                className="group p-8 rounded-[2rem] bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-white hover:shadow-elevated transition-all duration-500 animate-in fade-in slide-in-from-bottom-4 flex flex-col items-center text-center"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="w-16 h-16 rounded-2xl bg-white shadow-soft flex items-center justify-center mb-6 group-hover:scale-110 group-hover:bg-primary group-hover:text-background transition-all duration-500 text-primary">
                  <benefit.icon className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-3 font-playfair">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground/80 font-light leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* What's New - Blogs */}
      <section className="py-12 bg-[#FAF7F2] relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                <Leaf className="h-3 w-3" /> {t(HomeMessages.WHATS_NEW_BADGE)}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-playfair text-foreground">
                {t(HomeMessages.WHATS_NEW_TITLE)}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                {t(HomeMessages.WHATS_NEW_DESC)}
              </p>
            </div>
            <Link to="/blog">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                {t(HomeMessages.WHATS_NEW_VIEW_ALL)}
              </Button>
            </Link>
          </div>
        </div>

        {latestBlogs.length > 0 ? (
          <div className="group/blogs-scroll relative mx-4 sm:mx-6">
            <div
              ref={blogsScrollRef}
              className="flex gap-8 overflow-x-auto scrollbar-hide pb-8 pt-4 snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {latestBlogs.slice(0, 10).map((blog) => (
                <div key={blog.id} className="flex-shrink-0 w-[300px] sm:w-[380px] snap-start">
                  <BlogCard blog={blog} />
                </div>
              ))}
            </div>

            {/* Custom Scroll Controls - Premium */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/blogs-scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                onClick={() => scroll(blogsScrollRef, "left")}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/blogs-scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                onClick={() => scroll(blogsScrollRef, "right")}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-20 bg-white/50 rounded-[3rem] border-2 border-dashed border-[#2C1810]/10">
              <p className="text-muted-foreground text-lg italic font-light">
                {t(HomeMessages.WHATS_NEW_NO_BLOGS)}
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Testimonials */}
      <section className="py-12 bg-white relative overflow-hidden">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest border border-primary/20">
                <MessageSquare className="h-3 w-3" /> {t(HomeMessages.TESTIMONIALS_BADGE)}
              </div>
              <h2 className="text-4xl md:text-5xl font-bold font-playfair text-foreground">
                {t(HomeMessages.TESTIMONIALS_TITLE)}
              </h2>
              <p className="text-muted-foreground text-base md:text-lg font-light max-w-xl">
                {t(HomeMessages.TESTIMONIALS_DESC)}
              </p>
            </div>
            <Link to="/about#feedback">
              <Button variant="outline" className="rounded-full px-8 py-6 border-[#2C1810]/20 hover:bg-[#2C1810] hover:text-white transition-all duration-500 font-bold uppercase tracking-widest text-xs h-auto bg-transparent">
                {t(HomeMessages.TESTIMONIALS_SHARE)}
              </Button>
            </Link>
          </div>
        </div>

        {testimonials.length > 0 ? (
          <div className="group/testimonials-scroll relative mx-4 sm:mx-6">
            <div
              ref={testimonialsScrollRef}
              className="flex gap-8 overflow-x-auto scrollbar-hide py-8 pt-4 snap-x snap-mandatory"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {testimonials.map((testimonial: Testimonial) => (
                <div key={testimonial.id} className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start">
                  <TestimonialCard
                    testimonial={testimonial}
                    onClick={() => setSelectedTestimonial(testimonial)}
                  />
                </div>
              ))}
            </div>

            {/* Custom Scroll Controls - Premium */}
            <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 flex justify-between pointer-events-none px-4">
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/testimonials-scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                onClick={() => scroll(testimonialsScrollRef, "left")}
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12 rounded-full shadow-elevated bg-white/95 backdrop-blur-sm border-none pointer-events-auto opacity-0 group-hover/testimonials-scroll:opacity-100 transition-all duration-500 hover:bg-primary hover:text-background"
                onClick={() => scroll(testimonialsScrollRef, "right")}
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="container mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-20 bg-muted/20 rounded-[3rem] border-2 border-dashed border-border/50">
              <p className="text-muted-foreground text-lg italic font-light">
                {t(HomeMessages.TESTIMONIALS_NO_TESTIMONIALS)}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default Index;
