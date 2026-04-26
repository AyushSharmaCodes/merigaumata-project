import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/shared/components/ui/dialog";
import { Button } from "@/shared/components/ui/button";
import { Input } from "@/shared/components/ui/input";
import { Label } from "@/shared/components/ui/label";
import { Textarea } from "@/shared/components/ui/textarea";
import { ImageUpload } from "@/features/admin";
import { galleryItemService } from "@/domains/content";
import { useToast } from "@/shared/hooks/use-toast";
import { Loader2, Upload } from "lucide-react";
import { uploadService } from "@/core/upload/upload-client";
import { getErrorMessage } from "@/core/utils/errorUtils";
import { logger } from "@/core/observability/logger";

interface GalleryItemUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folderId: string;
    folderName?: string;
}

export function GalleryItemUploadDialog({
    open,
    onOpenChange,
    folderId,
    folderName,
}: GalleryItemUploadDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [formData, setFormData] = useState<{
        title: string;
        description: string;
        location: string;
        tags: string;
        images: (File | string)[];
    }>({
        title: "",
        description: "",
        location: "",
        tags: "",
        images: [],
    });

    const [uploadProgress, setUploadProgress] = useState({
        current: 0,
        total: 0,
    });

    const mutation = useMutation({
        mutationFn: async () => {
            if (formData.images.length === 0) {
                throw new Error(t("admin.gallery.toasts.requiredImage"));
            }

            const total = formData.images.length;
            setUploadProgress({ current: 0, total });

            for (let i = 0; i < total; i++) {
                const image = formData.images[i];
                const index = i;
                setUploadProgress(prev => ({ ...prev, current: i + 1 }));

                let finalImageUrl = "";
                const idempotencyKey = `gallery-upload-${folderId}-${Date.now()}-${index}`;

                if (image instanceof File) {
                    const uploadResponse = await uploadService.uploadImage(
                        image,
                        "gallery",
                        folderName || folderId,
                        {
                            headers: {
                                "x-idempotency-key": `${idempotencyKey}-file`
                            }
                        }
                    );
                    finalImageUrl = uploadResponse.url;
                } else if (typeof image === "string") {
                    finalImageUrl = image;
                }

                if (!finalImageUrl) continue;

                // Process tags
                const tagsArray = formData.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);

                try {
                    await galleryItemService.create({
                        folder_id: folderId,
                        title: total > 1 ? undefined : formData.title,
                        description: formData.description,
                        location: formData.location,
                        image_url: finalImageUrl,
                        thumbnail_url: finalImageUrl,
                        order_index: index,
                        tags: tagsArray,
                    }, {
                        headers: {
                            "x-idempotency-key": `${idempotencyKey}-item`
                        }
                    });
                } catch (error) {
                    // Cleanup if we just uploaded it
                    if (image instanceof File && finalImageUrl) {
                        logger.warn("Gallery item creation failed, cleaning up image", { finalImageUrl, error });
                        try {
                            await uploadService.deleteImageByUrl(finalImageUrl);
                        } catch (cleanupError) {
                            logger.error("Failed to cleanup gallery upload image", { cleanupError, finalImageUrl });
                        }
                    }
                    throw error;
                }
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            toast({
                title: t("common.success"),
                description: t("admin.gallery.toasts.uploadSuccess"),
            });
            onOpenChange(false);
            // Reset form
            setFormData({
                title: "",
                description: "",
                location: "",
                tags: "",
                images: [],
            });
        },
        onError: (error: unknown) => {
            toast({
                title: t("common.error"),
                description: getErrorMessage(error, t, "admin.gallery.toasts.uploadError"),
                variant: "destructive",
            });
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent 
                className="sm:max-w-xl max-h-[90vh] overflow-y-auto"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <DialogHeader>
                    <DialogTitle>{t("admin.gallery.dialog.uploadItems")}</DialogTitle>
                    <DialogDescription>
                        {t("admin.gallery.dialog.uploadItemsDesc")}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Image Upload */}
                    <div className="space-y-2">
                        <Label>
                            {t("admin.gallery.images")} <span className="text-destructive">*</span>
                        </Label>
                        <ImageUpload
                            images={formData.images}
                            onChange={(images) => setFormData({ ...formData, images })}
                            maxImages={50}
                            type="gallery"
                        />
                    </div>

                    {/* Common Metadata */}
                    <div className="space-y-4 border-t pt-4">
                        <h4 className="text-sm font-medium text-muted-foreground">
                            {t("admin.gallery.dialog.metadata")}
                        </h4>

                        {/* Title - Only show for single image or as a prefix? Let's hide for bulk to avoid confusion or keep optional */}
                        {formData.images.length <= 1 && (
                            <div className="space-y-2">
                                <Label htmlFor="title">{t("common.title")} ({t("common.optional")})</Label>
                                <Input
                                    id="title"
                                    value={formData.title}
                                    onChange={(e) =>
                                        setFormData({ ...formData, title: e.target.value })
                                    }
                                    placeholder={t("common.titlePlaceholder")}
                                />
                            </div>
                        )}

                        {/* Tags */}
                        <div className="space-y-2">
                            <Label htmlFor="tags">{t("admin.gallery.dialog.tags")} ({t("common.optional")})</Label>
                            <Input
                                id="tags"
                                value={formData.tags}
                                onChange={(e) =>
                                    setFormData({ ...formData, tags: e.target.value })
                                }
                                placeholder={t("admin.gallery.placeholder.tags", { defaultValue: "nature, cow, festival" })}
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("admin.gallery.dialog.tagsHelp")}
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">{t("admin.gallery.dialog.description")}</Label>
                            <Textarea
                                id="description"
                                value={formData.description}
                                onChange={(e) =>
                                    setFormData({ ...formData, description: e.target.value })
                                }
                                placeholder={t("admin.gallery.dialog.descPlaceholder")}
                                rows={3}
                            />
                        </div>

                        {/* Location */}
                        <div className="space-y-2">
                            <Label htmlFor="location">{t("admin.gallery.dialog.location")} ({t("common.optional")})</Label>
                            <Input
                                id="location"
                                value={formData.location}
                                onChange={(e) =>
                                    setFormData({ ...formData, location: e.target.value })
                                }
                                placeholder={t("admin.gallery.placeholder.title", { defaultValue: "e.g., Goshala" })}
                            />
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex justify-end gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={mutation.isPending}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            type="submit"
                            disabled={mutation.isPending || formData.images.length === 0}
                        >
                            {mutation.isPending ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    {t("common.uploadingProgress", { current: uploadProgress.current, total: uploadProgress.total })}
                                </>
                            ) : (
                                <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    {t("admin.gallery.uploadImages")} {formData.images.length > 0 ? `(${formData.images.length})` : ""}
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
