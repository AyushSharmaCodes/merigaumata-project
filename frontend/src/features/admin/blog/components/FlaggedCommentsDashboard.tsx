import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { commentService } from "@/features/blog";
import { Comment } from "@/domains/content/model/comment.types";
import { Button } from "@/shared/components/ui/button";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/shared/components/ui/table";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Loader2, Check, EyeOff, Trash2, RotateCcw } from "lucide-react";
import { toast } from "@/shared/hooks/use-toast";
import { formatDistanceToNow } from 'date-fns';

export const FlaggedCommentsDashboard = () => {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>("active");

    const { data, isLoading, isError } = useQuery({
        queryKey: ['flagged-comments', page, statusFilter],
        queryFn: () => commentService.getFlaggedComments(page, 20, statusFilter),
    });

    const approveMutation = useMutation({
        mutationFn: (id: string) => commentService.approveComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flagged-comments'] });
            toast({ title: t("comments.admin.approvedSuccess") });
        }
    });

    const hideMutation = useMutation({
        mutationFn: (id: string) => commentService.hideComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flagged-comments'] });
            toast({ title: t("comments.admin.hiddenSuccess") });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => commentService.deleteComment(id),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['flagged-comments'] });
            toast({ title: t("comments.deleteSuccess") });
        }
    });

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>;
    }

    if (isError) {
        return <div className="text-destructive p-8">{t("comments.failedToLoad")}</div>;
    }

    const comments = data?.comments || [];

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">{t("comments.moderationDashboard")}</h2>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder={t("comments.admin.filterByStatus")} />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="active">{t("comments.active")}</SelectItem>
                        <SelectItem value="hidden">{t("comments.hidden")}</SelectItem>
                        <SelectItem value="deleted">{t("comments.deleted")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <div className="border rounded-md">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("comments.user")}</TableHead>
                            <TableHead className="w-[40%]">{t("comments.content")}</TableHead>
                            <TableHead>{t("comments.flags")}</TableHead>
                            <TableHead>{t("comments.reason")}</TableHead>
                            <TableHead>{t("comments.posted")}</TableHead>
                            <TableHead className="text-right">{t("comments.actions")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {comments.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                    {t("comments.admin.noFlaggedFound")}
                                </TableCell>
                            </TableRow>
                        ) : (
                            comments.map((comment: Comment) => (
                                <TableRow key={comment.id}>
                                    <TableCell className="font-medium">
                                        {comment.profiles?.first_name} {comment.profiles?.last_name}
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-h-20 overflow-y-auto text-sm">
                                            {comment.content}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                            {comment.flag_count}
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {comment.flag_reason}
                                    </TableCell>
                                    <TableCell className="text-sm text-muted-foreground">
                                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                    </TableCell>
                                    <TableCell className="text-right space-x-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                            onClick={() => approveMutation.mutate(comment.id)}
                                            title={t("comments.admin.approve")}
                                        >
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                                            onClick={() => hideMutation.mutate(comment.id)}
                                            title={t("comments.admin.hide")}
                                        >
                                            <EyeOff className="h-4 w-4" />
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                            onClick={() => deleteMutation.mutate(comment.id)}
                                            title={t("comments.delete")}
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
        </div>
    );
};
