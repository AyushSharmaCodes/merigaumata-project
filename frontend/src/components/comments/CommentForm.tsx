import { logger } from "@/lib/logger";
import React, { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuthStore } from "@/store/authStore";
import { Loader2, Send } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface CommentFormProps {
    onSubmit: (content: string) => Promise<void>;
    initialContent?: string;
    placeholder?: string;
    submitLabel?: string;
    onCancel?: () => void;
    autoFocus?: boolean;
    isReply?: boolean;
}

export const CommentForm = ({
    onSubmit,
    initialContent = "",
    placeholder,
    submitLabel,
    onCancel,
    autoFocus = false,
    isReply = false
}: CommentFormProps) => {
    const { t } = useTranslation();
    const finalPlaceholder = placeholder || t("comments.defaultPlaceholder");
    const finalSubmitLabel = submitLabel || t("comments.defaultSubmit");
    const [content, setContent] = useState(initialContent);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExpanded, setIsExpanded] = useState(isReply || !!initialContent);
    const { isAuthenticated } = useAuthStore();
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    const maxLength = 2000;
    const minLength = 2;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!content.trim()) return;

        if (content.length < minLength) {
            toast({
                title: t("comments.validation.tooShort"),
                description: t("comments.validation.tooShortMsg", { min: minLength }),
                variant: "destructive"
            });
            return;
        }

        if (content.length > maxLength) {
            toast({
                title: t("comments.validation.tooLong"),
                description: t("comments.validation.tooLongMsg", { max: maxLength }),
                variant: "destructive"
            });
            return;
        }

        try {
            setIsSubmitting(true);
            // Sanitize content before sending (extra safety, backend also sanitizes)
            const sanitizedContent = DOMPurify.sanitize(content);
            await onSubmit(sanitizedContent);
            setContent("");
            if (onCancel) {
                onCancel();
            } else {
                setIsExpanded(false); // Collapse main form after submit
                textareaRef.current?.blur();
            }
        } catch (error) {
            logger.error("Failed to submit comment:", error);
            toast({
                title: t("common.error"),
                description: t("comments.postFailed"),
                variant: "destructive"
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleFocus = () => {
        setIsExpanded(true);
    };

    const handleCancel = () => {
        setContent(initialContent);
        if (onCancel) {
            onCancel();
        } else {
            setIsExpanded(false);
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="p-6 border rounded-xl bg-muted/40 text-center space-y-3">
                <p className="text-muted-foreground font-medium">{t("comments.joinConversation")}</p>
                <p className="text-sm text-muted-foreground">{t("comments.authMsg")}</p>
                {/* Login button or link could go here via a callback or link */}
            </div>
        );
    }

    return (
        <form onSubmit={handleSubmit} className={cn("space-y-4 transition-all duration-200", isExpanded ? "opacity-100" : "opacity-90")}>
            <div className="relative group">
                <Textarea
                    ref={textareaRef}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    onFocus={handleFocus}
                    placeholder={finalPlaceholder}
                    rows={isExpanded ? 4 : 2}
                    autoFocus={autoFocus}
                    className={cn(
                        "resize-none pr-12 transition-all duration-200 ease-in-out",
                        !isExpanded && "min-h-[50px] overflow-hidden"
                    )}
                    disabled={isSubmitting}
                />
                <div className={cn(
                    "absolute bottom-2 right-2 text-xs transition-opacity duration-200",
                    isExpanded ? "opacity-100" : "opacity-0",
                    content.length > maxLength ? "text-destructive" : "text-muted-foreground"
                )}>
                    {content.length}/{maxLength}
                </div>
            </div>

            {/* Action Buttons - Only show when expanded */}
            {isExpanded && (
                <div className="flex justify-end gap-3 animate-in fade-in slide-in-from-top-1 duration-200">
                    <Button
                        type="button"
                        variant="ghost"
                        onClick={handleCancel}
                        disabled={isSubmitting}
                        size="sm"
                        className="text-muted-foreground hover:text-foreground"
                    >
                        {t("comments.cancel")}
                    </Button>
                    <Button
                        type="submit"
                        disabled={isSubmitting || content.trim().length < minLength || content.length > maxLength}
                        size="sm"
                        className="min-w-[80px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                                {t("comments.posting")}
                            </>
                        ) : (
                            <>
                                {finalSubmitLabel}
                                {!isSubmitting && <Send className="ml-2 h-3.5 w-3.5 opacity-70" />}
                            </>
                        )}
                    </Button>
                </div>
            )}
        </form>
    );
};
