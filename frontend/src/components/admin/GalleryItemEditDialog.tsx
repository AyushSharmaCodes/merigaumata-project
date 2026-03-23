import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { galleryItemService, GalleryItem } from "@/services/gallery-item.service";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { getErrorMessage } from "@/lib/errorUtils";
import { I18nInput } from "./I18nInput";

interface GalleryItemEditDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    item: GalleryItem | null;
}

export function GalleryItemEditDialog({
    open,
    onOpenChange,
    item,
}: GalleryItemEditDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState<{
        title: string;
        title_i18n: Record<string, string>;
        description: string;
        description_i18n: Record<string, string>;
        location: string;
        tags: string;
    }>({
        title: "",
        title_i18n: {},
        description: "",
        description_i18n: {},
        location: "",
        tags: "",
    });

    useEffect(() => {
        if (item) {
            setFormData({
                title: item.title || "",
                title_i18n: item.title_i18n || {},
                description: item.description || "",
                description_i18n: item.description_i18n || {},
                location: item.location || "",
                tags: item.tags ? item.tags.join(", ") : "",
            });
        }
    }, [item]);

    const mutation = useMutation({
        mutationFn: async () => {
            if (!item) return;

            // Process tags
            const tagsArray = formData.tags
                .split(",")
                .map((t) => t.trim())
                .filter((t) => t.length > 0);

            return galleryItemService.update(item.id, {
                title: formData.title,
                title_i18n: formData.title_i18n,
                description: formData.description,
                description_i18n: formData.description_i18n,
                location: formData.location,
                tags: tagsArray,
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
            toast.success(t("admin.gallery.toasts.imageUpdated"));
            onOpenChange(false);
        },
        onError: (error: unknown) => {
            toast.error(getErrorMessage(error, t, "admin.gallery.toasts.updateImageError"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    if (!item) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{t("admin.gallery.dialog.editItem")}</DialogTitle>
                    <DialogDescription>
                        {t("admin.gallery.dialog.editItemDesc")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Preview */}
                    <div className="flex justify-center">
                        <img
                            src={item.thumbnail_url || item.image_url}
                            alt={t("admin.gallery.dialog.preview")}
                            loading="lazy"
                            className="h-48 object-contain rounded-md border"
                        />
                    </div>

                    <div className="space-y-4">
                        {/* Title */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-title">{t("common.title")}</Label>
                            <I18nInput
                                label={t("common.title")}
                                value={formData.title}
                                i18nValue={formData.title_i18n}
                                onChange={(title, title_i18n) =>
                                    setFormData({ ...formData, title, title_i18n })
                                }
                                placeholder={t("admin.gallery.dialog.itemTitlePlaceholder")}
                                id="edit-title"
                            />
                        </div>

                        {/* Tags */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-tags">{t("admin.gallery.dialog.tags")}</Label>
                            <Input
                                id="edit-tags"
                                value={formData.tags}
                                onChange={(e) =>
                                    setFormData({ ...formData, tags: e.target.value })
                                }
                                placeholder={t("admin.gallery.dialog.itemTagsPlaceholder")}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("admin.gallery.dialog.tagsHelp")}
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-description">{t("admin.gallery.dialog.description")}</Label>
                            <I18nInput
                                label={t("admin.gallery.dialog.description")}
                                type="textarea"
                                value={formData.description}
                                i18nValue={formData.description_i18n}
                                onChange={(description, description_i18n) =>
                                    setFormData({ ...formData, description, description_i18n })
                                }
                                placeholder={t("admin.gallery.dialog.itemDescPlaceholder")}
                                rows={3}
                                id="edit-description"
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <Label htmlFor="edit-location">{t("admin.gallery.dialog.location")}</Label>
                            <Input
                                id="edit-location"
                                value={formData.location}
                                onChange={(e) =>
                                    setFormData({ ...formData, location: e.target.value })
                                }
                                placeholder={t("admin.gallery.dialog.itemLocationPlaceholder")}
                            />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={mutation.isPending}
                        >
                            {mutation.isPending ? (
                                t("common.saving")
                            ) : (
                                <>
                                    <Save className="h-4 w-4 mr-2" />
                                    {t("common.saveChanges")}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
