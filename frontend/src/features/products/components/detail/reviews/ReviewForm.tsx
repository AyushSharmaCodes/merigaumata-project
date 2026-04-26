import { useState } from "react";
import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Textarea } from "@/shared/components/ui/textarea";
import { toast } from "@/shared/hooks/use-toast";
import { z } from "zod";
import { reviewSchema } from "@/domains/product/model/review.types";

interface ReviewFormProps {
  userName: string;
  isSubmitting: boolean;
  onSubmit: (data: { title: string; comment: string; rating: number }) => void;
  onCancel: () => void;
}

export const ReviewForm = ({ userName, isSubmitting, onSubmit, onCancel }: ReviewFormProps) => {
  const { t } = useTranslation();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [formData, setFormData] = useState({
    title: "",
    comment: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const validatedData = reviewSchema.parse({
        ...formData,
        rating,
      });

      onSubmit(validatedData);
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("products.messages.errorTitle"),
          description: t(error.errors[0].message),
          variant: "destructive",
        });
      }
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 p-8 rounded-2xl bg-[#FAF7F2] border border-[#B85C3C]/10 animate-in zoom-in-95 duration-300"
    >
      <div className="space-y-1">
        <h3 className="text-xl font-bold text-[#2C1810] font-playfair">{t("products.writeReview")}</h3>
        <p className="text-[10px] text-muted-foreground uppercase font-bold">{t("products.honorsTradition")}</p>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-all hover:scale-125 active:scale-95"
            >
              <Star
                size={32}
                strokeWidth={1.5}
                className={star <= (hoveredRating || rating)
                  ? "fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_8px_rgba(212,175,55,0.3)]"
                  : "text-[#D4AF37]/30 hover:text-[#D4AF37]/50"
                }
              />
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">{t("products.reviewTitle")}</label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder={t("products.titlePlaceholder")}
            className="bg-white rounded-xl border-none shadow-sm h-10 text-sm"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">{t("products.postingAs")}</label>
          <div className="h-10 flex items-center px-4 bg-white/50 rounded-xl border border-dashed border-[#B85C3C]/20 text-xs font-bold text-[#2C1810]">
            {userName}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="comment" className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">{t("products.comment")}</label>
        <Textarea
          id="comment"
          value={formData.comment}
          onChange={(e) => setFormData({ ...formData, comment: e.target.value })}
          placeholder={t("products.commentPlaceholder")}
          className="bg-white rounded-xl border-none shadow-sm p-4 min-h-[100px] text-sm resize-none"
          required
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="rounded-full px-8 py-3 text-xs font-bold bg-[#B85C3C] hover:bg-[#2C1810] h-auto shadow-md"
        >
          {isSubmitting ? t("products.submitting") : t("products.submitReview")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={isSubmitting}
          onClick={onCancel}
          className="rounded-full px-8 py-3 text-xs font-bold text-muted-foreground h-auto"
        >
          {t("products.cancel")}
        </Button>
      </div>
    </form>
  );
};
