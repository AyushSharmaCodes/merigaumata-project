import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewService } from "@/domains/product";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { useTranslation } from "react-i18next";

export const useReviewsManagement = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ["all-reviews", page, searchTerm],
        queryFn: () => reviewService.getAllReviews({ page, limit, search: searchTerm.trim() }),
    });

    const reviews = data?.reviews || [];
    const totalPages = data?.totalPages || 1;

    const deleteMutation = useMutation({
        mutationFn: reviewService.deleteReview,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product"] });
            if (reviews.length === 1 && page > 1) {
                setPage((current) => Math.max(1, current - 1));
            }
            toast({ title: t("common.success"), description: t("admin.reviews.delete.success") });
            setDeleteId(null);
        },
        onError: (err) => toast({ title: t("common.error"), description: getErrorMessage(err), variant: "destructive" }),
    });

    return {
        t,
        searchTerm, setSearchTerm,
        deleteId, setDeleteId,
        page, setPage,
        reviews,
        totalPages,
        isLoading,
        isError,
        error,
        isFetching,
        deleteMutation,
    };
};
