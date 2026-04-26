import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { commentService } from "@/domains/content";
import { apiClient } from "@/core/api/api-client";
import { useAuthStore } from "@/domains/auth";
import { toast } from "@/shared/hooks/use-toast";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { Comment } from "@/domains/content/model/comment.types";
import { useTranslation } from "react-i18next";

export const useFlaggedCommentsManagement = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [searchQuery, setSearchQuery] = useState("");
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<"all" | "active" | "hidden" | "deleted">("active");
    const [selectedComment, setSelectedComment] = useState<Comment | null>(null);
    const [actionType, setActionType] = useState<"dismiss" | "delete" | "block" | "unblock" | "approve" | "hide" | null>(null);
    const [isActionOpen, setIsActionOpen] = useState(false);
    const [historyComment, setHistoryComment] = useState<Comment | null>(null);
    const PAGE_SIZE = 20;
    const canBlockUsers = user?.role === "admin";

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["flagged-comments", page, statusFilter],
        queryFn: () => commentService.getFlaggedComments(page, PAGE_SIZE, statusFilter),
    });

    const flaggedComments = data?.comments || [];
    const pagination = data?.pagination;
    const totalPages = pagination?.totalPages || 0;

    const resolveMutation = useMutation({
        mutationFn: ({ id, action }: { id: string; action: "approve" | "hide" }) => 
            action === "approve" ? commentService.approveComment(id) : commentService.hideComment(id),
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
            toast({ title: t("common.success"), description: variables.action === "hide" ? t("admin.flaggedComments.toasts.hideSuccess") : t("admin.flaggedComments.toasts.approveSuccess") });
            setActionType(null);
            setSelectedComment(null);
            setIsActionOpen(false);
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const deletePermanentlyMutation = useMutation({
        mutationFn: (id: string) => commentService.deleteCommentPermanently(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
            toast({ title: t("common.success"), description: t("admin.flaggedComments.toasts.deleteSuccess") });
            setActionType(null);
            setSelectedComment(null);
            setIsActionOpen(false);
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const blockUserMutation = useMutation({
        mutationFn: (userId: string) => apiClient.post(`/users/${userId}/block`, { isBlocked: true }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
            toast({ title: t("common.success"), description: t("admin.flaggedComments.toasts.blockSuccess") });
            setActionType(null);
            setSelectedComment(null);
            setIsActionOpen(false);
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const unblockUserMutation = useMutation({
        mutationFn: (userId: string) => apiClient.post(`/users/${userId}/block`, { isBlocked: false }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["flagged-comments"] });
            toast({ title: t("common.success"), description: t("admin.flaggedComments.toasts.unblockSuccess") });
            setActionType(null);
            setSelectedComment(null);
            setIsActionOpen(false);
        },
        onError: (error) => toast({ title: t("common.error"), description: getErrorMessage(error), variant: "destructive" }),
    });

    const filteredComments = flaggedComments.filter(
        (comment) =>
            comment.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
            comment.profiles?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            comment.profiles?.last_name?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleAction = () => {
        if (!selectedComment || !actionType) return;
        const actions: Record<string, () => void> = {
            block: () => blockUserMutation.mutate(selectedComment.user_id),
            unblock: () => unblockUserMutation.mutate(selectedComment.user_id),
            delete: () => deletePermanentlyMutation.mutate(selectedComment.id),
            approve: () => resolveMutation.mutate({ id: selectedComment.id, action: "approve" }),
            dismiss: () => resolveMutation.mutate({ id: selectedComment.id, action: "approve" }),
            hide: () => resolveMutation.mutate({ id: selectedComment.id, action: "hide" }),
        };
        actions[actionType]?.();
    };

    return {
        t,
        searchQuery, setSearchQuery,
        page, setPage,
        statusFilter, setStatusFilter,
        selectedComment, setSelectedComment,
        actionType, setActionType,
        isActionOpen, setIsActionOpen,
        historyComment, setHistoryComment,
        totalPages,
        filteredComments,
        isLoading,
        isFetching,
        canBlockUsers,
        handleAction,
        totalFlags: pagination?.total || 0,
    };
};
