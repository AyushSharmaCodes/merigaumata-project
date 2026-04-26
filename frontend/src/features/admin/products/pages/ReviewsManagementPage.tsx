import { useReviewsManagement, ReviewTable } from "@/features/admin/products";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Search, MessageSquare } from "lucide-react";
import { AdminTableSkeleton, Skeleton } from "@/shared/components/ui/page-skeletons";
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card";
import { getErrorMessage } from "@/core/utils/errorUtils";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/shared/components/ui/alert-dialog";

export default function ReviewsManagement() {
    const {
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
    } = useReviewsManagement();

    if (isLoading) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between"><Skeleton className="h-10 w-48" /></div>
                <div className="flex items-center gap-4"><Skeleton className="h-10 w-full max-w-sm" /></div>
                <AdminTableSkeleton columns={6} />
            </div>
        );
    }

    if (isError) {
        return (
            <div className="space-y-4">
                <div className="flex items-center gap-2"><MessageSquare className="h-6 w-6 text-destructive" /><h2 className="text-3xl font-bold tracking-tight">{t("admin.reviews.title")}</h2></div>
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-8 text-center">
                    <p className="text-destructive font-medium mb-2">{t("common.error")}</p>
                    <p className="text-sm text-muted-foreground">{getErrorMessage(error)}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">{t("admin.reviews.title")}</h2>
                    <p className="text-muted-foreground">{t("admin.reviews.subtitle") || "Moderate and manage customer feedback for products"}</p>
                </div>
            </div>

            <Card className="border-none shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <MessageSquare className="h-5 w-5 text-primary" />
                            {t("admin.reviews.allReviews") || "Customer Reviews"}
                        </CardTitle>
                        <div className="flex items-center gap-4">
                            <div className="relative flex-1 max-w-sm min-w-[280px]">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="review-search"
                                    placeholder={t("admin.reviews.search")}
                                    value={searchTerm}
                                    onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
                                    className="pl-9 h-10 border-muted-foreground/20 focus:border-primary transition-all shadow-none"
                                />
                                {isFetching && <div className="absolute right-3 top-1/2 transform -translate-y-1/2"><div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>}
                            </div>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <ReviewTable reviews={reviews} onDelete={(id) => setDeleteId(id)} />
                </CardContent>
            </Card>

            <div className="flex items-center justify-end space-x-2 py-4">
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>{t("admin.reviews.pagination.previous")}</Button>
                <div className="text-sm font-medium">{t("admin.reviews.pagination.pageInfo", { current: page, total: totalPages })}</div>
                <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>{t("admin.reviews.pagination.next")}</Button>
            </div>

            <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>{t("admin.reviews.delete.title")}</AlertDialogTitle>
                        <AlertDialogDescription>{t("admin.reviews.delete.description")}</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>{t("admin.reviews.delete.cancel")}</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("admin.reviews.delete.confirm")}</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
