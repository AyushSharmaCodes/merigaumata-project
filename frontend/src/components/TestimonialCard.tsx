import { memo } from "react";
import { Testimonial } from "@/types";
import { UserAvatar } from "./TestimonialModal";
import { useTranslation } from "react-i18next";
import { getLocalizedContent } from "@/utils/localizationUtils";

interface TestimonialCardProps {
  testimonial: Testimonial;
  onClick: () => void;
}

// Reusable compact star rating for cards
function CompactStarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1.5">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`h-4.5 w-4.5 ${i < rating ? "text-[#D4AF37] fill-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.2)]" : "text-[#D4AF37]/20 fill-[#D4AF37]/10"
            }`}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      ))}
    </div>
  );
}

export const TestimonialCard = memo(({
  testimonial,
  onClick,
}: TestimonialCardProps) => {
  const { t, i18n } = useTranslation();
  const name = getLocalizedContent(testimonial, i18n.language, 'name');
  const role = getLocalizedContent(testimonial, i18n.language, 'role');
  const content = getLocalizedContent(testimonial, i18n.language, 'content');

  return (
    <div
      className="flex-shrink-0 w-full bg-[#FAF7F2] p-8 rounded-[2rem] border border-transparent hover:border-[#B85C3C]/20 hover:bg-white hover:shadow-elevated transition-all duration-500 cursor-pointer flex flex-col group h-full"
      onClick={onClick}
    >
      <div className="flex items-center gap-4 mb-6">
        <UserAvatar
          name={name}
          image={testimonial.image}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-[#2C1810] font-playfair truncate group-hover:text-[#B85C3C] transition-colors">
            {name}
          </h3>
          {role && (
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest truncate">
              {role}
            </p>
          )}
        </div>
      </div>
      <div className="mb-4">
        <CompactStarRating rating={testimonial.rating} />
      </div>
      <p className="text-sm text-muted-foreground/80 font-light leading-relaxed break-words line-clamp-5 italic flex-1 overflow-hidden">
        &ldquo;{content}&rdquo;
      </p>

      <div className="mt-6 pt-4 border-t border-[#2C1810]/5 flex items-center gap-2 text-[10px] font-bold text-[#B85C3C] tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
        {t("index.testimonials.readStory")}
      </div>
    </div>
  );
});

TestimonialCard.displayName = "TestimonialCard";
