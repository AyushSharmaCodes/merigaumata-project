import { ProductQuickView } from "@/features/products";
import { TestimonialModal } from "@/features/testimonials";
import { HomePageSkeleton } from "@/shared/components/ui/page-skeletons";
import { BenefitsSection } from "../components/BenefitsSection";
import { FeaturedProductsSection } from "../components/FeaturedProductsSection";
import { HeroCarousel } from "../components/HeroCarousel";
import { LatestBlogsSection } from "../components/LatestBlogsSection";
import { TestimonialsSection } from "../components/TestimonialsSection";
import { UpcomingEventsSection } from "../components/UpcomingEventsSection";
import { useHomePage } from "../hooks/useHomePage";

export function HomePage() {
  const {
    isLoading,
    quickViewProduct,
    setQuickViewProduct,
    selectedTestimonial,
    setSelectedTestimonial,
    featuredProducts,
    upcomingEvents,
    latestBlogs,
    testimonials,
    heroSlides,
    mobileHeroSlides,
    productsScrollRef,
    eventsScrollRef,
    blogsScrollRef,
    testimonialsScrollRef,
    scroll,
    benefits,
  } = useHomePage();

  if (isLoading) return <HomePageSkeleton />;

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

      <HeroCarousel slides={heroSlides} mobileSlides={mobileHeroSlides} />

      <FeaturedProductsSection
        products={featuredProducts}
        scrollRef={productsScrollRef}
        onScroll={(dir) => scroll(productsScrollRef, dir)}
        onQuickView={setQuickViewProduct}
      />

      <UpcomingEventsSection
        events={upcomingEvents}
        scrollRef={eventsScrollRef}
        onScroll={(dir) => scroll(eventsScrollRef, dir)}
      />

      <BenefitsSection benefits={benefits} />

      <LatestBlogsSection
        blogs={latestBlogs}
        scrollRef={blogsScrollRef}
        onScroll={(dir) => scroll(blogsScrollRef, dir)}
      />

      <TestimonialsSection
        testimonials={testimonials}
        scrollRef={testimonialsScrollRef}
        onScroll={(dir) => scroll(testimonialsScrollRef, dir)}
        onSelect={setSelectedTestimonial}
      />
    </div>
  );
}
