import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getCarouselSlides } from "@/lib/services/carousel.service";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroCarouselSlide } from "@/types";

interface HeroCarouselProps {
  slides?: HeroCarouselSlide[];
}

export const HeroCarousel = ({ slides: prefetchedSlides }: HeroCarouselProps) => {
  const { t, i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  // Fetch carousel slides from Backend
  const { data: fetchedSlides = [] } = useQuery({
    queryKey: ["carousel-slides", i18n.language],
    queryFn: getCarouselSlides,
    enabled: !prefetchedSlides || prefetchedSlides.length === 0,
  });

  const slides = prefetchedSlides && prefetchedSlides.length > 0
    ? prefetchedSlides
    : fetchedSlides;

  const handleNext = useCallback(() => {
    if (slides.length > 0) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }
  }, [slides.length]);

  const handlePrev = useCallback(() => {
    if (slides.length > 0) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
  }, [slides.length]);

  useEffect(() => {
    if (slides.length > 0 && !isPaused) {
      const timer = setInterval(() => {
        handleNext();
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [slides.length, isPaused, handleNext]);

  // Swipe handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const handleTouchEnd = () => {
    if (!touchStartX.current || !touchEndX.current) return;
    const diff = touchStartX.current - touchEndX.current;
    const threshold = 50;

    if (Math.abs(diff) > threshold) {
      if (diff > 0) {
        handleNext(); // Swipe left
      } else {
        handlePrev(); // Swipe right
      }
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  if (slides.length === 0) {
    return null;
  }

  return (
    <div
      className="relative h-[500px] md:h-[600px] overflow-hidden group"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, index) => {
        const slideHasContent = slide.title || slide.subtitle;

        return (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
              }`}
          >
            <img
              src={slide.image}
              alt={slide.title || "Hero carousel slide"}
              loading="eager"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-black/20" />

            {slideHasContent ? (
              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-4 sm:px-6 lg:px-8">
                  <div className="max-w-2xl animate-fade-in">
                    {slide.title && (
                      <h1 className="text-4xl md:text-6xl font-bold mb-4 text-white">
                        {slide.title}
                      </h1>
                    )}
                    {slide.subtitle && (
                      <p className="text-xl md:text-2xl mb-8 text-white/90">
                        {slide.subtitle}
                      </p>
                    )}
                    <div className="flex flex-col sm:flex-row gap-4">
                      <Button
                        asChild
                        variant="hero"
                        size="lg"
                        className="w-full sm:w-auto"
                      >
                        <Link to="/shop">
                          {t("hero.exploreProducts")}
                        </Link>
                      </Button>
                      <Button
                        asChild
                        variant="donate"
                        size="lg"
                        className="w-full sm:w-auto"
                      >
                        <Link to="/donate">
                          {t("hero.donate")}
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="absolute inset-0 flex items-end justify-center pb-16">
                <div className="animate-fade-in">
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button
                      asChild
                      variant="hero"
                      size="lg"
                      className="w-full sm:w-auto min-w-[200px]"
                    >
                      <Link to="/shop">
                        {t("hero.exploreProducts")}
                      </Link>
                    </Button>
                    <Button
                      asChild
                      variant="donate"
                      size="lg"
                      className="w-full sm:w-auto min-w-[200px]"
                    >
                      <Link to="/donate">
                        {t("hero.donate")}
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Manual Controls - Arrows */}
      {slides.length > 1 && (
        <>
          <button
            onClick={handlePrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/20 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/40 hidden md:flex"
            aria-label={t("hero.aria.previous", "Previous slide")}
          >
            <ChevronLeft className="h-8 w-8" />
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-2 rounded-full bg-black/20 text-white backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-all hover:bg-black/40 hidden md:flex"
            aria-label={t("hero.aria.next", "Next slide")}
          >
            <ChevronRight className="h-8 w-8" />
          </button>
        </>
      )}

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex space-x-2 z-30">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${index === currentSlide
              ? "bg-white w-8"
              : "bg-white/50 hover:bg-white/75"
              }`}
            aria-label={t("hero.aria.goToSlide", { index: index + 1, defaultValue: `Go to slide ${index + 1}` })}
          />
        ))}
      </div>
    </div>
  );
};
