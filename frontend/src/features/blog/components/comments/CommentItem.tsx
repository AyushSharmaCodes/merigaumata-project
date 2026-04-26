import { useTranslation } from 'react-i18next';
import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Comment } from "@/domains/content/model/comment.types";
import { Button } from "@/shared/components/ui/button";
import {
    MessageSquare,
    Edit2,
    Trash2,
    Flag,
    MoreVertical,
    Reply,
    CornerDownRight
} from "lucide-react";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/shared/components/ui/dropdown-menu";
import { CommentForm } from "./CommentForm";
import { FlagDialog } from "./FlagDialog";
import { useAuthStore } from "@/domains/auth";
import { cn } from "@/core/utils/utils";
import { UserAvatar } from "@/shared/components/ui/user-avatar";

interface CommentItemProps {
    comment: Comment;
    onReply: (parentId: string, content: string) => Promise<void>;
    onEdit: (id: string, content: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    onFlag: (id: string, reason: string, details: string) => Promise<void>;
    depth?: number;
}

export const CommentItem = ({
    comment,
    onReply,
    onEdit,
    onDelete,
    onFlag,
    depth = 0
}: CommentItemProps) => {
    const { t } = useTranslation();
    const { user, isAuthenticated } = useAuthStore();
    const [isReplying, setIsReplying] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [isFlagging, setIsFlagging] = useState(false);
    const [showReplies, setShowReplies] = useState(true);
    const [visibleReplies, setVisibleReplies] = useState(3);

    const isOwner = user?.id === comment.user_id;
    const isAdmin = user?.role === 'admin' || user?.role === 'manager';
    const isDeleted = comment.status === 'deleted';
    const isHidden = comment.status === 'hidden';
    const displayName = [comment.profiles?.first_name, comment.profiles?.last_name].filter(Boolean).join(" ").trim()
        || comment.profiles?.name
        || "User";

    // Check if edit is allowed (15 mins limit)
    const canEdit = isOwner && !isDeleted &&
        (new Date().getTime() - new Date(comment.created_at).getTime() < 15 * 60 * 1000);

    const handleReplySubmit = async (content: string) => {
        await onReply(comment.id, content);
        setIsReplying(false);
        setShowReplies(true); // Auto-expand to show new reply
    };

    const handleEditSubmit = async (content: string) => {
        await onEdit(comment.id, content);
        setIsEditing(false);
    };

    const handleFlagSubmit = async (reason: string, details: string) => {
        await onFlag(comment.id, reason, details);
    };

    if (isHidden && !isAdmin && !isOwner) {
        return null; // Don't show hidden comments to public
    }

    return (
        <div className={cn("group animate-in fade-in slide-in-from-top-2 duration-300", depth > 0 && "mt-6")}>
            <div className="flex gap-4">
                {/* Avatar */}
                <UserAvatar
                    name={displayName}
                    firstName={comment.profiles?.first_name}
                    lastName={comment.profiles?.last_name}
                    imageUrl={comment.profiles?.avatar_url}
                    className="h-10 w-10 border shadow-sm flex-shrink-0"
                />

                {/* Content Container */}
                <div className="flex-1 min-w-0">
                    <div className="space-y-1">
                        {/* Header: Name & Meta */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-foreground text-sm sm:text-base">
                                    {displayName}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    • {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                                </span>
                                {comment.edit_count > 0 && (
                                    <span className="text-xs text-muted-foreground italic">
                                        {t("comments.edited")}
                                    </span>
                                )}
                                {isHidden && (
                                    <span className="text-xs bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full border border-yellow-200 font-medium">
                                        {t("comments.hidden")}
                                    </span>
                                )}
                            </div>

                            {/* Actions Dropdown (Edit/Delete/Report) */}
                            {!isDeleted && (isAuthenticated || isAdmin) && (
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100">
                                            <MoreVertical className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end">
                                        {canEdit && (
                                            <DropdownMenuItem onClick={() => setIsEditing(true)}>
                                                <Edit2 className="mr-2 h-4 w-4" />
                                                {t("comments.edit")}
                                            </DropdownMenuItem>
                                        )}
                                        {(isOwner || isAdmin) && (
                                            <DropdownMenuItem onClick={() => onDelete(comment.id)} className="text-destructive focus:text-destructive">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                {t("comments.delete")}
                                            </DropdownMenuItem>
                                        )}
                                        {!isOwner && isAuthenticated && (
                                            <DropdownMenuItem onClick={() => setIsFlagging(true)}>
                                                <Flag className="mr-2 h-4 w-4" />
                                                {t("comments.report")}
                                            </DropdownMenuItem>
                                        )}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            )}
                        </div>

                        {/* Comment Body */}
                        {isEditing ? (
                            <div className="pt-2">
                                <CommentForm
                                    initialContent={comment.content}
                                    onSubmit={handleEditSubmit}
                                    onCancel={() => setIsEditing(false)}
                                    submitLabel={t("comments.saveChanges")}
                                    autoFocus
                                />
                            </div>
                        ) : (
                            <div className={cn("text-sm sm:text-base leading-relaxed text-foreground/90 break-words whitespace-pre-wrap py-1",
                                isDeleted && "text-muted-foreground italic bg-muted/30 p-2 rounded"
                            )}>
                                {isDeleted ? t("comments.deletedMsg") : comment.content}
                            </div>
                        )}
                    </div>

                    {/* Action Bar (Reply) */}
                    {!isDeleted && !isEditing && (
                        <div className="flex items-center gap-4 mt-3">
                            {isAuthenticated && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
                                    onClick={() => setIsReplying(!isReplying)}
                                >
                                    <Reply className="h-3.5 w-3.5" />
                                    {t("comments.reply")}
                                </Button>
                            )}

                            {comment.replies && comment.replies.length > 0 && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-auto p-0 text-xs font-medium text-muted-foreground hover:text-primary transition-colors"
                                    onClick={() => setShowReplies(!showReplies)}
                                >
                                    {showReplies ? t("comments.hideReplies") : t("comments.viewReplies", { count: comment.replies.length })}
                                </Button>
                            )}
                        </div>
                    )}

                    {/* Reply Form */}
                    {isReplying && (
                        <div className="mt-4 animate-in fade-in slide-in-from-top-2">
                            <CommentForm
                                onSubmit={handleReplySubmit}
                                onCancel={() => setIsReplying(false)}
                                submitLabel={t("comments.reply")}
                                placeholder={t("comments.replyTo", { name: comment.profiles?.first_name })}
                                autoFocus
                                isReply
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Nested Replies with Thread Line */}
            {showReplies && comment.replies && comment.replies.length > 0 && (
                <div className="relative mt-2">
                    {/* Thread Line */}
                    <div className="absolute left-[1.2rem] top-0 bottom-0 w-px bg-border/60" />

                    <div className="pl-12 space-y-6">
                        {comment.replies.slice(0, visibleReplies).map((reply) => (
                            <CommentItem
                                key={reply.id}
                                comment={reply}
                                onReply={onReply}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onFlag={onFlag}
                                depth={depth + 1}
                            />
                        ))}
                    </div>

                    {/* Show More Replies Button */}
                    {visibleReplies < comment.replies.length && (
                        <div className="pl-12 mt-4">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setVisibleReplies(prev => prev + 5)}
                                className="h-auto py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-2"
                            >
                                <CornerDownRight className="h-3 w-3" />
                                {t("comments.showMoreReplies", { count: comment.replies.length - visibleReplies })}
                            </Button>
                        </div>
                    )}
                </div>
            )}

            <FlagDialog
                isOpen={isFlagging}
                onClose={() => setIsFlagging(false)}
                onSubmit={handleFlagSubmit}
            />
        </div>
    );
};
