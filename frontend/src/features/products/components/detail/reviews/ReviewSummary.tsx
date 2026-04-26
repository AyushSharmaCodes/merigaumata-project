import { Star } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ReviewSummaryProps {
  summary: {
    averageRating: number;
    totalReviews: number;
    ratingDistribution: Array<{
      stars: number;
      count: number;
      percentage: number;
    }>;
  };
}

export const ReviewSummary = ({ summary }: ReviewSummaryProps) => {
  const { t } = useTranslation();
  const averageRating = summary.averageRating || 0;

  const distribution = summary.ratingDistribution || [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: 0,
    percentage: 0,
  }));

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-[#FAF7F2]/50 p-6 rounded-2xl border border-[#B85C3C]/5">
      <div className="text-center md:text-left space-y-1">
        <div className="text-5xl font-black text-[#2C1810]">
          {averageRating.toFixed(1)}
        </div>
        <div className="flex items-center justify-center md:justify-start gap-1">
          {[...Array(5)].map((_, i) => (
            <Star
              key={i}
              size={20}
              className={i < Math.floor(averageRating) ? "fill-[#D4AF37] text-[#D4AF37]" : "text-[#D4AF37]/20"}
            />
          ))}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">
          {t("products.basedOn")} {summary.totalReviews || 0} {(summary.totalReviews || 0) === 1 ? t("products.reviewsCountOne") : t("products.reviewsCountOther")}
        </p>
      </div>

      <div className="space-y-2">
        {distribution.map(({ stars, count, percentage }) => (
          <div key={stars} className="flex items-center gap-3">
            <span className="text-[9px] font-bold w-8 text-muted-foreground uppercase">{stars} {t("products.starsShort")}</span>
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-[#B85C3C] rounded-full transition-all duration-500"
                style={{ width: `${percentage}%` }}
              />
            </div>
            <span className="text-[9px] font-bold text-muted-foreground w-4 text-right">
              {count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
