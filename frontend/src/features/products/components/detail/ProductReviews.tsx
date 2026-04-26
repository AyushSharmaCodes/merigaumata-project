import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { Button } from "@/shared/components/ui/button";
import { Separator } from "@/shared/components/ui/separator";
import { useAuthStore } from "@/domains/auth";
import AuthPage from "@/pages/Auth";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useProductReviews } from "@/domains/product";
import { ReviewSummary } from "./reviews/ReviewSummary";
import { ReviewForm } from "./reviews/ReviewForm";
import { ReviewItem } from "./reviews/ReviewItem";

interface ProductReviewsProps {
  productId: string;
}

export const ProductReviews = ({ productId }: ProductReviewsProps) => {
  const { user, isAuthenticated } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);

  const {
    reviews,
    summary,
    isLoading,
    isError,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    createReview,
    isCreating,
    t,
  } = useProductReviews({ productId });

  const handleWriteReviewClick = () => {
    if (isAuthenticated) {
      setShowForm(true);
    } else {
      setAuthDialogOpen(true);
    }
  };

  const handleReviewSubmit = (data: { title: string; comment: string; rating: number }) => {
    if (!user?.id || !user?.name || !user?.email) {
      toast({
        title: t("products.messages.loginRequired"),
        description: t("products.messages.loginRequiredDesc"),
        variant: "destructive",
      });
      return;
    }

    createReview(
      {
        productId,
        userId: user.id,
        rating: data.rating,
        title: data.title,
        comment: data.comment,
      },
      {
        onSuccess: () => setShowForm(false),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="pt-8">
        <div className="text-center py-12 rounded-[2rem] border border-[#B85C3C]/10 bg-white/50">
          <p className="text-sm text-muted-foreground">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="pt-8">
        <div className="text-center py-12 rounded-[2rem] border border-destructive/20 bg-destructive/5">
          <h3 className="font-playfair text-2xl font-bold text-[#2C1810] mb-2">{t("products.reviews")}</h3>
          <p className="text-sm text-muted-foreground">
            {getErrorMessage(error, t, "products.messages.errorDesc")}
          </p>
        </div>
      </div>
    );
  }

  if (reviews.length === 0 && !showForm) {
    return (
      <div className="pt-8">
        <div className="text-center py-12 rounded-[2rem] border-2 border-dashed border-[#B85C3C]/10 bg-white/50">
          <h3 className="font-playfair text-2xl font-bold text-[#2C1810] mb-2">{t("products.noReviews")}</h3>
          <p className="text-xs text-muted-foreground font-medium mb-6">{t("products.beFirst")}</p>
          <Button
            onClick={handleWriteReviewClick}
            disabled={isCreating}
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
          {summary && reviews.length > 0 && <ReviewSummary summary={summary} />}

          {!showForm && reviews.length > 0 && (
            <div className="flex justify-start">
              <Button
                onClick={handleWriteReviewClick}
                variant="outline"
                disabled={isCreating}
                className="rounded-full px-8 py-3 text-xs font-bold border-[#B85C3C]/20 text-[#B85C3C] hover:bg-[#FAF7F2] h-auto transition-all"
              >
                {t("products.shareExperience")}
              </Button>
            </div>
          )}

          {showForm && (
            <ReviewForm
              userName={user?.name || ""}
              isSubmitting={isCreating}
              onSubmit={handleReviewSubmit}
              onCancel={() => setShowForm(false)}
            />
          )}

          {reviews.length > 0 && (
            <div className="space-y-6">
              <Separator className="bg-[#B85C3C]/5" />
              <div className="grid gap-6">
                {reviews.map((review, index) => (
                  <ReviewItem
                    key={review.id}
                    review={review}
                    isLast={index === reviews.length - 1}
                  />
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button
                    variant="ghost"
                    onClick={() => fetchNextPage()}
                    disabled={isFetchingNextPage}
                    className="text-[10px] font-bold text-[#B85C3C] hover:bg-[#FAF7F2] rounded-full px-6"
                  >
                    {isFetchingNextPage ? t("common.loading") : t("products.loadMore")}
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
