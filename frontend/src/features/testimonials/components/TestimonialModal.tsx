import { Testimonial } from "@/shared/types";
import { useTranslation } from "react-i18next";
import { getLocalizedContent } from "@/core/utils/localizationUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/shared/components/ui/dialog";
import { getUserInitials } from "@/core/utils/user-display";

interface TestimonialModalProps {
  testimonial: Testimonial | null;
  open: boolean;
  onClose: () => void;
}

// Reusable Star Rating Component
export function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`h-5 w-5 ${i < rating ? "text-accent fill-accent" : "text-muted fill-muted"
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

// Reusable User Avatar Component
export function UserAvatar({
  name,
  image,
  size = "md",
}: {
  name: string;
  image?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClasses = {
    sm: "w-12 h-12 text-lg",
    md: "w-16 h-16 text-2xl",
    lg: "w-20 h-20 text-3xl",
  };

  if (image) {
    return (
      <img
        src={image}
        alt={name}
        loading="lazy"
        className={`${sizeClasses[size]
          .split(" ")
          .slice(0, 2)
          .join(" ")} rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses[size]
        .split(" ")
        .slice(0, 2)
        .join(
          " "
        )} rounded-full bg-primary/10 flex items-center justify-center`}
    >
      <span
        className={`text-primary font-semibold ${sizeClasses[size].split(" ")[2]
          }`}
      >
        {getUserInitials({ name })}
      </span>
    </div>
  );
}

export function TestimonialModal({
  testimonial,
  open,
  onClose,
}: TestimonialModalProps) {
  const { t, i18n } = useTranslation();
  if (!testimonial) return null;

  const name = getLocalizedContent(testimonial, i18n.language, 'name');
  const role = getLocalizedContent(testimonial, i18n.language, 'role');
  const content = getLocalizedContent(testimonial, i18n.language, 'content');

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-2xl max-h-[85vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="sr-only">{t("nav.testimonialDetails")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("nav.fullTestimonialFrom", { name })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* User Info */}
          <div className="flex items-center gap-4">
            <UserAvatar
              name={name}
              image={testimonial.image}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-foreground text-xl break-words">
                {name}
              </h3>
              {role && (
                <p className="text-sm text-muted-foreground break-words">
                  {role}
                </p>
              )}
            </div>
          </div>

          {/* Star Rating */}
          <StarRating rating={testimonial.rating} />

          {/* Full Testimonial Content */}
          <div className="text-foreground leading-relaxed text-base break-words whitespace-pre-wrap">
            <p>&ldquo;{content}&rdquo;</p>
          </div>

          {/* Date */}
          {(testimonial.created_at || testimonial.createdAt) && (
            <p className="text-xs text-muted-foreground">
              {t("nav.postedOn")}{" "}
              {new Date(testimonial.created_at || testimonial.createdAt || "").toLocaleDateString(i18n.language, {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
