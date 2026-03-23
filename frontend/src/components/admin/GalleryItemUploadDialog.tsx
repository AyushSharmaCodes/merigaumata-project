import { useState } from "react";
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
import { ImageUpload } from "@/components/admin/ImageUpload";
import { galleryItemService } from "@/services/gallery-item.service";
import { toast } from "sonner";
import { Upload } from "lucide-react";
import { uploadService } from "@/services/upload.service";
import { getErrorMessage } from "@/lib/errorUtils";

interface GalleryItemUploadDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    folderId: string;
}

export function GalleryItemUploadDialog({
    open,
    onOpenChange,
    folderId,
}: GalleryItemUploadDialogProps) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
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

    const mutation = useMutation({
        mutationFn: async () => {
            if (formData.images.length === 0) {
                throw new Error(t("admin.gallery.toasts.requiredImage"));
            }

            const uploadPromises = formData.images.map(async (image, index) => {
                let finalImageUrl = "";

                if (image instanceof File) {
                    const uploadResponse = await uploadService.uploadImage(
                        image,
                        "gallery",
                        folderId
                    );
                    finalImageUrl = uploadResponse.url;
                } else if (typeof image === "string") {
                    finalImageUrl = image;
                }

                if (!finalImageUrl) return null;

                // Process tags
                const tagsArray = formData.tags
                    .split(",")
                    .map((t) => t.trim())
                    .filter((t) => t.length > 0);

                try {
                    return await galleryItemService.create({
                        folder_id: folderId,
                        title: formData.images.length > 1 ? undefined : formData.title, // Only set title if single image
                        description: formData.description,
                        location: formData.location,
                        image_url: finalImageUrl,
                        thumbnail_url: finalImageUrl,
                        order_index: index, // Simple ordering based on selection
                        tags: tagsArray,
                    });
                } catch (error) {
                    // Cleanup if we just uploaded it
                    if (image instanceof File && finalImageUrl) {
                        console.warn("Gallery item creation failed, cleaning up image:", finalImageUrl);
                        try {
                            await uploadService.deleteImageByUrl(finalImageUrl);
                        } catch (cleanupError) {
                            console.error("Failed to cleanup image:", cleanupError);
                        }
                    }
                    throw error;
                }
            });

            await Promise.all(uploadPromises);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["gallery-items"] });
            queryClient.invalidateQueries({ queryKey: ["gallery-folders"] });
            toast.success(t("admin.gallery.toasts.uploadSuccess"));
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
            toast.error(getErrorMessage(error, t, "admin.gallery.toasts.uploadError"));
        },
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        mutation.mutate();
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                                placeholder="nature, cow, festival"
                            />
                            <p className="text-xs text-muted-foreground">
                                {t("admin.gallery.dialog.tagsHelp")}
                            </p>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <Label htmlFor="description">{t("admin.gallery.dialog.description")} ({t("common.optional")})</Label>
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
                                placeholder="e.g., Goshala"
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
                            disabled={mutation.isPending || formData.images.length === 0}
                        >
                            {mutation.isPending ? (
                                t("common.uploading")
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
