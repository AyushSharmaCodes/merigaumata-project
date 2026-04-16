import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { commentService } from "@/services/comment.service";
import { ModerationLog } from "@/types/comment";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import { Loader2 } from "lucide-react";
import { format } from 'date-fns';

interface ModerationHistoryViewerProps {
    commentId: string;
}

export const ModerationHistoryViewer = ({ commentId }: ModerationHistoryViewerProps) => {
    const { t } = useTranslation();
    const { data: history, isLoading, isError } = useQuery({
        queryKey: ['moderation-history', commentId],
        queryFn: () => commentService.getModerationHistory(commentId),
    });

    if (isLoading) {
        return <div className="flex justify-center p-4"><Loader2 className="animate-spin h-4 w-4" /></div>;
    }

    if (isError) {
        return <div className="text-destructive p-4 text-sm">{t("comments.admin.historyTitle")} {t("comments.failedToLoad")}</div>;
    }

    if (!history || history.length === 0) {
        return <div className="text-muted-foreground p-4 text-sm">{t("comments.admin.noHistory")}</div>;
    }

    return (
        <div className="border rounded-md">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-[140px]">{t("comments.admin.date")}</TableHead>
                        <TableHead>{t("comments.admin.action")}</TableHead>
                        <TableHead>{t("comments.admin.performedBy")}</TableHead>
                        <TableHead>{t("comments.admin.details")}</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {history.map((log: ModerationLog) => (
                        <TableRow key={log.id}>
                            <TableCell className="text-xs">
                                {format(new Date(log.created_at), 'PP p')}
                            </TableCell>
                            <TableCell className="capitalize font-medium text-xs">
                                {log.action.replace('_', ' ')}
                            </TableCell>
                            <TableCell className="text-xs">
                                {log.performer?.first_name} {log.performer?.last_name}
                                <span className="text-muted-foreground ml-1">
                                    ({log.performer?.role})
                                </span>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                                {log.reason && (
                                    <div className="mb-1">
                                        <span className="font-semibold">{t("comments.reason")}:</span> {log.reason}
                                    </div>
                                )}
                                {log.metadata && (
                                    <pre className="whitespace-pre-wrap font-mono text-[10px]">
                                        {JSON.stringify(log.metadata, null, 2)}
                                    </pre>
                                )}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
};
