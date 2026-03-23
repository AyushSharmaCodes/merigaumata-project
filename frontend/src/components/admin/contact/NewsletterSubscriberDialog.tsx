import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { newsletterService, NewsletterSubscriber } from "@/services/newsletter.service";
import { getErrorMessage } from "@/lib/errorUtils";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface NewsletterSubscriberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    subscriber?: NewsletterSubscriber | null;
}

export function NewsletterSubscriberDialog({
    open,
    onOpenChange,
    subscriber,
}: NewsletterSubscriberDialogProps) {
    const [email, setEmail] = useState("");
    const [name, setName] = useState("");

    const { t } = useTranslation();
    const queryClient = useQueryClient();

    useEffect(() => {
        if (subscriber) {
            setEmail(subscriber.email);
            setName(subscriber.name || "");
        } else {
            setEmail("");
            setName("");
        }
    }, [subscriber, open]);

    const createMutation = useMutation({
        mutationFn: (data: { email: string; name?: string }) =>
            newsletterService.createSubscriber(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
            queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
            toast.success(t("admin.contact.newsletter.subscriberAdded"));
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t, "admin.contact.newsletter.addError"));
        },
    });

    const updateMutation = useMutation({
        mutationFn: (data: { id: string; updates: Partial<NewsletterSubscriber> }) =>
            newsletterService.updateSubscriber(data.id, data.updates),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["newsletter-subscribers"] });
            queryClient.invalidateQueries({ queryKey: ["newsletter-stats"] });
            toast.success(t("admin.contact.newsletter.subscriberUpdated"));
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t, "admin.contact.newsletter.updateError"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!email.trim()) {
            toast.error(t("admin.contact.newsletter.dialog.emailRequired"));
            return;
        }

        const subscriberData = {
            email: email.trim(),
            name: name.trim() || undefined,
        };

        if (subscriber) {
            updateMutation.mutate({ id: subscriber.id, updates: subscriberData });
        } else {
            createMutation.mutate(subscriberData);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {subscriber ? t("admin.contact.newsletter.dialog.editTitle") : t("admin.contact.newsletter.dialog.addTitle")}
                    </DialogTitle>
                    <DialogDescription>
                        {subscriber
                            ? t("admin.contact.newsletter.dialog.editDesc")
                            : t("admin.contact.newsletter.dialog.addDesc")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4 py-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">
                            {t("admin.contact.newsletter.dialog.email")} <span className="text-destructive">*</span>
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="subscriber@example.com"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="name">{t("admin.newsletter.dialog.name")}</Label>
                        <Input
                            id="name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder={t("admin.contact.newsletter.dialog.namePlaceholder")}
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                        >
                            {subscriber ? t("admin.contact.newsletter.dialog.updateBtn") : t("admin.contact.newsletter.dialog.addBtn")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
