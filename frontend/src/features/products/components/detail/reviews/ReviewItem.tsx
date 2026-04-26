import { Star } from "lucide-react";
import { Separator } from "@/shared/components/ui/separator";
import { UserAvatar } from "@/shared/components/ui/user-avatar";
import { Review } from "@/shared/types";

interface ReviewItemProps {
  review: Review;
  isLast?: boolean;
}

export const ReviewItem = ({ review, isLast }: ReviewItemProps) => {
  return (
    <div className="group animate-in fade-in duration-500">
      <div className="flex gap-4">
        <UserAvatar
          name={review.userName}
          imageUrl={review.userAvatar}
          className="h-10 w-10 rounded-xl border border-[#B85C3C]/5 flex-shrink-0"
          fallbackClassName="rounded-xl bg-[#FAF7F2] text-[#B85C3C] font-black text-xs"
        />

        <div className="flex-1 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#2C1810] text-xs">{review.userName}</span>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={12}
                    className={i < review.rating ? "fill-[#D4AF37] text-[#D4AF37]" : "text-[#D4AF37]/20"}
                  />
                ))}
              </div>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">
              {new Date(review.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>

          <div className="space-y-1">
            <h4 className="text-sm font-bold text-[#2C1810] font-playfair">{review.title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed font-light">{review.comment}</p>
          </div>
        </div>
      </div>
      {!isLast && <Separator className="mt-6 bg-[#B85C3C]/5" />}
    </div>
  );
};
