import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { commentService } from "@/services/comment.service";
import { CommentList } from "./CommentList";
import { CommentForm } from "./CommentForm";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/errorUtils";

interface CommentSystemProps {
    blogId: string;
}

export const CommentSystem = ({ blogId }: CommentSystemProps) => {
    const queryClient = useQueryClient();
    const { t } = useTranslation();

    const createMutation = useMutation({
        mutationFn: (content: string) =>
            commentService.createComment({ blogId, content }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['comments', blogId] });
            toast({
                title: t("comments.postedTitle"),
                description: t("comments.postedMsg")
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("comments.postFailed"),
                description: getErrorMessage(error, "Unknown error"),
                variant: "destructive"
            });
        }
    });

    const handleCreateComment = async (content: string) => {
        await createMutation.mutateAsync(content);
    };

    return (
        <div className="max-w-3xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl font-bold mb-6">{t("comments.title")}</h2>

            {/* New Comment Form */}
            <div className="mb-8">
                <CommentForm
                    onSubmit={handleCreateComment}
                    submitLabel={t("comments.postComment")}
                    placeholder={t("comments.placeholder")}
                />
            </div>

            {/* Comment List */}
            <CommentList blogId={blogId} />
        </div>
    );
};
