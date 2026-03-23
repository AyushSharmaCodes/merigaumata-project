import { useState } from "react";
import { Star, MessageSquare, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Review } from "@/types";
import { reviewService } from "@/services/review.service";
import { toast } from "@/hooks/use-toast";
import { z } from "zod";
import { useAuthStore } from "@/store/authStore";
import AuthPage from "@/pages/Auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getErrorMessage, getFriendlyTitle } from "@/lib/errorUtils";

interface ProductReviewsProps {
  productId: string;
}

const reviewSchema = z.object({
  title: z
    .string()
    .trim()
    .min(5, "products.validation.titleMin")
    .max(100, "products.validation.titleMax"),
  comment: z
    .string()
    .trim()
    .min(10, "products.validation.commentMin")
    .max(1000, "products.validation.commentMax"),
  rating: z.number().min(1, "products.validation.ratingRequired").max(5),
});

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { t } = useTranslation();
  const { user, isAuthenticated } = useAuthStore();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [displayCount, setDisplayCount] = useState(5);
  const [formData, setFormData] = useState({
    title: "",
    comment: "",
  });

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: () => reviewService.getProductReviews(productId),
  });

  // Create review mutation
  const createReviewMutation = useMutation({
    mutationFn: reviewService.createReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      setFormData({ title: "", comment: "" });
      setRating(0);
      setShowForm(false);
      toast({
        title: t("products.messages.successTitle"),
        description: t("products.messages.successDesc"),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t("products.messages.errorTitle")),
        description: getErrorMessage(error, t("products.messages.errorDesc")),
        variant: "destructive",
      });
    },
  });

  const reviewsPerPage = 5;

  const averageRating =
    reviews.length > 0
      ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length
      : 0;

  const displayedReviews = reviews.slice(0, displayCount);
  const hasMoreReviews = reviews.length > displayCount;

  const loadMoreReviews = () => {
    setDisplayCount((prev) => prev + reviewsPerPage);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user?.name || user.name.trim() === "") {
      toast({
        title: t("products.messages.nameRequired"),
        description: t("products.messages.nameRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    if (!user?.email || user.email.trim() === "") {
      toast({
        title: t("products.messages.emailRequired"),
        description: t("products.messages.emailRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    try {
      const validatedData = reviewSchema.parse({
        ...formData,
        rating,
      });

      if (!user.id) {
        toast({
          title: t("products.messages.loginRequired"),
          description: t("products.messages.loginRequiredDesc"),
          variant: "destructive",
        });
        return;
      }

      createReviewMutation.mutate({
        productId,
        userId: user.id,
        rating: validatedData.rating,
        title: validatedData.title,
        comment: validatedData.comment,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          title: t("products.messages.errorTitle"),
          description: t(error.errors[0].message), /* Translate the error key from Zod schema */
          variant: "destructive",
        });
      }
    }
  };

  const ratingDistribution = [5, 4, 3, 2, 1].map((stars) => ({
    stars,
    count: reviews.filter((r) => r.rating === stars).length,
    percentage:
      reviews.length > 0
        ? (reviews.filter((r) => r.rating === stars).length / reviews.length) *
        100
        : 0,
  }));

  if (reviews.length === 0 && !showForm) {
    return (
      <div className="pt-8">
        <div className="text-center py-12 rounded-[2rem] border-2 border-dashed border-[#B85C3C]/10 bg-white/50">
          <h3 className="font-playfair text-2xl font-bold text-[#2C1810] mb-2">{t("products.noReviews")}</h3>
          <p className="text-xs text-muted-foreground font-medium mb-6">{t("products.beFirst")}</p>
          <Button
            onClick={() => isAuthenticated ? setShowForm(true) : setAuthDialogOpen(true)}
            className="rounded-full px-8 py-4 text-xs font-bold bg-[#B85C3C] hover:bg-[#2C1810] shadow-lg shadow-[#B85C3C]/10 h-auto transition-all"
          >
            {t("products.writeReview")}
          </Button>
        </div>
        <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      <Card className="border-none shadow-xl rounded-[2rem] overflow-hidden bg-white">
        <CardHeader className="p-8 pb-4">
          <CardTitle className="text-2xl font-bold text-[#2C1810] font-playfair">{t("products.reviews")}</CardTitle>
        </CardHeader>
        <CardContent className="p-8 pt-4 space-y-8">
          {/* Rating Summary */}
          {reviews.length > 0 && (
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
                  {t("products.basedOn")} {reviews.length} {reviews.length === 1 ? t("products.reviewsCountOne") : t("products.reviewsCountOther")}
                </p>
              </div>

              <div className="space-y-2">
                {ratingDistribution.map(({ stars, count, percentage }) => (
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
          )}

          {/* Write Review Button */}
          {!showForm && reviews.length > 0 && (
            <div className="flex justify-start">
              <Button
                onClick={() => isAuthenticated ? setShowForm(true) : setAuthDialogOpen(true)}
                variant="outline"
                className="rounded-full px-8 py-3 text-xs font-bold border-[#B85C3C]/20 text-[#B85C3C] hover:bg-[#FAF7F2] h-auto transition-all"
              >
                {t("products.shareExperience")}
              </Button>
            </div>
          )}

          {/* Review Form */}
          {showForm && (
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
                  <label htmlFor="title" className="text-[10px] font-bold uppercase tracking-widest text-[#B85C3C]">{t("contact.title")}</label>
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
                    {user?.name}
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
                  disabled={createReviewMutation.isPending}
                  className="rounded-full px-8 py-3 text-xs font-bold bg-[#B85C3C] hover:bg-[#2C1810] h-auto shadow-md"
                >
                  {createReviewMutation.isPending ? t("products.submitting") : t("products.submitReview")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowForm(false)}
                  className="rounded-full px-8 py-3 text-xs font-bold text-muted-foreground h-auto"
                >
                  {t("products.cancel")}
                </Button>
              </div>
            </form>
          )}

          {/* Reviews List */}
          {reviews.length > 0 && (
            <div className="space-y-6">
              <Separator className="bg-[#B85C3C]/5" />
              <div className="grid gap-6">
                {displayedReviews.map((review) => (
                  <div key={review.id} className="group animate-in fade-in duration-500">
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-xl bg-[#FAF7F2] border border-[#B85C3C]/5 flex items-center justify-center text-[#B85C3C] font-black text-xs flex-shrink-0">
                        {review.userAvatar ? (
                          <img src={review.userAvatar} alt={review.userName} className="h-full w-full rounded-xl object-cover" />
                        ) : (
                          review.userName.charAt(0).toUpperCase()
                        )}
                      </div>

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
                    <Separator className="mt-6 bg-[#B85C3C]/5 group-last:hidden" />
                  </div>
                ))}
              </div>

              {hasMoreReviews && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="ghost"
                    onClick={loadMoreReviews}
                    className="text-[10px] font-bold text-[#B85C3C] hover:bg-[#FAF7F2] rounded-full px-6"
                  >
                    {t("products.loadMore")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
      <AuthPage open={authDialogOpen} onOpenChange={setAuthDialogOpen} />
    </div>
  );
};
