import { useEffect, useState, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { getLocalizedContent } from "@/utils/localizationUtils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { HeroCarouselSlide } from "@/types";
const heroCowsImage = "/assets/hero-cows.jpg";

interface HeroCarouselProps {
  slides?: HeroCarouselSlide[];
  mobileSlides?: HeroCarouselSlide[];
}

export const HeroCarousel = ({ slides: prefetchedSlides, mobileSlides: prefetchedMobileSlides }: HeroCarouselProps) => {
  const { t, i18n } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const slides = prefetchedSlides || [];
  const mobileSlides = prefetchedMobileSlides && prefetchedMobileSlides.length > 0 
    ? prefetchedMobileSlides 
    : slides;

  // Pick a random slide for mobile once slides are available
  const [randomMobileIndex, setRandomMobileIndex] = useState<number | null>(null);

  useEffect(() => {
    if (mobileSlides.length > 0 && randomMobileIndex === null) {
      setRandomMobileIndex(Math.floor(Math.random() * mobileSlides.length));
    }
  }, [mobileSlides.length, randomMobileIndex]);

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

  // Mobile specific slide data
  const actualMobileIndex = randomMobileIndex ?? 0;
  const currentMobileSlide = mobileSlides[actualMobileIndex] || slides[0] || { image: heroCowsImage };
  const mobileTitle = getLocalizedContent(currentMobileSlide, i18n.language, 'title');
  const mobileSubtitle = getLocalizedContent(currentMobileSlide, i18n.language, 'subtitle');

  return (
    <>
      {/* Mobile Hero - Single Random Image, Rotating on Refresh */}
      <section className="sm:hidden relative h-[100dvh] w-full overflow-hidden">
        <div className="absolute inset-0">
          <img
            src={currentMobileSlide.image}
            alt={mobileTitle || "Hero banner"}
            loading="eager"
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-transparent to-black/80" />

          <div className="relative z-10 flex h-full flex-col justify-end p-8 pb-16">
            {(mobileTitle || mobileSubtitle) && (
              <div className="mb-8">
                {mobileTitle && (
                  <h1 className="text-3xl font-bold leading-tight text-white font-playfair italic underline decoration-primary/30 underline-offset-8">
                    {mobileTitle}
                  </h1>
                )}
                {mobileSubtitle && (
                  <p className="mt-4 text-sm leading-relaxed text-white/90 font-light max-w-sm drop-shadow-md">
                    {mobileSubtitle}
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Button asChild variant="hero" size="lg" className="w-full h-20 text-xl font-bold shadow-2xl rounded-2xl">
                <Link to="/shop">{t("hero.exploreProducts")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Desktop/Tablet Hero - Full Screen & Premium */}
      <div
        className="relative hidden sm:block h-screen overflow-hidden group"
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {slides.map((slide, index) => {
          const title = getLocalizedContent(slide, i18n.language, 'title');
          const subtitle = getLocalizedContent(slide, i18n.language, 'subtitle');
          const slideHasContent = !!(title || subtitle);

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${index === currentSlide ? "opacity-100 z-10" : "opacity-0 pointer-events-none"
                }`}
            >
              <div className="w-full h-full bg-[#1A1A1A]">
                <img
                  src={slide.image}
                  alt={title || "Hero banner"}
                  loading="eager"
                  className="w-full h-full object-cover"
                />
              </div>
              
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-black/30 md:bg-gradient-to-r md:from-black/70 md:to-transparent" />

              <div className="absolute inset-0 flex items-center">
                <div className="container mx-auto px-6 sm:px-12 lg:px-20">
                  <div className={`max-w-3xl transition-all duration-700 ${index === currentSlide ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"}`}>
                    {slideHasContent && (
                      <>
                        {title && (
                          <h1 className="text-4xl md:text-5xl lg:text-7xl font-bold mb-6 text-white font-playfair leading-tight drop-shadow-xl">
                            {title}
                          </h1>
                        )}
                        {subtitle && (
                          <p className="text-lg md:text-xl lg:text-2xl mb-10 text-white/90 font-light max-w-2xl leading-relaxed drop-shadow-lg">
                            {subtitle}
                          </p>
                        )}
                        <div className="flex flex-col sm:flex-row gap-4">
                          <Button asChild variant="hero" size="lg" className="w-full sm:w-auto min-w-[200px] h-14 text-lg">
                            <Link to="/shop">{t("hero.exploreProducts")}</Link>
                          </Button>
                          <Button
                            asChild
                            size="lg"
                            className="w-full sm:w-auto min-w-[200px] h-14 text-lg bg-[#FFB800] hover:bg-[#E6A600] text-black font-bold shadow-[0_0_20px_rgba(255,184,0,0.3)] transition-all"
                          >
                            <Link to="/donate">{t("hero.donate")}</Link>
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {!slideHasContent && (
                <div className="absolute inset-x-0 bottom-28 md:bottom-32 flex justify-center px-6 z-20">
                  <div className={`transition-all duration-700 ${index === currentSlide ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}>
                    <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                      <Button asChild variant="hero" size="lg" className="w-full sm:w-auto min-w-[220px] h-14 text-lg shadow-2xl">
                        <Link to="/shop">{t("hero.exploreProducts")}</Link>
                      </Button>
                      <Button
                        asChild
                        size="lg"
                        className="w-full sm:w-auto min-w-[220px] h-14 text-lg bg-[#FFB800] hover:bg-[#E6A600] text-black font-bold shadow-[0_0_20px_rgba(255,184,0,0.3)] transition-all shadow-2xl"
                      >
                        <Link to="/donate">{t("hero.donate")}</Link>
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

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
    </>
  );
};
