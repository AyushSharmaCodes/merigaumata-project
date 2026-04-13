import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { reviewService } from "@/services/review.service";
import { Review } from "@/types";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, Search, Star } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import { useTranslation } from "react-i18next";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";
export default function ReviewsManagement() {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const limit = 10;

    const { data, isLoading, isError, error, isFetching } = useQuery({
        queryKey: ["all-reviews", page, searchTerm],
        queryFn: () => reviewService.getAllReviews(page, limit, searchTerm.trim()),
    });

    const reviews = data?.reviews || [];
    const totalPages = data?.totalPages || 1;

    useRealtimeInvalidation(
        ["reviews"],
        [["all-reviews"], ["products"], ["product"]],
    );

    const deleteMutation = useMutation({
        mutationFn: reviewService.deleteReview,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["all-reviews"] });
            queryClient.invalidateQueries({ queryKey: ["products"] });
            queryClient.invalidateQueries({ queryKey: ["product"] });
            if (reviews.length === 1 && page > 1) {
                setPage((current) => Math.max(1, current - 1));
            }
            toast({
                title: t("common.success"),
                description: t("admin.reviews.delete.success"),
            });
            setDeleteId(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.reviews.delete.error"),
                variant: "destructive",
            });
        },
    });

    if (isLoading) {
        return <div>{t("admin.reviews.loading") || "Loading reviews..."}</div>;
    }

    if (isError) {
        return (
            <div className="space-y-4">
                <h2 className="text-3xl font-bold tracking-tight">{t("admin.reviews.title")}</h2>
                <div className="rounded-md border border-destructive/20 bg-destructive/5 p-6 text-sm text-muted-foreground">
                    {getErrorMessage(error, t, "admin.reviews.loading")}
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <h2 className="text-3xl font-bold tracking-tight">{t("admin.reviews.title")}</h2>
            </div>

            <div className="flex items-center gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        id="review-search"
                        name="search"
                        placeholder={t("admin.reviews.search")}
                        value={searchTerm}
                        onChange={(e) => {
                            setSearchTerm(e.target.value);
                            setPage(1);
                        }}
                        className="pl-8"
                    />
                </div>
                {isFetching && (
                    <span className="text-sm text-muted-foreground">{t("common.loading")}</span>
                )}
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("admin.reviews.table.product")}</TableHead>
                            <TableHead>{t("admin.reviews.table.user")}</TableHead>
                            <TableHead>{t("admin.reviews.table.rating")}</TableHead>
                            <TableHead>{t("admin.reviews.table.review")}</TableHead>
                            <TableHead>{t("admin.reviews.table.date")}</TableHead>
                            <TableHead className="text-right">{t("admin.reviews.table.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {reviews.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8">
                                    {t("admin.reviews.empty")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            reviews.map((review: Review) => (
                                <TableRow key={review.id}>
                                    <TableCell className="font-medium">
                                        {review.productName || t("admin.reviews.table.unknownProduct")}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span>{review.userName}</span>
                                            {review.verified && (
                                                <Badge variant="secondary" className="w-fit text-[10px] px-1 py-0">{t("admin.reviews.table.verified")}</Badge>
                                            )}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1.5 bg-[#D4AF37]/5 px-2 py-1 rounded-md border border-[#D4AF37]/10">
                                            <Star className="h-4 w-4 fill-[#D4AF37] text-[#D4AF37] drop-shadow-[0_0_4px_rgba(212,175,55,0.2)]" />
                                            <span className="font-bold text-[#2C1810]">{review.rating}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="max-w-md">
                                        <div className="font-medium truncate">{review.title}</div>
                                        <div className="text-sm text-muted-foreground truncate">
                                            {review.comment}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {new Date(review.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            onClick={() => setDeleteId(review.id)}
                                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center justify-end space-x-2 py-4">
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                >
                    {t("admin.reviews.pagination.previous")}
                </Button>
                <div className="text-sm font-medium">
                    {t("admin.reviews.pagination.pageInfo", { current: page, total: totalPages })}
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                >
                    {t("admin.reviews.pagination.next")}
                </Button>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.reviews.delete.title")}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {t("admin.reviews.delete.description")}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("admin.reviews.delete.cancel")}</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => deleteId && deleteMutation.mutate(deleteId)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {t("admin.reviews.delete.confirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
