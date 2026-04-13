import React, { useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { commentService } from "@/services/comment.service";
import { CommentItem } from "./CommentItem";
import { Comment } from "@/types/comment";
import { Button } from "@/components/ui/button";
import { Loader2, MessageSquare, ChevronDown } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";
import { DeleteConfirmDialog } from "@/components/admin/DeleteConfirmDialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRealtimeInvalidation } from "@/hooks/useRealtimeInvalidation";

interface CommentListProps {
    blogId: string;
}

const CommentSkeleton = () => (
    <div className="flex gap-4 animate-pulse">
        <div className="h-10 w-10 bg-muted rounded-full" />
        <div className="flex-1 space-y-2">
            <div className="flex justify-between">
                <div className="h-4 bg-muted rounded w-1/4" />
                <div className="h-4 bg-muted rounded w-8" />
            </div>
            <div className="h-4 bg-muted rounded w-full" />
            <div className="h-4 bg-muted rounded w-3/4" />
        </div>
    </div>
);

export const CommentList = ({ blogId }: CommentListProps) => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();
    const [sortBy, setSortBy] = useState("newest");
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const LIMIT = 10; // Number of root comments per page

    // Infinite Query for comments
    const {
        data,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        status,
        isError
    } = useInfiniteQuery({
        queryKey: ['comments', blogId, sortBy],
        queryFn: async ({ pageParam = 1 }) => {
            return await commentService.getComments(blogId, pageParam, LIMIT, sortBy);
        },
        getNextPageParam: (lastPage) => {
            if (lastPage.pagination.page < lastPage.pagination.totalPages) {
                return lastPage.pagination.page + 1;
            }
            return undefined;
        },
        initialPageParam: 1,
        staleTime: 1000 * 60, // 1 minute
    });

    useRealtimeInvalidation(["comments"], [["comments", blogId]], !!blogId);

    // Mutations
    const replyMutation = useMutation({
        mutationFn: ({ parentId, content }: { parentId: string; content: string }) =>
            commentService.createComment({ blogId, content, parentId }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', blogId] });
            toast({ title: t("comments.replySuccess") });
        },
        onError: (error: unknown) => {
            toast({
                title: t("comments.replyFailed"),
                description: getErrorMessage(error, "Unknown error"),
                variant: "destructive"
            });
        }
    });

    const editMutation = useMutation({
        mutationFn: ({ id, content }: { id: string; content: string }) =>
            commentService.updateComment(id, { content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', blogId] });
            toast({ title: t("comments.editSuccess") });
        },
        onError: (error: unknown) => {
            toast({
                title: t("comments.editFailed"),
                description: getErrorMessage(error, "Unknown error"),
                variant: "destructive"
            });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => commentService.deleteComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', blogId] });
            toast({ title: t("comments.deleteSuccess") });
            setDeleteId(null);
        },
        onError: (error: unknown) => {
            toast({
                title: t("comments.deleteFailed"),
                description: getErrorMessage(error, "Unknown error"),
                variant: "destructive"
            });
        }
    });

    const flagMutation = useMutation({
        mutationFn: ({ id, reason, details }: { id: string; reason: string; details: string }) =>
            commentService.flagComment(id, { reason, details }),
        onSuccess: () => {
            toast({ title: t("comments.reportSuccess"), description: t("comments.reportSuccessMsg") });
        },
        onError: (error: unknown) => {
            toast({
                title: t("comments.reportFailed"),
                description: getErrorMessage(error, "Unknown error"),
                variant: "destructive"
            });
        }
    });

    const handleReply = async (parentId: string, content: string) => {
        await replyMutation.mutateAsync({ parentId, content });
    };

    const handleEdit = async (id: string, content: string) => {
        await editMutation.mutateAsync({ id, content });
    };

    const handleDelete = async (id: string) => {
        setDeleteId(id);
    };

    const confirmDelete = async () => {
        if (deleteId) {
            await deleteMutation.mutateAsync(deleteId);
        }
    };

    const handleFlag = async (id: string, reason: string, details: string) => {
        await flagMutation.mutateAsync({ id, reason, details });
    };

    if (status === 'pending') {
        return (
            <div className="space-y-6">
                {/* Skeleton Header */}
                <div className="flex justify-between items-center mb-6">
                    <div className="h-6 w-32 bg-muted-foreground/10 rounded animate-pulse" />
                    <div className="h-10 w-[180px] bg-muted-foreground/10 rounded animate-pulse" />
                </div>
                {/* Skeleton List */}
                {[1, 2, 3].map((i) => (
                    <CommentSkeleton key={i} />
                ))}
            </div>
        );
    }

    if (isError) {
        return (
            <div className="text-center py-12 text-destructive bg-destructive/5 rounded-xl border border-destructive/10">
                <p>{t("comments.loadFailed")}</p>
            </div>
        );
    }

    const totalComments = data?.pages[0]?.pagination.total || 0;
    const allComments = data?.pages.flatMap((page) => page.comments) || [];

    return (
        <div className="space-y-8">
            {/* Header / Sort */}
            <div className="flex justify-between items-center pb-2 border-b">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    {t("comments.count", { count: totalComments })}
                </h3>
                <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] bg-background">
                        <SelectValue placeholder={t("comments.sortBy")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="newest">{t("comments.sortNewest")}</SelectItem>
                        <SelectItem value="oldest">{t("comments.sortOldest")}</SelectItem>
                        <SelectItem value="most-replies">{t("comments.sortMostReplies")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Comment List */}
            <div className="space-y-6">
                {allComments.length === 0 ? (
                    <div className="text-center py-12 bg-muted/10 rounded-xl border border-dashed text-muted-foreground">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-20" />
                        <p className="text-lg font-medium">{t("comments.noComments")}</p>
                        <p className="text-sm">{t("comments.beFirst")}</p>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {allComments.map((comment: Comment) => (
                            <CommentItem
                                key={comment.id}
                                comment={comment}
                                onReply={handleReply}
                                onEdit={handleEdit}
                                onDelete={handleDelete}
                                onFlag={handleFlag}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Load More Button */}
            {hasNextPage && (
                <div className="flex justify-center pt-6">
                    <Button
                        variant="outline"
                        onClick={() => fetchNextPage()}
                        disabled={isFetchingNextPage}
                        className="w-full sm:w-auto min-w-[200px]"
                    >
                        {isFetchingNextPage ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {t("comments.loading")}
                            </>
                        ) : (
                            <>
                                {t("comments.loadMore")}
                                <ChevronDown className="ml-2 h-4 w-4" />
                            </>
                        )}
                    </Button>
                </div>
            )}

            <DeleteConfirmDialog
                open={!!deleteId}
                onOpenChange={(open) => !open && setDeleteId(null)}
                title={t("comments.deleteTitle")}
                description={t("comments.deleteDesc")}
                onConfirm={confirmDelete}
                isLoading={deleteMutation.isPending}
            />
        </div>
    );
};
