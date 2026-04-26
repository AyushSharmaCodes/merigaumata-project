import { logger } from "@/core/observability/logger";
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Textarea } from "@/shared/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/shared/components/ui/select";
import { Label } from "@/shared/components/ui/label";
import { Loader2 } from "lucide-react";

interface FlagDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (reason: string, details: string) => Promise<void>;
}

// Moved inside component to use t()

export const FlagDialog = ({ isOpen, onClose, onSubmit }: FlagDialogProps) => {
    const { t } = useTranslation();
    const [reason, setReason] = useState<string>("");
    const [details, setDetails] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    const FLAG_REASONS = [
        { value: 'spam', label: t("comments.flagReasons.spam") },
        { value: 'offensive', label: t("comments.flagReasons.offensive") },
        { value: 'harassment', label: t("comments.flagReasons.harassment") },
        { value: 'misinformation', label: t("comments.flagReasons.misinformation") },
        { value: 'inappropriate', label: t("comments.flagReasons.inappropriate") },
        { value: 'copyright', label: t("comments.flagReasons.copyright") },
        { value: 'personal_info', label: t("comments.flagReasons.personalInfo") },
        { value: 'other', label: t("comments.flagReasons.other") },
    ];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason) return;

        try {
            setIsSubmitting(true);
            await onSubmit(reason, details);
            onClose();
            // Reset form
            setReason("");
            setDetails("");
        } catch (error) {
            logger.error("Failed to flag comment:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent 
        className="sm:max-w-[425px]"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
                <DialogHeader>
                    <DialogTitle>{t("comments.reportComment")}</DialogTitle>
                    <DialogDescription>
                        {t("comments.flagReasons.title")}
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="reason">{t("comments.reason")}</Label>
                        <Select value={reason} onValueChange={setReason}>
                            <SelectTrigger id="reason">
                                <SelectValue placeholder={t("comments.flagReasons.placeholder")} />
                            </SelectTrigger>
                            <SelectContent>
                                {FLAG_REASONS.map((r) => (
                                    <SelectItem key={r.value} value={r.value}>
                                        {r.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="details">{t("comments.flagReasons.additionalDetails")}</Label>
                        <Textarea
                            id="details"
                            value={details}
                            onChange={(e) => setDetails(e.target.value)}
                            placeholder={t("comments.flagReasons.detailsPlaceholder")}
                            rows={3}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
                            {t("comments.cancel")}
                        </Button>
                        <Button type="submit" disabled={!reason || isSubmitting}>
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    {t("comments.flagReasons.submitting")}
                                </>
                            ) : (
                                t("comments.flagReasons.submitReport")
                            )}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
