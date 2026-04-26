import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { reviewService } from "../api/review.api";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage, getFriendlyTitle } from "@/core/utils/errorUtils";

interface UseProductReviewsProps {
  productId: string;
  reviewsPerPage?: number;
}

export const useProductReviews = ({ productId, reviewsPerPage = 5 }: UseProductReviewsProps) => {
  const { t, i18n } = useTranslation();
  const queryClient = useQueryClient();

  const reviewsQuery = useInfiniteQuery({
    queryKey: ["reviews", productId, i18n.language],
    queryFn: ({ pageParam = 1 }) => 
      reviewService.getProductReviews({ productId, page: pageParam, limit: reviewsPerPage }),
    getNextPageParam: (lastPage) => 
      lastPage.page < lastPage.totalPages ? lastPage.page + 1 : undefined,
    initialPageParam: 1,
    enabled: !!productId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId),
  });

  const createReviewMutation = useMutation({
    mutationFn: reviewService.createReview,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews", productId] });
      queryClient.invalidateQueries({ queryKey: ["product", productId] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast({
        title: t("products.messages.successTitle"),
        description: t("products.messages.successDesc"),
      });
    },
    onError: (error: unknown) => {
      toast({
        title: getFriendlyTitle(error, t),
        description: getErrorMessage(error, t, "products.messages.errorDesc"),
        variant: "destructive",
      });
    },
  });

  const reviews = reviewsQuery.data?.pages.flatMap((page) => page.reviews) || [];
  const summary = reviewsQuery.data?.pages[0]?.summary;

  return {
    reviews,
    summary,
    isLoading: reviewsQuery.isLoading,
    isError: reviewsQuery.isError,
    error: reviewsQuery.error,
    fetchNextPage: reviewsQuery.fetchNextPage,
    hasNextPage: reviewsQuery.hasNextPage,
    isFetchingNextPage: reviewsQuery.isFetchingNextPage,
    createReview: createReviewMutation.mutate,
    isCreating: createReviewMutation.isPending,
    t,
  };
};
